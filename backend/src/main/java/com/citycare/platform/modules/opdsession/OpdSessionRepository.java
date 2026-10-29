package com.citycare.platform.modules.opdsession;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OpdSessionRepository extends JpaRepository<OpdSession, UUID> {
    List<OpdSession> findAllByHospitalIdAndSessionDate(UUID hospitalId, LocalDate sessionDate);

    @org.springframework.data.jpa.repository.Query("""
        SELECT s FROM OpdSession s
        JOIN FETCH s.doctor d
        JOIN FETCH s.hospital h
        WHERE h.id = :hospitalId AND s.sessionDate = :sessionDate
    """)
    List<OpdSession> findAllByHospitalIdAndSessionDateWithDoctorAndHospital(
            @org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId,
            @org.springframework.data.repository.query.Param("sessionDate") LocalDate sessionDate);

    @org.springframework.data.jpa.repository.Query("""
        SELECT s FROM OpdSession s
        JOIN FETCH s.doctor d
        JOIN FETCH s.hospital h
        WHERE h.id = :hospitalId AND s.sessionDate = :sessionDate AND d.active = true
    """)
    List<OpdSession> findPublicByHospitalIdAndSessionDateWithDoctorAndHospital(
            @org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId,
            @org.springframework.data.repository.query.Param("sessionDate") LocalDate sessionDate);

    List<OpdSession> findAllByHospitalIdAndDoctorIdAndSessionDate(UUID hospitalId, UUID doctorId, LocalDate sessionDate);
    Optional<OpdSession> findByIdAndHospitalId(UUID id, UUID hospitalId);

    @org.springframework.data.jpa.repository.Query("""
        SELECT s FROM OpdSession s
        JOIN FETCH s.doctor d
        JOIN FETCH s.hospital h
        WHERE s.id = :id AND h.id = :hospitalId
    """)
    Optional<OpdSession> findByIdAndHospitalIdWithDoctorAndHospital(
            @org.springframework.data.repository.query.Param("id") UUID id,
            @org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId);

    Optional<OpdSession> findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
            UUID hospitalId, UUID doctorId, LocalDate sessionDate, String sessionName);

    @org.springframework.data.jpa.repository.Query("SELECT s.hospital.id, COUNT(s) FROM OpdSession s WHERE s.sessionDate = :sessionDate GROUP BY s.hospital.id")
    List<Object[]> countSessionsGroupedByHospitalAndDate(@org.springframework.data.repository.query.Param("sessionDate") LocalDate sessionDate);

    long countByHospitalIdAndSessionDate(UUID hospitalId, LocalDate sessionDate);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM OpdSession s WHERE s.hospital.id = :hospitalId AND s.sessionDate < :cutoffDate")
    int deleteOldSessionsByHospital(@org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId,
                                    @org.springframework.data.repository.query.Param("cutoffDate") LocalDate cutoffDate);
}
