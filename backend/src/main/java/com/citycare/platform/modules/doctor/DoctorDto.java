package com.citycare.platform.modules.doctor;

import java.util.UUID;

public class DoctorDto {

    private UUID id;
    private UUID hospitalId;
    private String name;
    private String photoUrl;
    private String specialty;
    private String qualification;
    private String roomNumber;
    private boolean active;
    private int avgConsultationMinutes;

    public DoctorDto() {
    }

    public DoctorDto(UUID id, UUID hospitalId, String name, String photoUrl, String specialty,
                     String qualification, String roomNumber, boolean active, int avgConsultationMinutes) {
        this.id = id;
        this.hospitalId = hospitalId;
        this.name = name;
        this.photoUrl = photoUrl;
        this.specialty = specialty;
        this.qualification = qualification;
        this.roomNumber = roomNumber;
        this.active = active;
        this.avgConsultationMinutes = avgConsultationMinutes;
    }

    public static DoctorDto fromEntity(Doctor d) {
        return new DoctorDto(
                d.getId(),
                d.getHospital().getId(),
                d.getName(),
                d.getPhotoUrl(),
                d.getSpecialty(),
                d.getQualification(),
                d.getRoomNumber(),
                d.isActive(),
                d.getAvgConsultationMinutes()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getHospitalId() {
        return hospitalId;
    }

    public void setHospitalId(UUID hospitalId) {
        this.hospitalId = hospitalId;
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
}
