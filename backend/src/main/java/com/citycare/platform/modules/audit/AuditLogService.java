package com.citycare.platform.modules.audit;

import com.citycare.platform.modules.hospital.Hospital;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Hospital hospital, String actorId, String action,
                       String entityType, String entityId, String ipAddress, String metadataJson) {
        try {
            String traceId = MDC.get("traceId");
            AuditLog auditLog = new AuditLog(traceId, hospital, actorId, action, entityType, entityId, ipAddress, metadataJson);
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to persist audit log for action: {}", action, e);
        }
    }
}
