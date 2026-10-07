package com.citycare.platform.modules.auth;

import com.citycare.platform.common.dto.ApiResponse;
import com.citycare.platform.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Endpoints for login, token refresh, and hospital registration")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "Staff authentication", description = "Authenticates hospital staff and returns JWT tokens.")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("LOGIN_SUCCESS", "Authentication successful.", response));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token", description = "Issues a new access and refresh token.")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        LoginResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.ok("TOKEN_REFRESHED", "Tokens successfully refreshed.", response));
    }

    @PostMapping("/register-hospital")
    @Operation(summary = "Register a new hospital tenant", description = "Onboards a hospital tenant and its initial administrator.")
    public ResponseEntity<ApiResponse<LoginResponse>> registerHospital(@Valid @RequestBody HospitalRegistrationRequest request) {
        LoginResponse response = authService.registerHospital(request);
        return ResponseEntity.ok(ApiResponse.ok("HOSPITAL_REGISTERED", "Hospital and administrator registered successfully.", response));
    }

    @GetMapping("/me")
    @Operation(summary = "Current staff user profile", description = "Returns details of the currently authenticated staff user.")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(ApiResponse.ok(Map.of("authenticated", false)));
        }
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "userId", principal.getId(),
                "email", principal.getUsername(),
                "role", principal.getRole(),
                "hospitalId", principal.getHospitalId() != null ? principal.getHospitalId() : "",
                "authenticated", true
        )));
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<String>> healthCheck() {
        return ResponseEntity.ok(ApiResponse.ok("CityCare Platform Engine Active."));
    }
}
