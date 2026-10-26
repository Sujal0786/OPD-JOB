package com.citycare.platform.modules.opdsession;

import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.doctor.Doctor;
import com.citycare.platform.modules.doctor.DoctorRepository;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.hospital.HospitalStatus;
import com.citycare.platform.modules.queue.OpdSessionQueue;
import com.citycare.platform.modules.queue.OpdSessionQueueRepository;
import com.citycare.platform.modules.queue.OpdTokenRepository;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OpdSessionServiceTest {

    @Mock
    private OpdSessionRepository sessionRepository;

    @Mock
    private OpdSessionQueueRepository queueRepository;

    @Mock
    private OpdTokenRepository tokenRepository;

    @Mock
    private DoctorRepository doctorRepository;

    @Mock
    private HospitalRepository hospitalRepository;

    @Mock
    private TenantSecurityValidator tenantValidator;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private OpdSessionService sessionService;

    private UUID hospitalId;
    private Hospital hospital;
    private Doctor doctor1;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        hospitalId = UUID.randomUUID();
        hospital = new Hospital(hospitalId, "city-care", "123456", "City Care Hospital", "Address", "9876543210", null, HospitalStatus.ACTIVE);
        doctor1 = new Doctor(UUID.randomUUID(), hospital, null, "Dr Seemant Garg", null, "Cardiology", "MD", "101", true, 10);
        today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
    }

    @Test
    @DisplayName("Read endpoints must perform ZERO database writes and bounded batch queries")
    void testReadEndpointsPerformZeroWritesAndBoundedQueries() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);

        // Given 3 sessions for today
        OpdSession s1 = new OpdSession(UUID.randomUUID(), hospital, doctor1, today, "MORNING OPD", LocalTime.of(9, 0), LocalTime.of(14, 0), OpdSessionStatus.OPEN);
        OpdSession s2 = new OpdSession(UUID.randomUUID(), hospital, doctor1, today, "EVENING OPD", LocalTime.of(17, 0), LocalTime.of(19, 0), OpdSessionStatus.PAUSED);
        Doctor doctor2 = new Doctor(UUID.randomUUID(), hospital, null, "Dr Aarti Sharma", null, "Pediatrics", "MD", "102", true, 15);
        OpdSession s3 = new OpdSession(UUID.randomUUID(), hospital, doctor2, today, "MORNING OPD", LocalTime.of(9, 0), LocalTime.of(14, 0), OpdSessionStatus.OPEN);
        List<OpdSession> sessions = List.of(s1, s2, s3);

        when(sessionRepository.findAllByHospitalIdAndSessionDateWithDoctorAndHospital(hospitalId, today)).thenReturn(sessions);

        OpdSessionQueue q1 = new OpdSessionQueue(UUID.randomUUID(), s1, hospital);
        OpdSessionQueue q2 = new OpdSessionQueue(UUID.randomUUID(), s2, hospital);
        OpdSessionQueue q3 = new OpdSessionQueue(UUID.randomUUID(), s3, hospital);
        when(queueRepository.findAllBySessionIds(anyCollection())).thenReturn(List.of(q1, q2, q3));

        // Grouped aggregate counts: row is [sessionId, status, count]
        when(tokenRepository.countTokensBySessionIdsAndStatuses(anyCollection(), anyCollection())).thenReturn(List.of(
                new Object[]{s1.getId(), com.citycare.platform.modules.queue.TokenStatus.WAITING, 5L},
                new Object[]{s1.getId(), com.citycare.platform.modules.queue.TokenStatus.COMPLETED, 12L}
        ));

        // When
        List<OpdSessionDto> result = sessionService.getSessionsForDate(hospitalId, today);

        // Then: verify ZERO write mutations
        verify(sessionRepository, never()).save(any());
        verify(sessionRepository, never()).saveAndFlush(any());
        verify(queueRepository, never()).save(any());
        verify(queueRepository, never()).saveAndFlush(any());

        // Then: verify exactly 1 batch queue fetch and 1 batch count aggregate query (O(1) bounded queries)
        verify(queueRepository, times(1)).findAllBySessionIds(anyCollection());
        verify(tokenRepository, times(1)).countTokensBySessionIdsAndStatuses(anyCollection(), anyCollection());

        assertEquals(3, result.size());
        OpdSessionDto s1Dto = result.stream().filter(d -> d.getId().equals(s1.getId())).findFirst().orElseThrow();
        assertEquals(5, s1Dto.getWaitingCount());
        assertEquals(12, s1Dto.getCompletedCount());
    }

    @Test
    @DisplayName("Deliberate provisioning creates Morning and Evening sessions idempotently under hospital lock")
    void testDeliberateProvisioningIsIdempotent() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);
        when(hospitalRepository.findByIdForUpdate(hospitalId)).thenReturn(Optional.of(hospital));
        when(doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId)).thenReturn(List.of(doctor1));

        // Initial state: doctor1 has NO sessions today
        when(sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, today)).thenReturn(new ArrayList<>());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor1.getId()), eq(today), eq("MORNING OPD")))
                .thenReturn(Optional.empty());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor1.getId()), eq(today), eq("EVENING OPD")))
                .thenReturn(Optional.empty());

        when(sessionRepository.save(any(OpdSession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(queueRepository.findByOpdSessionId(any())).thenReturn(Optional.empty());
        when(queueRepository.save(any(OpdSessionQueue.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(sessionRepository.findAllByHospitalIdAndSessionDateWithDoctorAndHospital(hospitalId, today)).thenReturn(new ArrayList<>());

        // When: deliberate provisioning is triggered
        List<OpdSessionDto> result = sessionService.provisionTodaySessions(hospitalId);

        // Verify: hospital-level row lock is acquired first
        verify(hospitalRepository, times(1)).findByIdForUpdate(hospitalId);

        // Verify: exactly 2 sessions provisioned (Morning and Evening)
        verify(sessionRepository, times(2)).save(any(OpdSession.class));
        verify(queueRepository, times(2)).save(any(OpdSessionQueue.class));
        assertNotNull(result);
    }

    @Test
    @DisplayName("Partial initialization correctly skips existing slots and provisions only missing slots")
    void testPartialInitializationOnlyProvisionsMissingSlots() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);
        when(hospitalRepository.findByIdForUpdate(hospitalId)).thenReturn(Optional.of(hospital));

        Doctor doctor2 = new Doctor(UUID.randomUUID(), hospital, null, "Dr Aarti Sharma", null, "Pediatrics", "MD", "102", true, 15);
        when(doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId)).thenReturn(List.of(doctor1, doctor2));

        // Given: doctor1 already has MORNING OPD in database
        OpdSession existingMorning = new OpdSession(UUID.randomUUID(), hospital, doctor1, today, "MORNING OPD",
                LocalTime.of(9, 0), LocalTime.of(14, 0), OpdSessionStatus.OPEN);
        when(sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, today)).thenReturn(new ArrayList<>(List.of(existingMorning)));

        // Doctor1 is missing EVENING OPD
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor1.getId()), eq(today), eq("EVENING OPD")))
                .thenReturn(Optional.empty());

        // Doctor2 is missing MORNING and EVENING
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor2.getId()), eq(today), eq("MORNING OPD")))
                .thenReturn(Optional.empty());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor2.getId()), eq(today), eq("EVENING OPD")))
                .thenReturn(Optional.empty());

        when(queueRepository.findByOpdSessionId(existingMorning.getId())).thenReturn(Optional.of(new OpdSessionQueue(UUID.randomUUID(), existingMorning, hospital)));
        when(sessionRepository.save(any(OpdSession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(queueRepository.save(any(OpdSessionQueue.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessionRepository.findAllByHospitalIdAndSessionDateWithDoctorAndHospital(hospitalId, today)).thenReturn(new ArrayList<>());

        // When
        sessionService.provisionTodaySessions(hospitalId);

        // Verify: 3 sessions created (doctor1's evening, doctor2's morning and evening). Doctor1's morning is NOT re-created!
        verify(sessionRepository, times(3)).save(any(OpdSession.class));
        verify(queueRepository, times(3)).save(any(OpdSessionQueue.class));
    }

    @Test
    @DisplayName("Query growth is strictly bounded O(1) as session count scales from 1 to 50")
    void testBoundedQueryGrowthAsSessionsIncrease() {
        // Build 50 sessions
        List<OpdSession> manySessions = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            manySessions.add(new OpdSession(UUID.randomUUID(), hospital, doctor1, today, "OPD " + i,
                    LocalTime.of(9, 0), LocalTime.of(13, 0), OpdSessionStatus.OPEN));
        }

        when(queueRepository.findAllBySessionIds(anyCollection())).thenReturn(List.of());
        when(tokenRepository.countTokensBySessionIdsAndStatuses(anyCollection(), anyCollection())).thenReturn(List.of());

        // When mapping 50 sessions
        List<OpdSessionDto> dtos = sessionService.mapToDtos(manySessions);

        // Verify: exactly 1 batch queue query and exactly 1 batch count aggregate query executed
        // Zero N+1 queries executed
        verify(queueRepository, times(1)).findAllBySessionIds(anyCollection());
        verify(tokenRepository, times(1)).countTokensBySessionIdsAndStatuses(anyCollection(), anyCollection());
        assertEquals(50, dtos.size());
    }

    @Test
    @DisplayName("Should update session status to PAUSED and OPEN seamlessly")
    void testUpdateSessionStatus() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);
        UUID sessionId = UUID.randomUUID();
        OpdSession session = new OpdSession(sessionId, hospital, doctor1, today, "MORNING OPD", LocalTime.of(9, 0), LocalTime.of(14, 0), OpdSessionStatus.OPEN);

        when(sessionRepository.findByIdAndHospitalId(sessionId, hospitalId)).thenReturn(Optional.of(session));

        OpdSessionDto updated = sessionService.updateSessionStatus(hospitalId, sessionId, OpdSessionStatus.PAUSED);

        assertEquals(OpdSessionStatus.PAUSED, updated.getStatus());
        verify(sessionRepository).save(session);
        verify(auditLogService).record(eq(hospital), isNull(), eq("OPD_SESSION_STATUS_CHANGED"), eq("OpdSession"), eq(sessionId.toString()), isNull(), anyString());
    }
}
