package com.citycare.platform.modules.queue;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OpdSessionQueueRepository extends JpaRepository<OpdSessionQueue, UUID> {

    Optional<OpdSessionQueue> findByOpdSessionId(UUID opdSessionId);

    /**
     * Acquires a pessimistic write lock (SELECT ... FOR UPDATE) on the queue row.
     * This coordinates all concurrent online and walk-in token allocation transactions.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM OpdSessionQueue q WHERE q.opdSession.id = :sessionId")
    Optional<OpdSessionQueue> findAndLockBySessionId(@Param("sessionId") UUID sessionId);
}
