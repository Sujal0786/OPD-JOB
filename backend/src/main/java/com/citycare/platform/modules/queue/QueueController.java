package com.citycare.platform.modules.queue;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hospitals/{hospitalId}")
@Tag(name = "Hospital Queue & Tokens", description = "Endpoints for managing walk-in tokens, calling patients, and searching queues")
public class QueueController {

    private final QueueService queueService;
    private final QueueEventBroadcaster broadcaster;

    public QueueController(QueueService queueService, QueueEventBroadcaster broadcaster) {
        this.queueService = queueService;
        this.broadcaster = broadcaster;
    }

    @GetMapping("/sessions/{sessionId}/board")
    @Operation(summary = "Get full live queue board for an OPD session")
    public ResponseEntity<ApiResponse<QueueBoardDto>> getQueueBoard(
            @PathVariable UUID hospitalId,
            @PathVariable UUID sessionId) {
        QueueBoardDto board = queueService.getQueueBoard(hospitalId, sessionId);
        return ResponseEntity.ok(ApiResponse.ok(board));
    }

    @PostMapping("/sessions/{sessionId}/walk-ins")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'SUPER_ADMIN')")
    @Operation(summary = "Add bulk walk-in physical patients (1..N)")
    public ResponseEntity<ApiResponse<List<TokenResponse>>> addWalkIns(
            @PathVariable UUID hospitalId,
            @PathVariable UUID sessionId,
            @Valid @RequestBody WalkInBatchRequest request,
            @AuthenticationPrincipal UserPrincipal staff) {
        request.setOpdSessionId(sessionId);
        List<TokenResponse> created = queueService.allocateWalkInBatch(hospitalId, request, staff);
        return ResponseEntity.ok(ApiResponse.ok("WALKINS_ADDED", created.size() + " walk-in tokens added successfully.", created));
    }

    @PostMapping("/sessions/{sessionId}/call/{tokenNumber}")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR', 'SUPER_ADMIN')")
    @Operation(summary = "Call next or specific token number")
    public ResponseEntity<ApiResponse<TokenResponse>> callToken(
            @PathVariable UUID hospitalId,
            @PathVariable UUID sessionId,
            @PathVariable int tokenNumber,
            @AuthenticationPrincipal UserPrincipal staff) {
        TokenResponse response = queueService.callToken(hospitalId, sessionId, tokenNumber, staff);
        return ResponseEntity.ok(ApiResponse.ok("TOKEN_CALLED", "Token #" + tokenNumber + " called.", response));
    }

    @PatchMapping("/tokens/{tokenId}/status")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR', 'SUPER_ADMIN')")
    @Operation(summary = "Update token lifecycle status (IN_CONSULTATION, COMPLETED, SKIPPED, CANCELLED)")
    public ResponseEntity<ApiResponse<TokenResponse>> updateTokenStatus(
            @PathVariable UUID hospitalId,
            @PathVariable UUID tokenId,
            @Valid @RequestBody TokenStatusUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal staff) {
        TokenResponse response = queueService.updateTokenStatus(hospitalId, tokenId, request.getStatus(), request.getReason(), staff);
        return ResponseEntity.ok(ApiResponse.ok("STATUS_UPDATED", "Token status updated to " + request.getStatus(), response));
    }

    @GetMapping("/patients/search")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR', 'SUPER_ADMIN')")
    @Operation(summary = "Paginated patient search across tokens, names, and phone numbers")
    public ResponseEntity<ApiResponse<Page<TokenResponse>>> searchPatients(
            @PathVariable UUID hospitalId,
            @RequestParam(required = false) UUID sessionId,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<TokenResponse> results = queueService.searchPatients(hospitalId, sessionId, query, PageRequest.of(page, Math.min(size, 100)));
        return ResponseEntity.ok(ApiResponse.ok(results));
    }

    @GetMapping(value = "/sessions/{sessionId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Subscribe to live queue updates via Server-Sent Events (SSE)")
    public SseEmitter streamSessionUpdates(@PathVariable UUID hospitalId, @PathVariable UUID sessionId) {
        return broadcaster.subscribeSession(sessionId);
    }
}
