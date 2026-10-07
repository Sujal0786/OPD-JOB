package com.citycare.platform.modules.auth;

import java.util.UUID;

public class LoginResponse {

    private String accessToken;
    private String refreshToken;
    private UUID userId;
    private String email;
    private String fullName;
    private Role role;
    private UUID hospitalId;
    private String hospitalName;
    private String hospitalSlug;
    private String hospitalAccessCode;

    public LoginResponse() {
    }

    public LoginResponse(String accessToken, String refreshToken, UUID userId, String email,
                         String fullName, Role role, UUID hospitalId, String hospitalName, String hospitalSlug) {
        this(accessToken, refreshToken, userId, email, fullName, role, hospitalId, hospitalName, hospitalSlug, null);
    }

    public LoginResponse(String accessToken, String refreshToken, UUID userId, String email,
                         String fullName, Role role, UUID hospitalId, String hospitalName, String hospitalSlug, String hospitalAccessCode) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.userId = userId;
        this.email = email;
        this.fullName = fullName;
        this.role = role;
        this.hospitalId = hospitalId;
        this.hospitalName = hospitalName;
        this.hospitalSlug = hospitalSlug;
        this.hospitalAccessCode = hospitalAccessCode;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public UUID getHospitalId() {
        return hospitalId;
    }

    public void setHospitalId(UUID hospitalId) {
        this.hospitalId = hospitalId;
    }

    public String getHospitalName() {
        return hospitalName;
    }

    public void setHospitalName(String hospitalName) {
        this.hospitalName = hospitalName;
    }

    public String getHospitalSlug() {
        return hospitalSlug;
    }

    public void setHospitalSlug(String hospitalSlug) {
        this.hospitalSlug = hospitalSlug;
    }

    public String getHospitalAccessCode() {
        return hospitalAccessCode;
    }

    public void setHospitalAccessCode(String hospitalAccessCode) {
        this.hospitalAccessCode = hospitalAccessCode;
    }
}
