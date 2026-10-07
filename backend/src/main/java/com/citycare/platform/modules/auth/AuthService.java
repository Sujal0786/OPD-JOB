package com.citycare.platform.modules.auth;

import com.citycare.platform.common.exception.AuthenticationFailedException;
import com.citycare.platform.common.exception.BusinessException;
import com.citycare.platform.common.exception.HospitalNotFoundException;
import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.hospital.HospitalStatus;
import com.citycare.platform.security.JwtService;
import com.citycare.platform.security.UserPrincipal;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {

    private final HospitalUserRepository userRepository;
    private final HospitalRepository hospitalRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TenantSecurityValidator tenantValidator;
    private final AuditLogService auditLogService;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(
            HospitalUserRepository userRepository,
            HospitalRepository hospitalRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            TenantSecurityValidator tenantValidator,
            AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.hospitalRepository = hospitalRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.tenantValidator = tenantValidator;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        HospitalUser user = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new AuthenticationFailedException("Invalid email or password."));

        if (!user.isActive()) {
            throw new AuthenticationFailedException("Account is disabled. Please contact the administrator.");
        }

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw new AuthenticationFailedException("Account is temporarily locked. Try again later.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= 5) {
                user.setLockedUntil(Instant.now().plusSeconds(900)); // Lock 15 mins
            }
            userRepository.save(user);
            throw new AuthenticationFailedException("Invalid email or password.");
        }

        // Reset failed login counter on success
        if (user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            userRepository.save(user);
        }

        Hospital hospital = user.getHospital();
        if (hospital != null && hospital.getStatus() != HospitalStatus.ACTIVE) {
            throw new AuthenticationFailedException("Hospital account is currently " + hospital.getStatus());
        }

        UserPrincipal principal = new UserPrincipal(user);
        String accessToken = jwtService.generateAccessToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal);

        // Store refresh token
        RefreshToken rt = new RefreshToken(null, user, refreshToken, Instant.now().plusSeconds(604800));
        refreshTokenRepository.save(rt);

        auditLogService.record(hospital, user.getId().toString(), "STAFF_LOGIN", "HospitalUser", user.getId().toString(), null, "{}");

        return new LoginResponse(
                accessToken,
                refreshToken,
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                hospital != null ? hospital.getId() : null,
                hospital != null ? hospital.getName() : null,
                hospital != null ? hospital.getSlug() : null,
                hospital != null ? hospital.getAccessCode() : null
        );
    }

    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        if (!jwtService.validateToken(request.getRefreshToken())) {
            throw new AuthenticationFailedException("Invalid or expired refresh token.");
        }

        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(request.getRefreshToken())
                .orElseThrow(() -> new AuthenticationFailedException("Refresh token revoked or unknown."));

        if (storedToken.isRevoked() || storedToken.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthenticationFailedException("Refresh token expired or revoked.");
        }

        HospitalUser user = storedToken.getUser();
        if (!user.isActive()) {
            throw new AuthenticationFailedException("Account is disabled.");
        }

        // Rotate refresh token
        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);

        UserPrincipal principal = new UserPrincipal(user);
        String newAccessToken = jwtService.generateAccessToken(principal);
        String newRefreshToken = jwtService.generateRefreshToken(principal);

        RefreshToken nextRt = new RefreshToken(null, user, newRefreshToken, Instant.now().plusSeconds(604800));
        refreshTokenRepository.save(nextRt);

        Hospital hospital = user.getHospital();
        return new LoginResponse(
                newAccessToken,
                newRefreshToken,
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                hospital != null ? hospital.getId() : null,
                hospital != null ? hospital.getName() : null,
                hospital != null ? hospital.getSlug() : null,
                hospital != null ? hospital.getAccessCode() : null
        );
    }

    @Transactional
    public LoginResponse registerHospital(HospitalRegistrationRequest request) {
        String slug = request.getSlug().toLowerCase().trim();
        if (hospitalRepository.existsBySlug(slug)) {
            throw new BusinessException("SLUG_ALREADY_EXISTS", "Hospital URL slug '" + slug + "' is already taken.");
        }

        String adminEmail = request.getAdminEmail().toLowerCase().trim();
        if (userRepository.existsByEmail(adminEmail)) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS", "An account with email '" + adminEmail + "' already exists.");
        }

        // Generate a clean 6-digit access code for patient kiosk/entry
        String accessCode = String.format("%06d", secureRandom.nextInt(1_000_000));
        while (hospitalRepository.existsByAccessCode(accessCode)) {
            accessCode = String.format("%06d", secureRandom.nextInt(1_000_000));
        }

        Hospital hospital = new Hospital(
                null,
                slug,
                accessCode,
                request.getHospitalName().trim(),
                request.getAddress(),
                request.getPhone(),
                null,
                HospitalStatus.ACTIVE
        );
        hospitalRepository.save(hospital);

        HospitalUser adminUser = new HospitalUser(
                null,
                hospital,
                adminEmail,
                passwordEncoder.encode(request.getAdminPassword()),
                request.getAdminFullName().trim(),
                Role.HOSPITAL_ADMIN
        );
        userRepository.save(adminUser);

        auditLogService.record(hospital, adminUser.getId().toString(), "HOSPITAL_REGISTERED", "Hospital", hospital.getId().toString(), null, "{\"name\":\"" + hospital.getName() + "\"}");

        UserPrincipal principal = new UserPrincipal(adminUser);
        String accessToken = jwtService.generateAccessToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal);

        RefreshToken rt = new RefreshToken(null, adminUser, refreshToken, Instant.now().plusSeconds(604800));
        refreshTokenRepository.save(rt);

        return new LoginResponse(
                accessToken,
                refreshToken,
                adminUser.getId(),
                adminUser.getEmail(),
                adminUser.getFullName(),
                adminUser.getRole(),
                hospital.getId(),
                hospital.getName(),
                hospital.getSlug(),
                hospital.getAccessCode()
        );
    }

    @Transactional
    public StaffResponse createStaff(UUID hospitalId, StaffCreateRequest request) {
        tenantValidator.validateHospitalAccess(hospitalId);

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));

        String email = request.getEmail().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS", "A staff user with email '" + email + "' already exists.");
        }

        HospitalUser staff = new HospitalUser(
                null,
                hospital,
                email,
                passwordEncoder.encode(request.getPassword()),
                request.getFullName().trim(),
                request.getRole()
        );
        userRepository.save(staff);

        auditLogService.record(hospital, staff.getId().toString(), "STAFF_CREATED", "HospitalUser", staff.getId().toString(), null, "{\"role\":\"" + staff.getRole() + "\"}");

        return StaffResponse.fromEntity(staff);
    }

    @Transactional(readOnly = true)
    public List<StaffResponse> listStaff(UUID hospitalId) {
        tenantValidator.validateHospitalAccess(hospitalId);
        return userRepository.findAllByHospitalId(hospitalId).stream()
                .map(StaffResponse::fromEntity)
                .toList();
    }
}
