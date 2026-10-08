package com.citycare.platform.modules.queue;

import com.citycare.platform.common.exception.*;
import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.auth.HospitalUser;
import com.citycare.platform.modules.auth.HospitalUserRepository;
import com.citycare.platform.modules.billing.BillingService;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.hospital.HospitalStatus;
import com.citycare.platform.modules.opdsession.OpdSession;
import com.citycare.platform.modules.opdsession.OpdSessionRepository;
import com.citycare.platform.modules.opdsession.OpdSessionStatus;
import com.citycare.platform.modules.doctor.Doctor;
import com.citycare.platform.modules.doctor.DoctorRepository;
import com.citycare.platform.modules.notification.SmsNotificationService;
import com.citycare.platform.security.UserPrincipal;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Service
public class QueueService {

    private final OpdSessionQueueRepository queueRepository;
    private final OpdTokenRepository tokenRepository;
    private final TokenLifecycleRepository lifecycleRepository;
    private final OpdSessionRepository sessionRepository;
    private final HospitalRepository hospitalRepository;
    private final DoctorRepository doctorRepository;
    private final HospitalUserRepository userRepository;
    private final TenantSecurityValidator tenantValidator;
    private final AuditLogService auditLogService;
    private final BillingService billingService;
    private final QueueEventBroadcaster broadcaster;
    private final SmsNotificationService smsNotificationService;

    public QueueService(
            OpdSessionQueueRepository queueRepository,
            OpdTokenRepository tokenRepository,
            TokenLifecycleRepository lifecycleRepository,
            OpdSessionRepository sessionRepository,
            HospitalRepository hospitalRepository,
            DoctorRepository doctorRepository,
            HospitalUserRepository userRepository,
            TenantSecurityValidator tenantValidator,
            AuditLogService auditLogService,
            BillingService billingService,
            QueueEventBroadcaster broadcaster,
            SmsNotificationService smsNotificationService) {
        this.queueRepository = queueRepository;
        this.tokenRepository = tokenRepository;
        this.lifecycleRepository = lifecycleRepository;
        this.sessionRepository = sessionRepository;
        this.hospitalRepository = hospitalRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.tenantValidator = tenantValidator;
        this.auditLogService = auditLogService;
        this.billingService = billingService;
        this.broadcaster = broadcaster;
        this.smsNotificationService = smsNotificationService;
    }

    /**
     * Concurrency-safe online token generation with DB-level pessimistic locking and idempotency.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TokenResponse allocateOnlineToken(OnlineTokenRequest request) {
        // 1. Idempotency Check: if identical key exists, return previous result immediately
        if (StringUtils.hasText(request.getIdempotencyKey())) {
            Optional<OpdToken> existing = tokenRepository.findByIdempotencyKey(request.getIdempotencyKey().trim());
            if (existing.isPresent()) {
                return buildTokenResponse(existing.get());
            }
        }

        // 2. Validate Hospital & Session state
        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .filter(h -> h.getStatus() == HospitalStatus.ACTIVE)
                .orElseThrow(() -> new HospitalNotFoundException("Active hospital not found."));

        OpdSession session = sessionRepository.findByIdAndHospitalId(request.getOpdSessionId(), hospital.getId())
                .orElseThrow(() -> new ResourceNotFoundException("OPD Session not found."));

        if (session.getStatus() != OpdSessionStatus.OPEN) {
            throw new OpdSessionClosedException("OPD session is currently " + session.getStatus() + ". Booking is not allowed.");
        }

        if (!session.getDoctor().isActive()) {
            throw new DoctorNotAvailableException("Doctor is currently inactive.");
        }

        // 3. Acquire Pessimistic Write Lock on Session Queue
        OpdSessionQueue queue = queueRepository.findAndLockBySessionId(session.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Session queue not initialized."));

        int assignedNumber = queue.getNextTokenSequence();
        queue.setNextTokenSequence(assignedNumber + 1);
        queue.setTotalOnlineCount(queue.getTotalOnlineCount() + 1);
        queueRepository.save(queue);

        // 4. Generate unguessable booking reference
        String bookingRef = UUID.randomUUID().toString().replace("-", "");

        OpdToken token = new OpdToken(
                null,
                hospital,
                session,
                assignedNumber,
                TokenType.ONLINE,
                bookingRef,
                TokenStatus.WAITING,
                request.getPatientName().trim(),
                request.getPatientPhone().trim(),
                request.getPatientAge(),
                request.getPatientGender(),
                request.getReasonForVisit(),
                null,
                StringUtils.hasText(request.getIdempotencyKey()) ? request.getIdempotencyKey().trim() : null
        );
        token.setPatientLocation(StringUtils.hasText(request.getPatientLocation()) ? request.getPatientLocation().trim() : null);
        tokenRepository.save(token);

        // 5. Record lifecycle transition
        TokenLifecycle lifecycle = new TokenLifecycle(token, TokenStatus.CREATED, TokenStatus.WAITING, null, "Online booking created");
        lifecycleRepository.save(lifecycle);

        // 6. Record billing ledger entry
        billingService.recordTokenBilling(token);

        TokenResponse response = buildTokenResponse(token);

        // 7. Dispatch SMS Notification to patient mobile
        try {
            SmsNotificationService.SmsDeliveryResult sms = smsNotificationService.sendTokenConfirmationSms(
                    token,
                    hospital.getName(),
                    response.getCurrentServingToken(),
                    response.getTokensAhead()
            );
            token.setSmsSent(sms.isDelivered());
            token.setSmsError(sms.isDelivered() ? null : sms.getErrorMessage());
            tokenRepository.save(token);

            response.setSmsSent(sms.isDelivered());
            response.setSmsMessage(sms.getMessageText());
            response.setSmsError(sms.getErrorMessage());
        } catch (Exception e) {
            token.setSmsSent(false);
            token.setSmsError(e.getMessage());
            tokenRepository.save(token);

            response.setSmsSent(false);
            response.setSmsError(e.getMessage());
            // SMS dispatch failure does not abort token booking
        }

        // 8. Broadcast live update to staff dashboard and patient
        broadcaster.broadcastSessionUpdate(session.getId(), response);

        return response;
    }

    /**
     * Core Walk-In Allocation: allows reception to add 1..N walk-in physical patients atomically.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public List<TokenResponse> allocateWalkInBatch(UUID hospitalId, WalkInBatchRequest request, UserPrincipal staff) {
        tenantValidator.validateHospitalAccess(hospitalId);

        int count = request.getCount() != null ? request.getCount() : 0;
        if (count < 1 || count > 100) {
            throw new InvalidWalkInCountException("Walk-in count must be between 1 and 100.");
        }

        OpdSession session = sessionRepository.findByIdAndHospitalId(request.getOpdSessionId(), hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("OPD Session not found."));

        if (session.getStatus() != OpdSessionStatus.OPEN) {
            throw new OpdSessionClosedException("OPD Session is currently " + session.getStatus());
        }

        HospitalUser staffUser = staff != null ? userRepository.findById(staff.getId()).orElse(null) : null;

        // Acquire Pessimistic Write Lock on Session Queue
        OpdSessionQueue queue = queueRepository.findAndLockBySessionId(session.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Session queue not initialized."));

        int startNumber = queue.getNextTokenSequence();
        int endNumber = startNumber + count - 1;

        queue.setNextTokenSequence(endNumber + 1);
        queue.setTotalWalkinCount(queue.getTotalWalkinCount() + count);
        queueRepository.save(queue);

        List<OpdToken> tokens = new ArrayList<>(count);
        List<TokenLifecycle> lifecycles = new ArrayList<>(count);

        for (int num = startNumber; num <= endNumber; num++) {
            String bookingRef = UUID.randomUUID().toString().replace("-", "");
            OpdToken walkIn = new OpdToken(
                    null,
                    session.getHospital(),
                    session,
                    num,
                    TokenType.WALK_IN,
                    bookingRef,
                    TokenStatus.WAITING,
                    "Walk-in Patient #" + num,
                    null,
                    null,
                    null,
                    request.getNote(),
                    staffUser,
                    null
            );
            tokens.add(walkIn);
            lifecycles.add(new TokenLifecycle(walkIn, TokenStatus.CREATED, TokenStatus.WAITING, staffUser, "Walk-in batch allocation"));
        }

        tokenRepository.saveAll(tokens);
        lifecycleRepository.saveAll(lifecycles);

        for (OpdToken t : tokens) {
            billingService.recordTokenBilling(t);
        }

        auditLogService.record(
                session.getHospital(),
                staffUser != null ? staffUser.getId().toString() : "STAFF",
                "WALK_IN_BATCH_ADDED",
                "OpdSessionQueue",
                queue.getId().toString(),
                null,
                "{\"count\":" + count + ",\"startToken\":" + startNumber + ",\"endToken\":" + endNumber + "}"
        );

        List<TokenResponse> responses = tokens.stream().map(this::buildTokenResponse).toList();

        // Broadcast to live queue screen
        broadcaster.broadcastSessionUpdate(session.getId(), responses.get(responses.size() - 1));

        return responses;
    }

    /**
     * Advances or calls a token in the queue.
     */
    @Transactional
    public TokenResponse callToken(UUID hospitalId, UUID sessionId, int tokenNumber, UserPrincipal staff) {
        tenantValidator.validateHospitalAccess(hospitalId);

        OpdSession session = sessionRepository.findByIdAndHospitalId(sessionId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));

        OpdSessionQueue queue = queueRepository.findAndLockBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Queue not found."));

        OpdToken token = tokenRepository.findByOpdSessionIdAndTokenNumber(sessionId, tokenNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Token #" + tokenNumber + " not found in session."));

        if (!token.getStatus().canTransitionTo(TokenStatus.CALLED)) {
            throw new InvalidQueueStateTransitionException(
                    "Cannot transition token #" + tokenNumber + " from " + token.getStatus() + " to CALLED."
            );
        }

        TokenStatus previousStatus = token.getStatus();
        token.setStatus(TokenStatus.CALLED);
        tokenRepository.save(token);

        queue.setCurrentServingToken(tokenNumber);
        queueRepository.save(queue);

        HospitalUser staffUser = staff != null ? userRepository.findById(staff.getId()).orElse(null) : null;
        lifecycleRepository.save(new TokenLifecycle(token, previousStatus, TokenStatus.CALLED, staffUser, "Called for consultation"));

        TokenResponse response = buildTokenResponse(token);

        // Broadcast to both session board and individual patient screen
        broadcaster.broadcastSessionUpdate(sessionId, response);
        broadcaster.broadcastPatientUpdate(token.getBookingReference(), response);

        return response;
    }

    /**
     * Updates token lifecycle state with strict state machine verification.
     */
    @Transactional
    public TokenResponse updateTokenStatus(UUID hospitalId, UUID tokenId, TokenStatus newStatus, String reason, UserPrincipal staff) {
        tenantValidator.validateHospitalAccess(hospitalId);

        OpdToken token = tokenRepository.findByIdAndHospitalId(tokenId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Token not found in hospital."));

        TokenStatus previousStatus = token.getStatus();
        if (!previousStatus.canTransitionTo(newStatus)) {
            throw new InvalidQueueStateTransitionException(
                    "Invalid state transition from " + previousStatus + " to " + newStatus
            );
        }

        token.setStatus(newStatus);
        tokenRepository.save(token);

        HospitalUser staffUser = staff != null ? userRepository.findById(staff.getId()).orElse(null) : null;
        lifecycleRepository.save(new TokenLifecycle(token, previousStatus, newStatus, staffUser, reason));

        TokenResponse response = buildTokenResponse(token);

        broadcaster.broadcastSessionUpdate(token.getOpdSession().getId(), response);
        broadcaster.broadcastPatientUpdate(token.getBookingReference(), response);

        return response;
    }

    @Transactional(readOnly = true)
    public QueueBoardDto getQueueBoard(UUID hospitalId, UUID sessionId) {
        tenantValidator.validateHospitalAccess(hospitalId);

        OpdSession session = sessionRepository.findByIdAndHospitalId(sessionId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));

        return buildQueueBoardDto(session);
    }

    private QueueBoardDto buildQueueBoardDto(OpdSession session) {
        OpdSessionQueue queue = queueRepository.findByOpdSessionId(session.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Queue not initialized."));

        List<OpdToken> tokens = tokenRepository.findAllByOpdSessionIdOrderByTokenNumberAsc(session.getId());

        QueueBoardDto board = new QueueBoardDto();
        board.setSessionId(session.getId());
        board.setSessionName(session.getSessionName());
        board.setDoctorId(session.getDoctor().getId());
        board.setDoctorName(session.getDoctor().getName());
        board.setDoctorRoomNumber(session.getDoctor().getRoomNumber());
        board.setCurrentServingToken(queue.getCurrentServingToken());
        board.setNextTokenSequence(queue.getNextTokenSequence());
        board.setTotalOnlineCount(queue.getTotalOnlineCount());
        board.setTotalWalkinCount(queue.getTotalWalkinCount());

        Integer currentServing = queue.getCurrentServingToken();
        int avgWait = session.getDoctor().getAvgConsultationMinutes();

        int waitingCount = 0;
        int completedCount = 0;
        int precedingWaitingOrReceived = 0;
        List<TokenResponse> activeTokens = new ArrayList<>(tokens.size());

        for (OpdToken token : tokens) {
            TokenStatus status = token.getStatus();
            if (status == TokenStatus.WAITING) {
                waitingCount++;
            } else if (status == TokenStatus.COMPLETED) {
                completedCount++;
            }

            int tokensAhead = 0;
            if (status == TokenStatus.WAITING) {
                tokensAhead = precedingWaitingOrReceived;
            }

            if (status == TokenStatus.WAITING || status == TokenStatus.RECEIVED_BY_HOSPITAL) {
                precedingWaitingOrReceived++;
            }

            activeTokens.add(TokenResponse.fromEntity(token, session, currentServing, tokensAhead, avgWait));
        }

        board.setWaitingCount(waitingCount);
        board.setCompletedCount(completedCount);
        board.setActiveTokens(activeTokens);

        return board;
    }

    @Transactional(readOnly = true)
    public Page<TokenResponse> searchPatients(UUID hospitalId, UUID sessionId, String query, Pageable pageable) {
        tenantValidator.validateHospitalAccess(hospitalId);
        String trimmedQuery = query != null ? query.trim() : "";
        Page<OpdToken> page = (sessionId != null)
                ? tokenRepository.searchTokensBySession(hospitalId, sessionId, trimmedQuery, pageable)
                : tokenRepository.searchTokensAll(hospitalId, trimmedQuery, pageable);
        return page.map(this::buildTokenResponse);
    }

    @Transactional(readOnly = true)
    public TokenResponse getPatientTokenByReference(String bookingReference) {
        OpdToken token = tokenRepository.findByBookingReference(bookingReference)
                .orElseThrow(() -> new ResourceNotFoundException("Token not found with booking reference: " + bookingReference));
        return buildTokenResponse(token);
    }

    @Transactional(readOnly = true)
    public List<TokenResponse> getPatientTokensByPhone(UUID hospitalId, String phone) {
        if (!StringUtils.hasText(phone)) {
            throw new ResourceNotFoundException("Phone number is required.");
        }
        String cleanPhone = phone.trim().replaceAll("[^0-9]", "");
        List<OpdToken> tokens = tokenRepository.findTodayTokensByPhone(hospitalId, cleanPhone);
        if (tokens.isEmpty()) {
            throw new ResourceNotFoundException("No active token found for phone number " + phone + " today.");
        }
        return tokens.stream().map(this::buildTokenResponse).toList();
    }

    private TokenResponse buildTokenResponse(OpdToken token) {
        OpdSessionQueue queue = queueRepository.findByOpdSessionId(token.getOpdSession().getId()).orElse(null);
        Integer currentServing = queue != null ? queue.getCurrentServingToken() : null;

        int tokensAhead = 0;
        if (token.getStatus() == TokenStatus.WAITING) {
            tokensAhead = tokenRepository.countTokensAhead(
                    token.getOpdSession().getId(),
                    token.getTokenNumber(),
                    List.of(TokenStatus.WAITING, TokenStatus.RECEIVED_BY_HOSPITAL)
            );
        }

        int avgWait = token.getOpdSession().getDoctor().getAvgConsultationMinutes();
        return TokenResponse.fromEntity(token, currentServing, tokensAhead, avgWait);
    }

    @Transactional
    public QueueBoardDto getDoctorLiveQueue(UUID hospitalId, UUID doctorId) {
        tenantValidator.validateHospitalAccess(hospitalId);
        Doctor doctor = doctorRepository.findByIdAndHospitalId(doctorId, hospitalId)
                .orElseThrow(() -> new DoctorNotFoundException("Doctor not found in this hospital."));

        OpdSession session = resolveOrCreateTodayDoctorSession(hospitalId, doctor);
        return buildQueueBoardDto(session);
    }

    @Transactional
    public QueueBoardDto getDoctorLiveQueueByName(UUID hospitalId, String doctorName) {
        tenantValidator.validateHospitalAccess(hospitalId);
        List<Doctor> doctors = doctorRepository.findAllByHospitalIdAndNameContainingIgnoreCase(hospitalId, doctorName.trim());
        if (doctors.isEmpty()) {
            throw new DoctorNotFoundException("Doctor with name matching '" + doctorName + "' not found in this hospital.");
        }
        return getDoctorLiveQueue(hospitalId, doctors.get(0).getId());
    }

    @Transactional
    public QueueBoardDto getDoctorLiveQueueByNamePublic(UUID hospitalId, String doctorName) {
        List<Doctor> doctors = doctorRepository.findAllByHospitalIdAndNameContainingIgnoreCase(hospitalId, doctorName.trim());
        if (doctors.isEmpty()) {
            throw new DoctorNotFoundException("Doctor with name matching '" + doctorName + "' not found in this hospital.");
        }
        Doctor doctor = doctors.get(0);
        OpdSession session = resolveOrCreateTodayDoctorSession(hospitalId, doctor);
        return buildQueueBoardDto(session);
    }

    private OpdSession resolveOrCreateTodayDoctorSession(UUID hospitalId, Doctor doctor) {
        LocalDate today = LocalDate.now();
        List<OpdSession> sessions = sessionRepository.findAllByHospitalIdAndDoctorIdAndSessionDate(hospitalId, doctor.getId(), today);
        if (!sessions.isEmpty()) {
            for (OpdSession s : sessions) {
                if (s.getStatus() == OpdSessionStatus.OPEN) {
                    return s;
                }
            }
            return sessions.get(0);
        }

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));

        OpdSession session = new OpdSession(
                null,
                hospital,
                doctor,
                today,
                "GENERAL OPD",
                LocalTime.of(9, 0),
                LocalTime.of(17, 0),
                OpdSessionStatus.OPEN
        );
        sessionRepository.save(session);
        OpdSessionQueue queue = new OpdSessionQueue(null, session, hospital);
        queueRepository.save(queue);
        return session;
    }

    @Transactional
    public java.util.Map<String, Object> cleanupOldData(UUID hospitalId, int days) {
        tenantValidator.validateHospitalAccess(hospitalId);
        int daysToKeep = Math.max(days, 1);
        java.time.LocalDate cutoffDate = java.time.LocalDate.now().minusDays(daysToKeep);
        java.time.Instant cutoffInstant = java.time.Instant.now().minus(daysToKeep, java.time.temporal.ChronoUnit.DAYS);

        int deletedTokens = tokenRepository.deleteOldTokensByHospital(hospitalId, cutoffInstant);
        int deletedSessions = sessionRepository.deleteOldSessionsByHospital(hospitalId, cutoffDate);

        Hospital hospital = hospitalRepository.findById(hospitalId).orElse(null);
        auditLogService.record(hospital, null, "STORAGE_CLEANUP", "Hospital", hospitalId.toString(), null,
                "{\"daysPurged\":" + daysToKeep + ",\"deletedSessions\":" + deletedSessions + ",\"deletedTokens\":" + deletedTokens + "}");

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("deletedSessions", deletedSessions);
        result.put("deletedTokens", deletedTokens);
        result.put("daysPurged", daysToKeep);
        result.put("cutoffDate", cutoffDate.toString());
        return result;
    }

    @Transactional
    public TokenResponse retryTokenSms(String bookingReference) {
        OpdToken token = tokenRepository.findByBookingReference(bookingReference)
                .orElseThrow(() -> new ResourceNotFoundException("Token not found with booking reference: " + bookingReference));

        OpdSessionQueue queue = queueRepository.findByOpdSessionId(token.getOpdSession().getId()).orElse(null);
        Integer currentServing = queue != null ? queue.getCurrentServingToken() : null;

        int tokensAhead = 0;
        if (token.getStatus() == TokenStatus.WAITING) {
            tokensAhead = tokenRepository.countTokensAhead(
                    token.getOpdSession().getId(),
                    token.getTokenNumber(),
                    List.of(TokenStatus.WAITING, TokenStatus.RECEIVED_BY_HOSPITAL)
            );
        }

        int avgWait = token.getOpdSession().getDoctor().getAvgConsultationMinutes();
        SmsNotificationService.SmsDeliveryResult sms = smsNotificationService.sendTokenConfirmationSms(
                token,
                token.getHospital().getName(),
                currentServing,
                tokensAhead
        );

        token.setSmsSent(sms.isDelivered());
        token.setSmsError(sms.isDelivered() ? null : sms.getErrorMessage());
        tokenRepository.save(token);

        TokenResponse response = TokenResponse.fromEntity(token, currentServing, tokensAhead, avgWait);
        response.setSmsSent(sms.isDelivered());
        response.setSmsMessage(sms.getMessageText());
        response.setSmsError(sms.getErrorMessage());
        return response;
    }
}
