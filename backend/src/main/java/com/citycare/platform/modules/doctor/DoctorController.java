package com.citycare.platform.modules.doctor;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.modules.queue.QueueBoardDto;
import com.citycare.platform.modules.queue.QueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hospitals/{hospitalId}/doctors")
@Tag(name = "Doctor Management", description = "Endpoints for managing hospital doctor rosters and consultation rooms")
public class DoctorController {

    private final DoctorService doctorService;
    private final QueueService queueService;

    public DoctorController(DoctorService doctorService, QueueService queueService) {
        this.doctorService = doctorService;
        this.queueService = queueService;
    }

    @GetMapping
    @Operation(summary = "List doctors in hospital")
    public ResponseEntity<ApiResponse<List<DoctorDto>>> listDoctors(
            @PathVariable UUID hospitalId,
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        List<DoctorDto> doctors = doctorService.listDoctors(hospitalId, activeOnly);
        return ResponseEntity.ok(ApiResponse.ok(doctors));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')")
    @Operation(summary = "Create doctor profile")
    public ResponseEntity<ApiResponse<DoctorDto>> createDoctor(
            @PathVariable UUID hospitalId,
            @Valid @RequestBody DoctorCreateRequest request) {
        DoctorDto created = doctorService.createDoctor(hospitalId, request);
        return ResponseEntity.ok(ApiResponse.ok("DOCTOR_CREATED", "Doctor added successfully.", created));
    }

    @PutMapping("/{doctorId}")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')")
    @Operation(summary = "Update doctor profile")
    public ResponseEntity<ApiResponse<DoctorDto>> updateDoctor(
            @PathVariable UUID hospitalId,
            @PathVariable UUID doctorId,
            @Valid @RequestBody DoctorUpdateRequest request) {
        DoctorDto updated = doctorService.updateDoctor(hospitalId, doctorId, request);
        return ResponseEntity.ok(ApiResponse.ok("DOCTOR_UPDATED", "Doctor updated successfully.", updated));
    }

    @GetMapping("/{doctorId}/live-queue")
    @Operation(summary = "Get live queue board for a specific doctor room")
    public ResponseEntity<ApiResponse<QueueBoardDto>> getDoctorLiveQueue(
            @PathVariable UUID hospitalId,
            @PathVariable UUID doctorId) {
        QueueBoardDto board = queueService.getDoctorLiveQueue(hospitalId, doctorId);
        return ResponseEntity.ok(ApiResponse.ok(board));
    }

    @GetMapping("/by-name/live-queue")
    @Operation(summary = "Get live queue board for a doctor room by doctor name")
    public ResponseEntity<ApiResponse<QueueBoardDto>> getDoctorLiveQueueByName(
            @PathVariable UUID hospitalId,
            @RequestParam String name) {
        QueueBoardDto board = queueService.getDoctorLiveQueueByName(hospitalId, name);
        return ResponseEntity.ok(ApiResponse.ok(board));
    }
}
