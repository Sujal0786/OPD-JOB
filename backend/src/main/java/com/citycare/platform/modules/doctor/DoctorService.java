package com.citycare.platform.modules.doctor;

import com.citycare.platform.common.exception.DoctorNotFoundException;
import com.citycare.platform.common.exception.HospitalNotFoundException;
import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.tenant.TenantSecurityValidator;
import com.citycare.platform.modules.opdsession.OpdSession;
import com.citycare.platform.modules.opdsession.OpdSessionRepository;
import com.citycare.platform.modules.opdsession.OpdSessionStatus;
import com.citycare.platform.modules.queue.OpdSessionQueue;
import com.citycare.platform.modules.queue.OpdSessionQueueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final HospitalRepository hospitalRepository;
    private final OpdSessionRepository sessionRepository;
    private final OpdSessionQueueRepository queueRepository;
    private final TenantSecurityValidator tenantValidator;
    private final AuditLogService auditLogService;

    public DoctorService(DoctorRepository doctorRepository,
                         HospitalRepository hospitalRepository,
                         OpdSessionRepository sessionRepository,
                         OpdSessionQueueRepository queueRepository,
                         TenantSecurityValidator tenantValidator,
                         AuditLogService auditLogService) {
        this.doctorRepository = doctorRepository;
        this.hospitalRepository = hospitalRepository;
        this.sessionRepository = sessionRepository;
        this.queueRepository = queueRepository;
        this.tenantValidator = tenantValidator;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<DoctorDto> listDoctors(UUID hospitalId, boolean activeOnly) {
        tenantValidator.validateHospitalAccess(hospitalId);
        List<Doctor> doctors = activeOnly
                ? doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId)
                : doctorRepository.findAllByHospitalId(hospitalId);
        return doctors.stream().map(DoctorDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<DoctorDto> listPublicDoctorsForHospital(UUID hospitalId) {
        // Public patient view: lists active doctors for the resolved hospital only
        return doctorRepository.findAllByHospitalIdAndActiveTrue(hospitalId).stream()
                .map(DoctorDto::fromEntity)
                .toList();
    }

    @Transactional
    public DoctorDto createDoctor(UUID hospitalId, DoctorCreateRequest request) {
        tenantValidator.validateHospitalAccess(hospitalId);
        Hospital hospital = hospitalRepository.findByIdForUpdate(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));

        Doctor doctor = new Doctor(
                null,
                hospital,
                null,
                request.getName().trim(),
                request.getPhotoUrl(),
                request.getSpecialty().trim(),
                request.getQualification(),
                request.getRoomNumber().trim(),
                true,
                request.getAvgConsultationMinutes()
        );
        doctorRepository.save(doctor);

        // Auto-provision today's OPD slots (Morning and Evening) so the doctor is immediately active in queues and patient view
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        provisionDoctorDailySlots(hospital, doctor, today);

        auditLogService.record(hospital, null, "DOCTOR_CREATED", "Doctor", doctor.getId().toString(), null, "{\"name\":\"" + doctor.getName() + "\"}");
        return DoctorDto.fromEntity(doctor);
    }

    @Transactional
    public DoctorDto updateDoctor(UUID hospitalId, UUID doctorId, DoctorUpdateRequest request) {
        tenantValidator.validateHospitalAccess(hospitalId);
        Doctor doctor = doctorRepository.findByIdAndHospitalId(doctorId, hospitalId)
                .orElseThrow(() -> new DoctorNotFoundException("Doctor not found in this hospital."));

        boolean wasInactive = !doctor.isActive();
        doctor.setName(request.getName().trim());
        if (request.getPhotoUrl() != null) doctor.setPhotoUrl(request.getPhotoUrl().trim());
        doctor.setSpecialty(request.getSpecialty().trim());
        doctor.setQualification(request.getQualification());
        doctor.setRoomNumber(request.getRoomNumber().trim());
        doctor.setActive(request.isActive());
        doctor.setAvgConsultationMinutes(request.getAvgConsultationMinutes());

        doctorRepository.save(doctor);

        // If an inactive doctor is reactivated today, ensure their Morning and Evening slots exist for today
        if (wasInactive && request.isActive()) {
            LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
            provisionDoctorDailySlots(doctor.getHospital(), doctor, today);
        }

        auditLogService.record(doctor.getHospital(), null, "DOCTOR_UPDATED", "Doctor", doctorId.toString(), null, "{}");
        return DoctorDto.fromEntity(doctor);
    }

    private void provisionDoctorDailySlots(Hospital hospital, Doctor doctor, LocalDate sessionDate) {
        // 1. Morning OPD (09:00 - 14:00, default OPEN)
        if (sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
                hospital.getId(), doctor.getId(), sessionDate, "MORNING OPD").isEmpty()) {
            OpdSession morning = new OpdSession(
                    null,
                    hospital,
                    doctor,
                    sessionDate,
                    "MORNING OPD",
                    LocalTime.of(9, 0),
                    LocalTime.of(14, 0),
                    OpdSessionStatus.OPEN
            );
            sessionRepository.save(morning);
            if (queueRepository.findByOpdSessionId(morning.getId()).isEmpty()) {
                queueRepository.save(new OpdSessionQueue(null, morning, hospital));
            }
        }

        // 2. Evening OPD (17:00 - 19:00, default PAUSED)
        if (sessionRepository.findByHospitalIdAndDoctorIdAndSessionDateAndSessionName(
                hospital.getId(), doctor.getId(), sessionDate, "EVENING OPD").isEmpty()) {
            OpdSession evening = new OpdSession(
                    null,
                    hospital,
                    doctor,
                    sessionDate,
                    "EVENING OPD",
                    LocalTime.of(17, 0),
                    LocalTime.of(19, 0),
                    OpdSessionStatus.PAUSED
            );
            sessionRepository.save(evening);
            if (queueRepository.findByOpdSessionId(evening.getId()).isEmpty()) {
                queueRepository.save(new OpdSessionQueue(null, evening, hospital));
            }
        }
    }

    @Transactional(readOnly = true)
    public Doctor getDoctorEntity(UUID hospitalId, UUID doctorId) {
        return doctorRepository.findByIdAndHospitalId(doctorId, hospitalId)
                .orElseThrow(() -> new DoctorNotFoundException("Doctor not found in this hospital."));
    }
}
