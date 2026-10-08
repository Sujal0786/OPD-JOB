package com.citycare.platform.modules.queue;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OpdTokenRepository extends JpaRepository<OpdToken, UUID> {

    Optional<OpdToken> findByBookingReference(String bookingReference);

    Optional<OpdToken> findByIdempotencyKey(String idempotencyKey);

    boolean existsByIdempotencyKey(String idempotencyKey);

    List<OpdToken> findAllByOpdSessionIdOrderByTokenNumberAsc(UUID opdSessionId);

    Optional<OpdToken> findByOpdSessionIdAndTokenNumber(UUID opdSessionId, int tokenNumber);

    int countByOpdSessionIdAndStatus(UUID opdSessionId, TokenStatus status);

    @Query("""
        SELECT t FROM OpdToken t
        WHERE t.hospital.id = :hospitalId
          AND t.patientPhone = :patientPhone
          AND t.opdSession.sessionDate = CURRENT_DATE
        ORDER BY t.createdAt DESC
    """)
    List<OpdToken> findTodayTokensByPhone(@Param("hospitalId") UUID hospitalId, @Param("patientPhone") String patientPhone);

    @Query("SELECT COUNT(t) FROM OpdToken t WHERE t.opdSession.id = :sessionId AND t.tokenNumber < :tokenNumber AND t.status IN :statuses")
    int countTokensAhead(@Param("sessionId") UUID sessionId,
                         @Param("tokenNumber") int tokenNumber,
                         @Param("statuses") Collection<TokenStatus> statuses);

    @Query("""
        SELECT t FROM OpdToken t
        WHERE t.hospital.id = :hospitalId
          AND t.opdSession.id = :sessionId
          AND (
            :query IS NULL OR :query = ''
            OR (t.patientName IS NOT NULL AND LOWER(t.patientName) LIKE LOWER(CONCAT('%', :query, '%')))
            OR (t.patientPhone IS NOT NULL AND t.patientPhone LIKE CONCAT('%', :query, '%'))
            OR (t.patientLocation IS NOT NULL AND LOWER(t.patientLocation) LIKE LOWER(CONCAT('%', :query, '%')))
            OR (t.bookingReference IS NOT NULL AND LOWER(t.bookingReference) LIKE LOWER(CONCAT('%', :query, '%')))
            OR CAST(t.tokenNumber AS string) LIKE CONCAT('%', :query, '%')
          )
        ORDER BY t.tokenNumber ASC
    """)
    Page<OpdToken> searchTokensBySession(@Param("hospitalId") UUID hospitalId,
                                         @Param("sessionId") UUID sessionId,
                                         @Param("query") String query,
                                         Pageable pageable);

    @Query("""
        SELECT t FROM OpdToken t
        WHERE t.hospital.id = :hospitalId
          AND (
            :query IS NULL OR :query = ''
            OR (t.patientName IS NOT NULL AND LOWER(t.patientName) LIKE LOWER(CONCAT('%', :query, '%')))
            OR (t.patientPhone IS NOT NULL AND t.patientPhone LIKE CONCAT('%', :query, '%'))
            OR (t.patientLocation IS NOT NULL AND LOWER(t.patientLocation) LIKE LOWER(CONCAT('%', :query, '%')))
            OR (t.bookingReference IS NOT NULL AND LOWER(t.bookingReference) LIKE LOWER(CONCAT('%', :query, '%')))
            OR CAST(t.tokenNumber AS string) LIKE CONCAT('%', :query, '%')
          )
        ORDER BY t.createdAt DESC
    """)
    Page<OpdToken> searchTokensAll(@Param("hospitalId") UUID hospitalId,
                                   @Param("query") String query,
                                   Pageable pageable);

    Optional<OpdToken> findByIdAndHospitalId(UUID id, UUID hospitalId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM OpdToken t WHERE t.hospital.id = :hospitalId AND t.createdAt < :cutoff")
    int deleteOldTokensByHospital(@Param("hospitalId") UUID hospitalId, @Param("cutoff") java.time.Instant cutoff);
}
