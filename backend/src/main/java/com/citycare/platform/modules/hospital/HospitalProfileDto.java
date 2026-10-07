package com.citycare.platform.modules.hospital;

import java.time.Instant;
import java.util.UUID;

public class HospitalProfileDto {

    private UUID id;
    private String slug;
    private String accessCode;
    private String name;
    private String address;
    private String phone;
    private String logoUrl;
    private HospitalStatus status;
    private Instant createdAt;

    public HospitalProfileDto() {
    }

    public HospitalProfileDto(UUID id, String slug, String accessCode, String name,
                              String address, String phone, String logoUrl, HospitalStatus status, Instant createdAt) {
        this.id = id;
        this.slug = slug;
        this.accessCode = accessCode;
        this.name = name;
        this.address = address;
        this.phone = phone;
        this.logoUrl = logoUrl;
        this.status = status;
        this.createdAt = createdAt;
    }

    public static HospitalProfileDto fromEntity(Hospital h) {
        return new HospitalProfileDto(
                h.getId(),
                h.getSlug(),
                h.getAccessCode(),
                h.getName(),
                h.getAddress(),
                h.getPhone(),
                h.getLogoUrl(),
                h.getStatus(),
                h.getCreatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public HospitalStatus getStatus() {
        return status;
    }

    public void setStatus(HospitalStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
