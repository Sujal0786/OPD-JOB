package com.citycare.platform.modules.hospital;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface HospitalRepository extends JpaRepository<Hospital, UUID> {
    Optional<Hospital> findBySlug(String slug);
    Optional<Hospital> findByAccessCode(String accessCode);
    boolean existsBySlug(String slug);
    boolean existsByAccessCode(String accessCode);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM Hospital h WHERE h.id = :id")
    int deleteHospitalById(@org.springframework.data.repository.query.Param("id") UUID id);
}
