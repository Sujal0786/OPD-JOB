package com.citycare.platform.modules.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HospitalUserRepository extends JpaRepository<HospitalUser, UUID> {
    Optional<HospitalUser> findByEmail(String email);
    List<HospitalUser> findAllByHospitalId(UUID hospitalId);
    boolean existsByEmail(String email);
}
