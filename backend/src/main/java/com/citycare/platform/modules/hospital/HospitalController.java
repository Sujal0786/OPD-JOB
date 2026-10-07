package com.citycare.platform.modules.hospital;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.modules.auth.AuthService;
import com.citycare.platform.modules.auth.StaffCreateRequest;
import com.citycare.platform.modules.auth.StaffResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

import com.citycare.platform.modules.queue.QueueService;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/hospitals/{hospitalId}")
@Tag(name = "Hospital Management", description = "Tenant-scoped management of hospital profile and staff")
public class HospitalController {

    private final HospitalService hospitalService;
    private final AuthService authService;
    private final QueueService queueService;

    public HospitalController(HospitalService hospitalService, AuthService authService, QueueService queueService) {
        this.hospitalService = hospitalService;
        this.authService = authService;
        this.queueService = queueService;
    }

    @PostMapping("/storage/cleanup")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Purge historical session and queue data older than specified days")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cleanupOldData(
            @PathVariable UUID hospitalId,
            @RequestParam(defaultValue = "7") int days) {
        Map<String, Object> result = queueService.cleanupOldData(hospitalId, days);
        return ResponseEntity.ok(ApiResponse.ok("STORAGE_CLEANED", "Historical data older than " + days + " days purged successfully.", result));
    }

    @GetMapping
    @Operation(summary = "Get hospital profile")
    public ResponseEntity<ApiResponse<HospitalProfileDto>> getProfile(@PathVariable UUID hospitalId) {
        HospitalProfileDto dto = hospitalService.getHospitalProfile(hospitalId);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Update hospital profile")
    public ResponseEntity<ApiResponse<HospitalProfileDto>> updateProfile(
            @PathVariable UUID hospitalId,
            @Valid @RequestBody HospitalUpdateRequest request) {
        HospitalProfileDto updated = hospitalService.updateHospital(hospitalId, request);
        return ResponseEntity.ok(ApiResponse.ok("HOSPITAL_UPDATED", "Hospital profile updated successfully.", updated));
    }

    @GetMapping("/staff")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "List staff members")
    public ResponseEntity<ApiResponse<List<StaffResponse>>> listStaff(@PathVariable UUID hospitalId) {
        List<StaffResponse> staff = authService.listStaff(hospitalId);
        return ResponseEntity.ok(ApiResponse.ok(staff));
    }

    @PostMapping("/staff")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Create a staff member")
    public ResponseEntity<ApiResponse<StaffResponse>> createStaff(
            @PathVariable UUID hospitalId,
            @Valid @RequestBody StaffCreateRequest request) {
        StaffResponse created = authService.createStaff(hospitalId, request);
        return ResponseEntity.ok(ApiResponse.ok("STAFF_CREATED", "Staff member created successfully.", created));
    }
}
