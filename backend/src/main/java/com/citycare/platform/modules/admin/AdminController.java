package com.citycare.platform.modules.admin;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.common.exception.HospitalNotFoundException;
import com.citycare.platform.modules.auth.HospitalUser;
import com.citycare.platform.modules.auth.HospitalUserRepository;
import com.citycare.platform.modules.auth.Role;
import com.citycare.platform.modules.doctor.DoctorRepository;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.opdsession.OpdSessionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@Tag(name = "Platform Super Admin", description = "Global multi-tenant platform administration")
public class AdminController {

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    private final HospitalRepository hospitalRepository;
    private final HospitalUserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final OpdSessionRepository sessionRepository;

    public AdminController(HospitalRepository hospitalRepository,
                           HospitalUserRepository userRepository,
                           DoctorRepository doctorRepository,
                           OpdSessionRepository sessionRepository) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.sessionRepository = sessionRepository;
    }

    @GetMapping("/hospitals")
    @Operation(summary = "List all registered hospitals for Super Admin with stats and credentials")
    public ResponseEntity<ApiResponse<List<HospitalAdminSummaryDto>>> listHospitals() {
        List<Hospital> hospitals = hospitalRepository.findAll();
        if (hospitals.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.ok("HOSPITALS_FETCHED", "All registered hospital tenants retrieved.", Collections.emptyList()));
        }

        // 1. Batch fetch all hospital admin users in 1 single query (eliminates N user queries)
        Map<UUID, HospitalUser> adminMap = userRepository.findAllByRoleWithHospital(Role.HOSPITAL_ADMIN).stream()
                .filter(u -> u.getHospital() != null)
                .collect(Collectors.toMap(u -> u.getHospital().getId(), u -> u, (existing, replacement) -> existing));

        // 2. Batch fetch doctor counts grouped by hospital in 1 single JPQL query (eliminates N doctor queries)
        Map<UUID, Long> doctorCountMap = new HashMap<>();
        for (Object[] row : doctorRepository.countDoctorsGroupedByHospital()) {
            UUID hId = (UUID) row[0];
            Long count = ((Number) row[1]).longValue();
            doctorCountMap.put(hId, count);
        }

        // 3. Batch fetch today's session counts grouped by hospital in 1 single JPQL query (eliminates N session queries)
        LocalDate today = LocalDate.now(IST_ZONE);
        Map<UUID, Long> sessionCountMap = new HashMap<>();
        for (Object[] row : sessionRepository.countSessionsGroupedByHospitalAndDate(today)) {
            UUID hId = (UUID) row[0];
            Long count = ((Number) row[1]).longValue();
            sessionCountMap.put(hId, count);
        }

        // 4. Assemble DTOs entirely in memory with O(1) lookups
        List<HospitalAdminSummaryDto> dtos = new ArrayList<>(hospitals.size());
        for (Hospital h : hospitals) {
            HospitalUser admin = adminMap.get(h.getId());
            long doctorCount = doctorCountMap.getOrDefault(h.getId(), 0L);
            long sessionCount = sessionCountMap.getOrDefault(h.getId(), 0L);

            dtos.add(new HospitalAdminSummaryDto(
                    h.getId(),
                    h.getName(),
                    h.getSlug(),
                    h.getAccessCode(),
                    h.getAddress(),
                    h.getPhone(),
                    h.getStatus(),
                    admin != null ? admin.getEmail() : "admin@" + h.getSlug() + ".com",
                    admin != null ? admin.getFullName() : "Hospital Administrator",
                    doctorCount,
                    sessionCount,
                    h.getCreatedAt()
            ));
        }

        return ResponseEntity.ok(ApiResponse.ok("HOSPITALS_FETCHED", "All registered hospital tenants retrieved.", dtos));
    }

    @PutMapping("/hospitals/{hospitalId}")
    @Transactional
    @Operation(summary = "Update hospital details by Super Admin")
    public ResponseEntity<ApiResponse<HospitalAdminSummaryDto>> updateHospital(
            @PathVariable UUID hospitalId,
            @Valid @RequestBody HospitalAdminUpdateRequest request) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found with ID: " + hospitalId));

        hospital.setName(request.getName().trim());
        if (request.getAddress() != null) hospital.setAddress(request.getAddress().trim());
        if (request.getPhone() != null) hospital.setPhone(request.getPhone().trim());
        if (request.getStatus() != null) hospital.setStatus(request.getStatus());
        if (request.getAccessCode() != null && !request.getAccessCode().isBlank()) {
            hospital.setAccessCode(request.getAccessCode().trim());
        }

        hospitalRepository.save(hospital);
        return ResponseEntity.ok(ApiResponse.ok("HOSPITAL_UPDATED", "Hospital details updated successfully.", mapToDto(hospital)));
    }

    @DeleteMapping("/hospitals/{hospitalId}")
    @Transactional
    @Operation(summary = "Permanently remove a registered hospital tenant and all associated data")
    public ResponseEntity<ApiResponse<Void>> deleteHospital(@PathVariable UUID hospitalId) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found with ID: " + hospitalId));

        String name = hospital.getName();
        hospitalRepository.deleteHospitalById(hospitalId);

        return ResponseEntity.ok(ApiResponse.ok("HOSPITAL_DELETED", "Hospital '" + name + "' permanently removed successfully.", null));
    }

    private HospitalAdminSummaryDto mapToDto(Hospital h) {
        HospitalUser admin = userRepository.findFirstByHospitalIdAndRole(h.getId(), Role.HOSPITAL_ADMIN).orElse(null);
        long doctorCount = doctorRepository.countByHospitalId(h.getId());
        long sessionCount = sessionRepository.countByHospitalIdAndSessionDate(h.getId(), LocalDate.now(IST_ZONE));

        return new HospitalAdminSummaryDto(
                h.getId(),
                h.getName(),
                h.getSlug(),
                h.getAccessCode(),
                h.getAddress(),
                h.getPhone(),
                h.getStatus(),
                admin != null ? admin.getEmail() : "admin@" + h.getSlug() + ".com",
                admin != null ? admin.getFullName() : "Hospital Administrator",
                doctorCount,
                sessionCount,
                h.getCreatedAt()
        );
    }
}
