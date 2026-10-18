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
import java.util.List;
import java.util.UUID;

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

    @Transactional
    public List<OpdSessionDto> getSessionsForDate(UUID hospitalId, LocalDate date) {
        tenantValidator.validateHospitalAccess(hospitalId);
        List<OpdSession> sessions = new java.util.ArrayList<>(sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, date));
        LocalDate today = getTodayIst();
        if (date.equals(today)) {
            ensureSessionsForActiveDoctors(hospitalId, date, sessions);
        }
        return sessions.stream().map(this::mapToDto).toList();
    }

    @Transactional
    public List<OpdSessionDto> getPublicTodaySessions(UUID hospitalId) {
        LocalDate today = getTodayIst();
        List<OpdSession> sessions = new java.util.ArrayList<>(sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, today));
        ensureSessionsForActiveDoctors(hospitalId, today, sessions);
        return sessions.stream()
                .filter(s -> s.getDoctor().isActive())
                .map(this::mapToDto)
                .toList();
    }

    private void ensureSessionsForActiveDoctors(UUID hospitalId, LocalDate sessionDate, List<OpdSession> currentSessions) {
        List<Doctor> activeDoctors = doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId);
        Hospital hospital = null;

        for (Doctor d : activeDoctors) {
            // 1. Ensure Morning Session (09:00 - 14:00, default OPEN)
            boolean hasMorning = currentSessions.stream()
                    .anyMatch(s -> s.getDoctor().getId().equals(d.getId())
                            && s.getSessionName() != null
                            && s.getSessionName().toUpperCase().contains("MORNING"));

            if (!hasMorning) {
                var existing = sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
                        hospitalId, d.getId(), sessionDate, "MORNING OPD");
                if (existing.isPresent()) {
                    var sess = existing.get();
                    if (queueRepository.findByOpdSessionId(sess.getId()).isEmpty()) {
                        OpdSessionQueue queue = new OpdSessionQueue(null, sess, sess.getHospital());
                        queueRepository.save(queue);
                    }
                    currentSessions.add(sess);
                } else {
                    if (hospital == null) {
                        hospital = hospitalRepository.findById(hospitalId).orElse(null);
                        if (hospital == null) return;
                    }
                    OpdSession newMorning = new OpdSession(
                            null,
                            hospital,
                            d,
                            sessionDate,
                            "MORNING OPD",
                            java.time.LocalTime.of(9, 0),
                            java.time.LocalTime.of(14, 0),
                            OpdSessionStatus.OPEN
                    );
                    sessionRepository.save(newMorning);
                    OpdSessionQueue queue = new OpdSessionQueue(null, newMorning, hospital);
                    queueRepository.save(queue);
                    currentSessions.add(newMorning);
                }
            }

            // 2. Ensure Evening Session (17:00 - 19:00, default PAUSED until doctor enables it)
            boolean hasEvening = currentSessions.stream()
                    .anyMatch(s -> s.getDoctor().getId().equals(d.getId())
                            && s.getSessionName() != null
                            && s.getSessionName().toUpperCase().contains("EVENING"));

            if (!hasEvening) {
                var existing = sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
                        hospitalId, d.getId(), sessionDate, "EVENING OPD");
                if (existing.isPresent()) {
                    var sess = existing.get();
                    if (queueRepository.findByOpdSessionId(sess.getId()).isEmpty()) {
                        OpdSessionQueue queue = new OpdSessionQueue(null, sess, sess.getHospital());
                        queueRepository.save(queue);
                    }
                    currentSessions.add(sess);
                } else {
                    if (hospital == null) {
                        hospital = hospitalRepository.findById(hospitalId).orElse(null);
                        if (hospital == null) return;
                    }
                    OpdSession newEvening = new OpdSession(
                            null,
                            hospital,
                            d,
                            sessionDate,
                            "EVENING OPD",
                            java.time.LocalTime.of(17, 0),
                            java.time.LocalTime.of(19, 0),
                            OpdSessionStatus.PAUSED
                    );
                    sessionRepository.save(newEvening);
                    OpdSessionQueue queue = new OpdSessionQueue(null, newEvening, hospital);
                    queueRepository.save(queue);
                    currentSessions.add(newEvening);
                }
            }
        }
    }

    @Transactional
    public OpdSessionDto createSession(UUID hospitalId, OpdSessionCreateRequest request) {
        tenantValidator.validateHospitalAccess(hospitalId);

        Hospital hospital = hospitalRepository.findById(hospitalId)
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

    private OpdSessionDto mapToDto(OpdSession s) {
        OpdSessionQueue queue = queueRepository.findByOpdSessionId(s.getId()).orElse(null);
        Integer currentServing = queue != null ? queue.getCurrentServingToken() : null;
        int nextSeq = queue != null ? queue.getNextTokenSequence() : 1;
        int online = queue != null ? queue.getTotalOnlineCount() : 0;
        int walkins = queue != null ? queue.getTotalWalkinCount() : 0;

        int waiting = tokenRepository.countByOpdSessionIdAndStatus(s.getId(), TokenStatus.WAITING);
        int completed = tokenRepository.countByOpdSessionIdAndStatus(s.getId(), TokenStatus.COMPLETED);

        return OpdSessionDto.fromEntity(s, currentServing, nextSeq, waiting, completed, online, walkins);
    }
}
