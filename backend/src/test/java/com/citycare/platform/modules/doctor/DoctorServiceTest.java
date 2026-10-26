package com.citycare.platform.modules.doctor;

import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.hospital.HospitalStatus;
import com.citycare.platform.modules.opdsession.OpdSession;
import com.citycare.platform.modules.opdsession.OpdSessionRepository;
import com.citycare.platform.modules.opdsession.OpdSessionStatus;
import com.citycare.platform.modules.queue.OpdSessionQueue;
import com.citycare.platform.modules.queue.OpdSessionQueueRepository;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoctorServiceTest {

    @Mock
    private DoctorRepository doctorRepository;

    @Mock
    private HospitalRepository hospitalRepository;

    @Mock
    private OpdSessionRepository sessionRepository;

    @Mock
    private OpdSessionQueueRepository queueRepository;

    @Mock
    private TenantSecurityValidator tenantValidator;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private DoctorService doctorService;

    private UUID hospitalId;
    private Hospital hospital;
    private LocalDate todayIst;

    @BeforeEach
    void setUp() {
        hospitalId = UUID.randomUUID();
        hospital = new Hospital(hospitalId, "city-care", "123456", "City Care Hospital", "Address", "9876543210", null, HospitalStatus.ACTIVE);
        todayIst = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
    }

    @Test
    @DisplayName("createDoctor acquires hospital lock and auto-provisions Morning (OPEN) and Evening (PAUSED) OPD slots")
    void testCreateDoctorAutoProvisionsMorningAndEveningSlots() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);
        when(hospitalRepository.findByIdForUpdate(hospitalId)).thenReturn(Optional.of(hospital));
        when(doctorRepository.save(any(Doctor.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(any(), any(), any(), eq("MORNING OPD")))
                .thenReturn(Optional.empty());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(any(), any(), any(), eq("EVENING OPD")))
                .thenReturn(Optional.empty());

        when(sessionRepository.save(any(OpdSession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(queueRepository.findByOpdSessionId(any())).thenReturn(Optional.empty());
        when(queueRepository.save(any(OpdSessionQueue.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DoctorCreateRequest request = new DoctorCreateRequest();
        request.setName("Dr Ramesh Patel");
        request.setSpecialty("Cardiology");
        request.setQualification("MD, DM");
        request.setRoomNumber("204");
        request.setAvgConsultationMinutes(15);

        // When
        DoctorDto dto = doctorService.createDoctor(hospitalId, request);

        // Verify hospital-level lock acquired
        verify(hospitalRepository, times(1)).findByIdForUpdate(hospitalId);

        // Verify doctor saved
        verify(doctorRepository, times(1)).save(any(Doctor.class));
        assertNotNull(dto);
        assertEquals("Dr Ramesh Patel", dto.getName());

        // Verify Morning and Evening slots provisioned with Asia/Kolkata date
        ArgumentCaptor<OpdSession> sessionCaptor = ArgumentCaptor.forClass(OpdSession.class);
        verify(sessionRepository, times(2)).save(sessionCaptor.capture());
        List<OpdSession> savedSessions = sessionCaptor.getAllValues();

        OpdSession morning = savedSessions.stream().filter(s -> s.getSessionName().equals("MORNING OPD")).findFirst().orElseThrow();
        assertEquals(OpdSessionStatus.OPEN, morning.getStatus());
        assertEquals(todayIst, morning.getSessionDate());

        OpdSession evening = savedSessions.stream().filter(s -> s.getSessionName().equals("EVENING OPD")).findFirst().orElseThrow();
        assertEquals(OpdSessionStatus.PAUSED, evening.getStatus());
        assertEquals(todayIst, evening.getSessionDate());

        // Verify queues created for both slots
        verify(queueRepository, times(2)).save(any(OpdSessionQueue.class));
    }

    @Test
    @DisplayName("updateDoctor provisions today's slots when an inactive doctor is reactivated")
    void testUpdateDoctorReactivatesAndProvisionsSlots() {
        doNothing().when(tenantValidator).validateHospitalAccess(hospitalId);

        UUID doctorId = UUID.randomUUID();
        Doctor existingDoctor = new Doctor(doctorId, hospital, null, "Dr Sunita Rao", null, "Neurology", "MD", "305", false, 12);
        when(doctorRepository.findByIdAndHospitalId(doctorId, hospitalId)).thenReturn(Optional.of(existingDoctor));

        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(any(), any(), any(), eq("MORNING OPD")))
                .thenReturn(Optional.empty());
        when(sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(any(), any(), any(), eq("EVENING OPD")))
                .thenReturn(Optional.empty());

        when(queueRepository.findByOpdSessionId(any())).thenReturn(Optional.empty());

        DoctorUpdateRequest request = new DoctorUpdateRequest();
        request.setName("Dr Sunita Rao");
        request.setSpecialty("Neurology");
        request.setQualification("MD");
        request.setRoomNumber("305");
        request.setActive(true); // Activating
        request.setAvgConsultationMinutes(12);

        // When
        DoctorDto updated = doctorService.updateDoctor(hospitalId, doctorId, request);

        assertTrue(updated.isActive());
        verify(doctorRepository, times(1)).save(existingDoctor);

        // Verify slots provisioned for today
        verify(sessionRepository, times(2)).save(any(OpdSession.class));
        verify(queueRepository, times(2)).save(any(OpdSessionQueue.class));
    }
}
