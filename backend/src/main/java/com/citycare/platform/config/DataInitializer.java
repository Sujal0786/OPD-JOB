package com.citycare.platform.config;

import com.citycare.platform.modules.auth.HospitalUser;
import com.citycare.platform.modules.auth.HospitalUserRepository;
import com.citycare.platform.modules.auth.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Production Initializer:
 * Bootstraps only the Master Platform Administrator if none exists.
 * All hospital tenants, doctors, staff, sessions, and tokens are onboarded
 * purely through dynamic APIs.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final HospitalUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.default-email:${SUPERADMIN_EMAIL:superadmin@citycare.com}}")
    private String defaultAdminEmail;

    @Value("${admin.default-password:${SUPERADMIN_PASSWORD:Admin@1234}}")
    private String defaultAdminPassword;

    public DataInitializer(
            HospitalUserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        String adminEmail = defaultAdminEmail.trim().toLowerCase();

        // Ensure Platform Master Super Admin account exists
        if (!userRepository.existsByEmail(adminEmail)) {
            HospitalUser superAdmin = new HospitalUser(
                    UUID.randomUUID(),
                    null,
                    adminEmail,
                    passwordEncoder.encode(defaultAdminPassword),
                    "Platform Master Administrator",
                    Role.SUPER_ADMIN
            );
            userRepository.save(superAdmin);
            log.info("Master Platform Super Admin initialized successfully: {}", adminEmail);
        } else {
            log.info("Platform Super Admin already initialized.");
        }
    }
}
