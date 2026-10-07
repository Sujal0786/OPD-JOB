package com.citycare.platform.modules.admin;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.common.exception.HospitalNotFoundException;
import com.citycare.platform.modules.auth.HospitalUser;
import com.citycare.platform.modules.auth.HospitalUserRepository;
import com.citycare.platform.modules.auth.Role;
import com.citycare.platform.modules.doctor.DoctorRepository;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalRepository;
import com.citycare.platform.modules.opdsession.OpdSessionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@Tag(name = "Platform Super Admin", description = "Global multi-tenant platform administration")
public class AdminController {

    private final HospitalRepository hospitalRepository;
    private final HospitalUserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final OpdSessionRepository sessionRepository;

    public AdminController(HospitalRepository hospitalRepository,
                           HospitalUserRepository userRepository,
                           DoctorRepository doctorRepository,
                           OpdSessionRepository sessionRepository) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.sessionRepository = sessionRepository;
    }

    @GetMapping("/hospitals")
    @Operation(summary = "List all registered hospitals for Super Admin with stats and credentials")
    public ResponseEntity<ApiResponse<List<HospitalAdminSummaryDto>>> listHospitals() {
        List<Hospital> hospitals = hospitalRepository.findAll();
        List<HospitalAdminSummaryDto> dtos = new ArrayList<>();

        for (Hospital h : hospitals) {
            dtos.add(mapToDto(h));
        }

        return ResponseEntity.ok(ApiResponse.ok("HOSPITALS_FETCHED", "All registered hospital tenants retrieved.", dtos));
    }

    @PutMapping("/hospitals/{hospitalId}")
    @Transactional
    @Operation(summary = "Update hospital details by Super Admin")
    public ResponseEntity<ApiResponse<HospitalAdminSummaryDto>> updateHospital(
            @PathVariable UUID hospitalId,
            @Valid @RequestBody HospitalAdminUpdateRequest request) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found with ID: " + hospitalId));

        hospital.setName(request.getName().trim());
        if (request.getAddress() != null) hospital.setAddress(request.getAddress().trim());
        if (request.getPhone() != null) hospital.setPhone(request.getPhone().trim());
        if (request.getStatus() != null) hospital.setStatus(request.getStatus());
        if (request.getAccessCode() != null && !request.getAccessCode().isBlank()) {
            hospital.setAccessCode(request.getAccessCode().trim());
        }

        hospitalRepository.save(hospital);
        return ResponseEntity.ok(ApiResponse.ok("HOSPITAL_UPDATED", "Hospital details updated successfully.", mapToDto(hospital)));
    }

    @DeleteMapping("/hospitals/{hospitalId}")
    @Transactional
    @Operation(summary = "Permanently remove a registered hospital tenant and all associated data")
    public ResponseEntity<ApiResponse<Void>> deleteHospital(@PathVariable UUID hospitalId) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new HospitalNotFoundException("Hospital not found with ID: " + hospitalId));

        String name = hospital.getName();
        hospitalRepository.deleteHospitalById(hospitalId);

        return ResponseEntity.ok(ApiResponse.ok("HOSPITAL_DELETED", "Hospital '" + name + "' permanently removed successfully.", null));
    }

    private HospitalAdminSummaryDto mapToDto(Hospital h) {
        List<HospitalUser> staff = userRepository.findAllByHospitalId(h.getId());
        HospitalUser admin = staff.stream()
                .filter(u -> u.getRole() == Role.HOSPITAL_ADMIN)
                .findFirst()
                .orElse(null);

        long doctorCount = doctorRepository.findAllByHospitalId(h.getId()).size();
        long sessionCount = sessionRepository.findAllByHospitalIdAndSessionDate(h.getId(), LocalDate.now()).size();

        return new HospitalAdminSummaryDto(
                h.getId(),
                h.getName(),
                h.getSlug(),
                h.getAccessCode(),
                h.getAddress(),
                h.getPhone(),
                h.getStatus(),
                admin != null ? admin.getEmail() : "admin@" + h.getSlug() + ".com",
                admin != null ? admin.getFullName() : "Hospital Administrator",
                doctorCount,
                sessionCount,
                h.getCreatedAt()
        );
    }
}
