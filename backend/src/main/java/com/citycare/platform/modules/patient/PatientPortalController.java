package com.citycare.platform.modules.patient;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.modules.doctor.DoctorDto;
import com.citycare.platform.modules.doctor.DoctorService;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.hospital.HospitalProfileDto;
import com.citycare.platform.modules.hospital.HospitalService;
import com.citycare.platform.modules.opdsession.OpdSessionDto;
import com.citycare.platform.modules.opdsession.OpdSessionService;
import com.citycare.platform.modules.queue.OnlineTokenRequest;
import com.citycare.platform.modules.queue.QueueEventBroadcaster;
import com.citycare.platform.modules.queue.QueueService;
import com.citycare.platform.modules.queue.TokenResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient")
@Tag(name = "Patient Portal (Public)", description = "Public endpoints for patient token generation and live status tracking without global hospital directories")
public class PatientPortalController {

    private final HospitalService hospitalService;
    private final DoctorService doctorService;
    private final OpdSessionService sessionService;
    private final QueueService queueService;
    private final QueueEventBroadcaster broadcaster;

    public PatientPortalController(
            HospitalService hospitalService,
            DoctorService doctorService,
            OpdSessionService sessionService,
            QueueService queueService,
            QueueEventBroadcaster broadcaster) {
        this.hospitalService = hospitalService;
        this.doctorService = doctorService;
        this.sessionService = sessionService;
        this.queueService = queueService;
        this.broadcaster = broadcaster;
    }

    @GetMapping("/hospitals/by-slug/{slug}")
    @Operation(summary = "Resolve hospital by URL slug (QR code entry)")
    public ResponseEntity<ApiResponse<HospitalProfileDto>> getHospitalBySlug(@PathVariable String slug) {
        Hospital hospital = hospitalService.resolveBySlug(slug);
        return ResponseEntity.ok(ApiResponse.ok(HospitalProfileDto.fromEntity(hospital)));
    }

    @GetMapping("/hospitals/by-code/{accessCode}")
    @Operation(summary = "Resolve hospital by 6-digit access code")
    public ResponseEntity<ApiResponse<HospitalProfileDto>> getHospitalByAccessCode(@PathVariable String accessCode) {
        Hospital hospital = hospitalService.resolveByAccessCode(accessCode);
        return ResponseEntity.ok(ApiResponse.ok(HospitalProfileDto.fromEntity(hospital)));
    }

    @GetMapping("/hospitals/all")
    @Operation(summary = "List all registered active hospitals")
    public ResponseEntity<ApiResponse<List<HospitalProfileDto>>> getAllHospitals() {
        List<HospitalProfileDto> list = hospitalService.getAllActiveHospitals();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/hospitals/{hospitalId}/doctors")
    @Operation(summary = "List doctors and today's sessions for this hospital")
    public ResponseEntity<ApiResponse<List<DoctorDto>>> getHospitalDoctors(@PathVariable UUID hospitalId) {
        List<DoctorDto> doctors = doctorService.listPublicDoctorsForHospital(hospitalId);
        return ResponseEntity.ok(ApiResponse.ok(doctors));
    }

    @GetMapping("/hospitals/{hospitalId}/sessions/today")
    @Operation(summary = "List today's available OPD sessions for this hospital")
    public ResponseEntity<ApiResponse<List<OpdSessionDto>>> getTodaySessions(@PathVariable UUID hospitalId) {
        List<OpdSessionDto> sessions = sessionService.getPublicTodaySessions(hospitalId);
        return ResponseEntity.ok(ApiResponse.ok(sessions));
    }

    @PostMapping("/tokens")
    @Operation(summary = "Generate an online OPD token")
    public ResponseEntity<ApiResponse<TokenResponse>> generateToken(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKeyHeader,
            @Valid @RequestBody OnlineTokenRequest request) {
        if (!StringUtils.hasText(request.getIdempotencyKey()) && StringUtils.hasText(idempotencyKeyHeader)) {
            request.setIdempotencyKey(idempotencyKeyHeader);
        }
        TokenResponse response = queueService.allocateOnlineToken(request);
        return ResponseEntity.ok(ApiResponse.ok("TOKEN_GENERATED", "OPD token generated successfully.", response));
    }

    @GetMapping("/tokens/{bookingReference}")
    @Operation(summary = "Authoritative token status and queue snapshot")
    public ResponseEntity<ApiResponse<TokenResponse>> getTokenStatus(@PathVariable String bookingReference) {
        TokenResponse response = queueService.getPatientTokenByReference(bookingReference);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping(value = "/tokens/{bookingReference}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream live token status updates via Server-Sent Events (SSE)")
    public SseEmitter streamTokenStatus(@PathVariable String bookingReference) {
        return broadcaster.subscribePatient(bookingReference);
    }

    @GetMapping("/hospitals/{hospitalSlug}/doctors/by-name/live-queue")
    @Operation(summary = "Get live doctor queue by doctor name for this hospital")
    public ResponseEntity<ApiResponse<com.citycare.platform.modules.queue.QueueBoardDto>> getDoctorLiveQueueByName(
            @PathVariable String hospitalSlug,
            @RequestParam String name) {
        Hospital hospital = hospitalService.resolveBySlug(hospitalSlug);
        com.citycare.platform.modules.queue.QueueBoardDto board = queueService.getDoctorLiveQueueByNamePublic(hospital.getId(), name);
        return ResponseEntity.ok(ApiResponse.ok(board));
    }

    @GetMapping("/hospitals/{hospitalSlug}/tokens/by-phone")
    @Operation(summary = "Find active token(s) by patient 10-digit mobile phone number")
    public ResponseEntity<ApiResponse<List<TokenResponse>>> getTokensByPhone(
            @PathVariable String hospitalSlug,
            @RequestParam String phone) {
        Hospital hospital = hospitalService.resolveBySlug(hospitalSlug);
        List<TokenResponse> tokens = queueService.getPatientTokensByPhone(hospital.getId(), phone);
        return ResponseEntity.ok(ApiResponse.ok(tokens));
    }

    @PostMapping("/tokens/{bookingReference}/retry-sms")
    @Operation(summary = "Retry sending SMS confirmation for token")
    public ResponseEntity<ApiResponse<TokenResponse>> retryTokenSms(@PathVariable String bookingReference) {
        TokenResponse response = queueService.retryTokenSms(bookingReference);
        String msg = response.isSmsSent() ? "SMS message sent successfully." : "SMS message delivery failed.";
        return ResponseEntity.ok(ApiResponse.ok("SMS_DISPATCHED", msg, response));
    }
}
