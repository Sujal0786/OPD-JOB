package com.citycare.platform.modules.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HospitalUserRepository extends JpaRepository<HospitalUser, UUID> {
    Optional<HospitalUser> findByEmail(String email);
    List<HospitalUser> findAllByHospitalId(UUID hospitalId);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM HospitalUser u JOIN FETCH u.hospital WHERE u.role = :role")
    List<HospitalUser> findAllByRoleWithHospital(@Param("role") Role role);

    Optional<HospitalUser> findFirstByHospitalIdAndRole(UUID hospitalId, Role role);
}
