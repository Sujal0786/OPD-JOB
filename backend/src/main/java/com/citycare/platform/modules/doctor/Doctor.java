package com.citycare.platform.modules.doctor;

import com.citycare.platform.modules.auth.HospitalUser;
import com.citycare.platform.modules.hospital.Hospital;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "doctors")
public class Doctor {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private HospitalUser user;

    @Column(nullable = false)
    private String name;

    @Column(name = "photo_url", length = 512)
    private String photoUrl;

    @Column(nullable = false, length = 100)
    private String specialty;

    @Column(length = 100)
    private String qualification;

    @Column(name = "room_number", nullable = false, length = 50)
    private String roomNumber;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "avg_consultation_minutes", nullable = false)
    private int avgConsultationMinutes = 10;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Doctor() {
    }

    public Doctor(UUID id, Hospital hospital, HospitalUser user, String name, String photoUrl,
                  String specialty, String qualification, String roomNumber, boolean active, int avgConsultationMinutes) {
        this.id = id != null ? id : UUID.randomUUID();
        this.hospital = hospital;
        this.user = user;
        this.name = name;
        this.photoUrl = photoUrl;
        this.specialty = specialty;
        this.qualification = qualification;
        this.roomNumber = roomNumber;
        this.active = active;
        this.avgConsultationMinutes = avgConsultationMinutes > 0 ? avgConsultationMinutes : 10;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Hospital getHospital() {
        return hospital;
    }

    public void setHospital(Hospital hospital) {
        this.hospital = hospital;
    }

    public HospitalUser getUser() {
        return user;
    }

    public void setUser(HospitalUser user) {
        this.user = user;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getSpecialty() {
        return specialty;
    }

    public void setSpecialty(String specialty) {
        this.specialty = specialty;
    }

    public String getQualification() {
        return qualification;
    }

    public void setQualification(String qualification) {
        this.qualification = qualification;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public int getAvgConsultationMinutes() {
        return avgConsultationMinutes;
    }

    public void setAvgConsultationMinutes(int avgConsultationMinutes) {
        this.avgConsultationMinutes = avgConsultationMinutes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
