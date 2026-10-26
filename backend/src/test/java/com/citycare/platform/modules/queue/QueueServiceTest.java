package com.citycare.platform.modules.queue;

import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.auth.HospitalUserRepository;
import com.citycare.platform.modules.billing.BillingService;
import com.citycare.platform.modules.doctor.Doctor;
import com.citycare.platform.modules.doctor.DoctorRepository;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.notification.SmsNotificationService;
import com.citycare.platform.modules.opdsession.OpdSession;
import com.citycare.platform.modules.opdsession.OpdSessionRepository;
import com.citycare.platform.modules.opdsession.OpdSessionStatus;
import com.citycare.platform.security.UserPrincipal;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QueueServiceTest {

    @Mock
    private OpdSessionQueueRepository queueRepository;

    @Mock
    private OpdTokenRepository tokenRepository;

    @Mock
    private TokenLifecycleRepository lifecycleRepository;

    @Mock
    private OpdSessionRepository sessionRepository;

    @Mock
    private HospitalRepository hospitalRepository;

    @Mock
    private DoctorRepository doctorRepository;

    @Mock
    private HospitalUserRepository userRepository;

    @Mock
    private TenantSecurityValidator tenantValidator;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private BillingService billingService;

    @Mock
    private QueueEventBroadcaster broadcaster;

    @Mock
    private SmsNotificationService smsNotificationService;

    @InjectMocks
    private QueueService queueService;

    private UUID hospitalId;
    private UUID sessionId;
    private Hospital hospital;
    private Doctor doctor;
    private OpdSession session;
    private OpdSessionQueue queue;

    @BeforeEach
    void setUp() {
        hospitalId = UUID.randomUUID();
        sessionId = UUID.randomUUID();

        hospital = new Hospital();
        hospital.setId(hospitalId);
        hospital.setName("City Care General Hospital");

        doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setName("Dr. Sarah Jenkins");
        doctor.setAvgConsultationMinutes(10);
        doctor.setActive(true);

        session = new OpdSession();
        session.setId(sessionId);
        session.setHospital(hospital);
        session.setDoctor(doctor);
        session.setSessionDate(LocalDate.now());
        session.setSessionName("Morning OPD");
        session.setStatus(OpdSessionStatus.OPEN);

        queue = new OpdSessionQueue();
        queue.setId(UUID.randomUUID());
        queue.setOpdSession(session);
        queue.setNextTokenSequence(5);
        queue.setCurrentServingToken(2);
        queue.setTotalWalkinCount(4);
    }

    @Test
    @DisplayName("allocateWalkInBatch computes tokens ahead sequentially without N+1 queue lookups")
    void allocateWalkInBatch_computesSequentiallyWithoutNPlusOne() {
        WalkInBatchRequest request = new WalkInBatchRequest();
        request.setOpdSessionId(sessionId);
        request.setCount(3);
        request.setNote("Walk-in emergency");

        when(sessionRepository.findByIdAndHospitalId(sessionId, hospitalId)).thenReturn(Optional.of(session));
        when(queueRepository.findAndLockBySessionId(sessionId)).thenReturn(Optional.of(queue));
        when(tokenRepository.countTokensAhead(eq(sessionId), eq(5), anyList())).thenReturn(2);

        List<TokenResponse> responses = queueService.allocateWalkInBatch(hospitalId, request, null);

        assertThat(responses).hasSize(3);
        assertThat(responses.get(0).getTokenNumber()).isEqualTo(5);
        assertThat(responses.get(0).getTokensAhead()).isEqualTo(2);

        assertThat(responses.get(1).getTokenNumber()).isEqualTo(6);
        assertThat(responses.get(1).getTokensAhead()).isEqualTo(3);

        assertThat(responses.get(2).getTokenNumber()).isEqualTo(7);
        assertThat(responses.get(2).getTokensAhead()).isEqualTo(4);

        // Verify only 1 count query was issued instead of 3, and 0 extra findByOpdSessionId lookups
        verify(tokenRepository, times(1)).countTokensAhead(any(), anyInt(), any());
        verify(queueRepository, never()).findByOpdSessionId(any());
        verify(broadcaster, times(1)).broadcastSessionUpdate(eq(sessionId), any());
    }

    @Test
    @DisplayName("searchPatients uses batch queue lookup instead of per-token N+1 queries")
    void searchPatients_usesBatchQueueLookup() {
        OpdToken token1 = new OpdToken();
        token1.setId(UUID.randomUUID());
        token1.setHospital(hospital);
        token1.setOpdSession(session);
        token1.setTokenNumber(10);
        token1.setStatus(TokenStatus.WAITING);

        OpdToken token2 = new OpdToken();
        token2.setId(UUID.randomUUID());
        token2.setHospital(hospital);
        token2.setOpdSession(session);
        token2.setTokenNumber(11);
        token2.setStatus(TokenStatus.WAITING);

        Pageable pageable = PageRequest.of(0, 10);
        Page<OpdToken> tokenPage = new PageImpl<>(List.of(token1, token2), pageable, 2);

        when(tokenRepository.searchTokensBySession(hospitalId, sessionId, "test", pageable)).thenReturn(tokenPage);
        when(queueRepository.findAllBySessionIds(anyCollection())).thenReturn(List.of(queue));
        when(tokenRepository.countTokensAhead(eq(sessionId), eq(10), anyList())).thenReturn(3);
        when(tokenRepository.countTokensAhead(eq(sessionId), eq(11), anyList())).thenReturn(4);

        Page<TokenResponse> result = queueService.searchPatients(hospitalId, sessionId, "test", pageable);

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent().get(0).getCurrentServingToken()).isEqualTo(2);
        assertThat(result.getContent().get(1).getCurrentServingToken()).isEqualTo(2);

        // Batch queried once for session queues
        verify(queueRepository, times(1)).findAllBySessionIds(anyCollection());
        verify(queueRepository, never()).findByOpdSessionId(any());
    }

    @Test
    @DisplayName("getPatientTokensByPhone strips +91 country prefix and passes IST dates")
    void getPatientTokensByPhone_normalizesPhoneAndPassesIstDates() {
        OpdToken token = new OpdToken();
        token.setId(UUID.randomUUID());
        token.setHospital(hospital);
        token.setOpdSession(session);
        token.setTokenNumber(20);
        token.setPatientPhone("7986076744");
        token.setStatus(TokenStatus.WAITING);

        when(tokenRepository.findTodayTokensByPhone(eq(hospitalId), eq("7986076744"), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(token));
        when(queueRepository.findAllBySessionIds(anyCollection())).thenReturn(List.of(queue));
        when(tokenRepository.countTokensAhead(eq(sessionId), eq(20), anyList())).thenReturn(1);

        List<TokenResponse> responses = queueService.getPatientTokensByPhone(hospitalId, "+91 7986076744");

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getTokenNumber()).isEqualTo(20);
        assertThat(responses.get(0).getPatientPhone()).isEqualTo("7986076744");

        verify(tokenRepository).findTodayTokensByPhone(eq(hospitalId), eq("7986076744"), any(LocalDate.class), any(LocalDate.class));
    }
}
