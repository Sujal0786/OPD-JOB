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
    @DisplayName("Should provision both Morning and Evening OPD sessions for active doctors without duplicate creation")
    void testEnsureSessionsProvisionsMorningAndEvening() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);
        when(doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId)).thenReturn(List.of(doctor1));
        when(hospitalRepository.findById(hospitalId)).thenReturn(Optional.of(hospital));

        // Initial state: doctor1 has NO sessions today in memory
        when(sessionRepository.findAllByHospitalIdAndSessionDate(hospitalId, today)).thenReturn(new ArrayList<>());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor1.getId()), eq(today), eq("MORNING OPD")))
                .thenReturn(Optional.empty());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(eq(hospitalId), eq(doctor1.getId()), eq(today), eq("EVENING OPD")))
                .thenReturn(Optional.empty());

        List<OpdSessionDto> result = sessionService.getSessionsForDate(hospitalId, today);

        // Verify: 2 sessions created (Morning and Evening)
        verify(sessionRepository, times(2)).save(any(OpdSession.class));
        verify(queueRepository, times(2)).save(any(OpdSessionQueue.class));
        assertEquals(2, result.size());

        boolean hasMorning = result.stream().anyMatch(s -> s.getSessionName().equals("MORNING OPD") && s.getStatus() == OpdSessionStatus.OPEN);
        boolean hasEvening = result.stream().anyMatch(s -> s.getSessionName().equals("EVENING OPD") && s.getStatus() == OpdSessionStatus.PAUSED);

        assertTrue(hasMorning, "Should have created OPEN Morning OPD session");
        assertTrue(hasEvening, "Should have created PAUSED Evening OPD session");
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
