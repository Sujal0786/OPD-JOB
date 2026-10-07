package com.citycare.platform.modules.admin;

import com.citycare.platform.modules.hospital.HospitalStatus;

import java.time.Instant;
import java.util.UUID;

public class HospitalAdminSummaryDto {

    private UUID id;
    private String name;
    private String slug;
    private String accessCode;
    private String address;
    private String phone;
    private HospitalStatus status;
    private String adminEmail;
    private String adminName;
    private long doctorCount;
    private long activeSessionCount;
    private Instant createdAt;

    public HospitalAdminSummaryDto() {
    }

    public HospitalAdminSummaryDto(UUID id, String name, String slug, String accessCode, String address, 
                                   String phone, HospitalStatus status, String adminEmail, String adminName, 
                                   long doctorCount, long activeSessionCount, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.accessCode = accessCode;
        this.address = address;
        this.phone = phone;
        this.status = status;
        this.adminEmail = adminEmail;
        this.adminName = adminName;
        this.doctorCount = doctorCount;
        this.activeSessionCount = activeSessionCount;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getAccessCode() {
        return accessCode;
    }

    public void setAccessCode(String accessCode) {
        this.accessCode = accessCode;
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

    public HospitalStatus getStatus() {
        return status;
    }

    public void setStatus(HospitalStatus status) {
        this.status = status;
    }

    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
    }

    public String getAdminName() {
        return adminName;
    }

    public void setAdminName(String adminName) {
        this.adminName = adminName;
    }

    public long getDoctorCount() {
        return doctorCount;
    }

    public void setDoctorCount(long doctorCount) {
        this.doctorCount = doctorCount;
    }

    public long getActiveSessionCount() {
        return activeSessionCount;
    }

    public void setActiveSessionCount(long activeSessionCount) {
        this.activeSessionCount = activeSessionCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
