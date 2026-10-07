package com.citycare.platform.modules.opdsession;

import com.citycare.platform.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hospitals/{hospitalId}/sessions")
@Tag(name = "OPD Session Management", description = "Endpoints for scheduling OPD sessions and viewing today's queue overview")
public class OpdSessionController {

    private final OpdSessionService sessionService;

    public OpdSessionController(OpdSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/today")
    @Operation(summary = "Get today's OPD sessions for hospital")
    public ResponseEntity<ApiResponse<List<OpdSessionDto>>> getTodaySessions(@PathVariable UUID hospitalId) {
        List<OpdSessionDto> sessions = sessionService.getSessionsForDate(hospitalId, LocalDate.now());
        return ResponseEntity.ok(ApiResponse.ok(sessions));
    }

    @GetMapping
    @Operation(summary = "Get sessions for a specific date")
    public ResponseEntity<ApiResponse<List<OpdSessionDto>>> getSessionsByDate(
            @PathVariable UUID hospitalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<OpdSessionDto> sessions = sessionService.getSessionsForDate(hospitalId, date);
        return ResponseEntity.ok(ApiResponse.ok(sessions));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')")
    @Operation(summary = "Open or schedule an OPD session")
    public ResponseEntity<ApiResponse<OpdSessionDto>> createSession(
            @PathVariable UUID hospitalId,
            @Valid @RequestBody OpdSessionCreateRequest request) {
        OpdSessionDto created = sessionService.createSession(hospitalId, request);
        return ResponseEntity.ok(ApiResponse.ok("SESSION_CREATED", "OPD Session opened successfully.", created));
    }

    @PatchMapping("/{sessionId}/status")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')")
    @Operation(summary = "Change OPD session status (OPEN, PAUSED, CLOSED)")
    public ResponseEntity<ApiResponse<OpdSessionDto>> updateSessionStatus(
            @PathVariable UUID hospitalId,
            @PathVariable UUID sessionId,
            @Valid @RequestBody OpdSessionStatusRequest request) {
        OpdSessionDto updated = sessionService.updateSessionStatus(hospitalId, sessionId, request.getStatus());
        return ResponseEntity.ok(ApiResponse.ok("SESSION_STATUS_UPDATED", "OPD Session status updated.", updated));
    }
}
