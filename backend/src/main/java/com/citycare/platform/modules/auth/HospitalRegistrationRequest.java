package com.citycare.platform.modules.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class HospitalRegistrationRequest {

    @NotBlank(message = "Hospital name is required.")
    @Size(min = 3, max = 255)
    private String hospitalName;

    @NotBlank(message = "Slug is required.")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Slug must contain only lowercase letters, numbers, and hyphens.")
    @Size(min = 3, max = 64)
    private String slug;

    private String address;

    @Pattern(regexp = "^[0-9+ -]{7,20}$", message = "Invalid phone number format.")
    private String phone;

    @NotBlank(message = "Administrator full name is required.")
    private String adminFullName;

    @NotBlank(message = "Administrator email is required.")
    @Email(message = "Valid email is required.")
    private String adminEmail;

    @NotBlank(message = "Administrator password is required.")
    @Size(min = 8, message = "Password must be at least 8 characters long.")
    private String adminPassword;

    public HospitalRegistrationRequest() {
    }

    public String getHospitalName() {
        return hospitalName;
    }

    public void setHospitalName(String hospitalName) {
        this.hospitalName = hospitalName;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAdminFullName() {
        return adminFullName;
    }

    public void setAdminFullName(String adminFullName) {
        this.adminFullName = adminFullName;
    }

    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
