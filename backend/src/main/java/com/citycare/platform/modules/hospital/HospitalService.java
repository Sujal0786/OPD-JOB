package com.citycare.platform.modules.hospital;

import com.citycare.platform.common.exception.HospitalNotFoundException;
import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.tenant.TenantSecurityValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class HospitalService {

    private final HospitalRepository hospitalRepository;
    private final TenantSecurityValidator tenantValidator;
    private final AuditLogService auditLogService;

    public HospitalService(HospitalRepository hospitalRepository,
                           TenantSecurityValidator tenantValidator,
                           AuditLogService auditLogService) {
        this.hospitalRepository = hospitalRepository;
        this.tenantValidator = tenantValidator;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public HospitalProfileDto getHospitalProfile(UUID hospitalId) {
        tenantValidator.validateHospitalAccess(hospitalId);
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));
        return HospitalProfileDto.fromEntity(hospital);
    }

    @Transactional
    public HospitalProfileDto updateHospital(UUID hospitalId, HospitalUpdateRequest request) {
        tenantValidator.validateHospitalAccess(hospitalId);
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found."));

        hospital.setName(request.getName().trim());
        if (request.getAddress() != null) hospital.setAddress(request.getAddress().trim());
        if (request.getPhone() != null) hospital.setPhone(request.getPhone().trim());
        if (request.getLogoUrl() != null) hospital.setLogoUrl(request.getLogoUrl().trim());

        hospitalRepository.save(hospital);
        auditLogService.record(hospital, null, "HOSPITAL_UPDATED", "Hospital", hospitalId.toString(), null, "{}");
        return HospitalProfileDto.fromEntity(hospital);
    }

    @Transactional(readOnly = true)
    public Hospital getHospitalEntity(UUID hospitalId) {
        return hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found with ID: " + hospitalId));
    }

    @Transactional(readOnly = true)
    public Hospital resolveBySlug(String slug) {
        String cleanSlug = slug.toLowerCase().trim();
        return hospitalRepository.findBySlug(cleanSlug)
                .filter(h -> h.getStatus() == HospitalStatus.ACTIVE)
                .orElseThrow(() -> new HospitalNotFoundException("Active hospital not found for URL slug: " + slug));
    }

    @Transactional(readOnly = true)
    public Hospital resolveByAccessCode(String accessCode) {
        return hospitalRepository.findByAccessCode(accessCode.trim())
                .filter(h -> h.getStatus() == HospitalStatus.ACTIVE)
                .orElseThrow(() -> new HospitalNotFoundException("Active hospital not found for access code: " + accessCode));
    }

    @Transactional(readOnly = true)
    public java.util.List<HospitalProfileDto> getAllActiveHospitals() {
        return hospitalRepository.findAll().stream()
                .filter(h -> h.getStatus() == HospitalStatus.ACTIVE)
                .map(HospitalProfileDto::fromEntity)
                .toList();
    }
}
