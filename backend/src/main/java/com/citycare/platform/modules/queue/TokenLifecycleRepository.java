package com.citycare.platform.modules.queue;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TokenLifecycleRepository extends JpaRepository<TokenLifecycle, Long> {
    List<TokenLifecycle> findAllByOpdTokenIdOrderByCreatedAtAsc(java.util.UUID opdTokenId);
}
