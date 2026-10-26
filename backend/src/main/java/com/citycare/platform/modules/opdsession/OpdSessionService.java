package com.citycare.platform.modules.opdsession;

import com.citycare.platform.common.exception.BusinessException;
import com.citycare.platform.common.exception.DoctorNotFoundException;
import com.citycare.platform.common.exception.HospitalNotFoundException;
import com.citycare.platform.common.exception.ResourceNotFoundException;
import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.doctor.Doctor;
import com.citycare.platform.modules.doctor.DoctorRepository;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.queue.OpdSessionQueue;
import com.citycare.platform.modules.queue.OpdSessionQueueRepository;
import com.citycare.platform.modules.queue.OpdTokenRepository;
import com.citycare.platform.modules.queue.TokenStatus;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OpdSessionService {

    private final OpdSessionRepository sessionRepository;
    private final OpdSessionQueueRepository queueRepository;
    private final OpdTokenRepository tokenRepository;
    private final DoctorRepository doctorRepository;
    private final HospitalRepository hospitalRepository;
    private final TenantSecurityValidator tenantValidator;
    private final AuditLogService auditLogService;

    public OpdSessionService(
            OpdSessionRepository sessionRepository,
            OpdSessionQueueRepository queueRepository,
            OpdTokenRepository tokenRepository,
            DoctorRepository doctorRepository,
            HospitalRepository hospitalRepository,
            TenantSecurityValidator tenantValidator,
            AuditLogService auditLogService) {
        this.sessionRepository = sessionRepository;
        this.queueRepository = queueRepository;
        this.tokenRepository = tokenRepository;
        this.doctorRepository = doctorRepository;
        this.hospitalRepository = hospitalRepository;
        this.tenantValidator = tenantValidator;
        this.auditLogService = auditLogService;
    }

    private static final java.time.ZoneId IST_ZONE = java.time.ZoneId.of("Asia/Kolkata");

    private LocalDate getTodayIst() {
        return LocalDate.now(IST_ZONE);
    }

    /**
     * Read-only session listing for a specific date.
     * Guaranteed zero mutation / write side-effects on GET.
     */
    @Transactional(readOnly = true)
    public List<OpdSessionDto> getSessionsForDate(UUID hospitalId, LocalDate date) {
        tenantValidator.validateHospitalAccess(hospitalId);
        List<OpdSession> sessions = sessionRepository.findAllByHospitalIdAndSessionDateWithDoctorAndHospital(hospitalId, date);
        return mapToDtos(sessions);
    }

    /**
     * Read-only public listing of today's sessions for active doctors.
     * Guaranteed zero mutation / write side-effects on GET.
     */
    @Transactional(readOnly = true)
    public List<OpdSessionDto> getPublicTodaySessions(UUID hospitalId) {
        LocalDate today = getTodayIst();
        List<OpdSession> sessions = sessionRepository.findPublicByHospitalIdAndSessionDateWithDoctorAndHospital(hospitalId, today);
        return mapToDtos(sessions);
    }

    /**
     * Explicit, idempotent provisioning workflow for hospital staff to initialize today's sessions.
     * Serialized with pessimistic lock to prevent concurrent slot conflicts.
     */
    @Transactional
    public List<OpdSessionDto> provisionTodaySessions(UUID hospitalId) {
        tenantValidator.validateHospitalAccess(hospitalId);
        LocalDate today = getTodayIst();
        provisionSessionsForActiveDoctors(hospitalId, today);
        return getSessionsForDate(hospitalId, today);
    }

    @Transactional
    public void provisionSessionsForActiveDoctors(UUID hospitalId, LocalDate sessionDate) {
        // 1. Serialize concurrent provisioning attempts for this hospital
        Hospital hospital = hospitalRepository.findByIdForUpdate(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));

        List<Doctor> activeDoctors = doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId);
        List<OpdSession> currentSessions = new ArrayList<>(sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, sessionDate));

        for (Doctor d : activeDoctors) {
            // 1. Morning Session (09:00 - 14:00, default OPEN)
            ensureDoctorSlot(hospital, d, sessionDate, "MORNING OPD",
                    LocalTime.of(9, 0), LocalTime.of(14, 0), OpdSessionStatus.OPEN, currentSessions);

            // 2. Evening Session (17:00 - 19:00, default PAUSED until doctor enables it)
            ensureDoctorSlot(hospital, d, sessionDate, "EVENING OPD",
                    LocalTime.of(17, 0), LocalTime.of(19, 0), OpdSessionStatus.PAUSED, currentSessions);
        }
    }

    private void ensureDoctorSlot(
            Hospital hospital,
            Doctor doctor,
            LocalDate sessionDate,
            String slotName,
            LocalTime startTime,
            LocalTime endTime,
            OpdSessionStatus defaultStatus,
            List<OpdSession> currentSessions) {

        String keyword = slotName.replace(" OPD", "");
        boolean exists = currentSessions.stream()
                .anyMatch(s -> s.getDoctor().getId().equals(doctor.getId())
                        && s.getSessionName() != null
                        && s.getSessionName().toUpperCase().contains(keyword));

        if (!exists) {
            var existing = sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
                    hospital.getId(), doctor.getId(), sessionDate, slotName);
            if (existing.isPresent()) {
                OpdSession sess = existing.get();
                ensureQueueExists(sess, hospital);
                currentSessions.add(sess);
            } else {
                OpdSession newSession = new OpdSession(
                        null,
                        hospital,
                        doctor,
                        sessionDate,
                        slotName,
                        startTime,
                        endTime,
                        defaultStatus
                );
                sessionRepository.save(newSession);
                ensureQueueExists(newSession, hospital);
                currentSessions.add(newSession);
            }
        } else {
            currentSessions.stream()
                    .filter(s -> s.getDoctor().getId().equals(doctor.getId())
                            && s.getSessionName() != null
                            && s.getSessionName().toUpperCase().contains(keyword))
                    .findFirst()
                    .ifPresent(s -> ensureQueueExists(s, hospital));
        }
    }

    private void ensureQueueExists(OpdSession session, Hospital hospital) {
        if (queueRepository.findByOpdSessionId(session.getId()).isEmpty()) {
            OpdSessionQueue queue = new OpdSessionQueue(null, session, hospital);
            queueRepository.save(queue);
        }
    }

    @Transactional
    public OpdSessionDto createSession(UUID hospitalId, OpdSessionCreateRequest request) {
        tenantValidator.validateHospitalAccess(hospitalId);

        Hospital hospital = hospitalRepository.findByIdForUpdate(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));

        Doctor doctor = doctorRepository.findByIdAndHospitalId(request.getDoctorId(), hospitalId)
                .orElseThrow(() -> new DoctorNotFoundException("Doctor not found in this hospital."));

        if (!doctor.isActive()) {
            throw new BusinessException("DOCTOR_INACTIVE", "Cannot create session for inactive doctor.");
        }

        String sessionName = request.getSessionName().trim().toUpperCase();
        if (sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
                hospitalId, doctor.getId(), request.getSessionDate(), sessionName).isPresent()) {
            throw new BusinessException("DUPLICATE_SESSION", "An OPD session already exists for this doctor on "
                    + request.getSessionDate() + " with slot " + sessionName);
        }

        OpdSession session = new OpdSession(
                null,
                hospital,
                doctor,
                request.getSessionDate(),
                sessionName,
                request.getStartTime(),
                request.getEndTime(),
                OpdSessionStatus.OPEN
        );
        sessionRepository.save(session);

        // Initialize dedicated session queue
        OpdSessionQueue queue = new OpdSessionQueue(null, session, hospital);
        queueRepository.save(queue);

        auditLogService.record(hospital, null, "OPD_SESSION_CREATED", "OpdSession", session.getId().toString(), null,
                "{\"doctor\":\"" + doctor.getName() + "\",\"slot\":\"" + sessionName + "\"}");

        return mapToDto(session);
    }

    @Transactional
    public OpdSessionDto updateSessionStatus(UUID hospitalId, UUID sessionId, OpdSessionStatus status) {
        tenantValidator.validateHospitalAccess(hospitalId);

        OpdSession session = sessionRepository.findByIdAndHospitalId(sessionId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("OPD Session not found."));

        // If activating a shift, ensure the other shift for this doctor on the same date is not left OPEN
        if (status == OpdSessionStatus.OPEN && session.getSessionName() != null) {
            boolean isEvening = session.getSessionName().toUpperCase().contains("EVENING");
            List<OpdSession> docSessions = sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, session.getSessionDate());
            for (OpdSession other : docSessions) {
                if (other.getDoctor().getId().equals(session.getDoctor().getId()) && !other.getId().equals(session.getId())) {
                    if (isEvening && other.getStatus() == OpdSessionStatus.OPEN) {
                        other.setStatus(OpdSessionStatus.CLOSED);
                        sessionRepository.save(other);
                    } else if (!isEvening && other.getStatus() == OpdSessionStatus.OPEN) {
                        other.setStatus(OpdSessionStatus.PAUSED);
                        sessionRepository.save(other);
                    }
                }
            }
        }

        session.setStatus(status);
        sessionRepository.save(session);

        auditLogService.record(session.getHospital(), null, "OPD_SESSION_STATUS_CHANGED", "OpdSession",
                sessionId.toString(), null, "{\"status\":\"" + status + "\"}");

        return mapToDto(session);
    }

    @Transactional(readOnly = true)
    public OpdSession getSessionEntity(UUID hospitalId, UUID sessionId) {
        return sessionRepository.findByIdAndHospitalId(sessionId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("OPD Session not found."));
    }

    public OpdSessionDto mapToDto(OpdSession s) {
        return mapToDtos(List.of(s)).get(0);
    }

    /**
     * Batch maps a list of OpdSession entities to OpdSessionDto objects with O(1) query complexity:
     * - 1 batch query for all session queues
     * - 1 batch aggregate query for grouped token counts (WAITING & COMPLETED)
     * Completely eliminates the 1 + 4N query cascade.
     */
    public List<OpdSessionDto> mapToDtos(List<OpdSession> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return Collections.emptyList();
        }

        List<UUID> sessionIds = sessions.stream().map(OpdSession::getId).toList();

        // 1. Batch fetch queues for all sessions
        Map<UUID, OpdSessionQueue> queueMap = queueRepository.findAllBySessionIds(sessionIds).stream()
                .collect(Collectors.toMap(q -> q.getOpdSession().getId(), q -> q, (existing, replacement) -> existing));

        // 2. Batch fetch token counts by session and status
        Map<UUID, Map<TokenStatus, Integer>> countMap = new HashMap<>();
        List<Object[]> counts = tokenRepository.countTokensBySessionIdsAndStatuses(
                sessionIds, List.of(TokenStatus.WAITING, TokenStatus.COMPLETED));
        for (Object[] row : counts) {
            UUID sId = (UUID) row[0];
            TokenStatus status = (TokenStatus) row[1];
            int count = ((Number) row[2]).intValue();
            countMap.computeIfAbsent(sId, k -> new EnumMap<>(TokenStatus.class)).put(status, count);
        }

        // 3. Assemble DTOs in memory
        List<OpdSessionDto> dtos = new ArrayList<>(sessions.size());
        for (OpdSession s : sessions) {
            OpdSessionQueue queue = queueMap.get(s.getId());
            Integer currentServing = queue != null ? queue.getCurrentServingToken() : null;
            int nextSeq = queue != null ? queue.getNextTokenSequence() : 1;
            int online = queue != null ? queue.getTotalOnlineCount() : 0;
            int walkins = queue != null ? queue.getTotalWalkinCount() : 0;

            Map<TokenStatus, Integer> statusCounts = countMap.get(s.getId());
            int waiting = (statusCounts != null && statusCounts.containsKey(TokenStatus.WAITING)) ? statusCounts.get(TokenStatus.WAITING) : 0;
            int completed = (statusCounts != null && statusCounts.containsKey(TokenStatus.COMPLETED)) ? statusCounts.get(TokenStatus.COMPLETED) : 0;

            dtos.add(OpdSessionDto.fromEntity(s, currentServing, nextSeq, waiting, completed, online, walkins));
        }

        return dtos;
    }
}
