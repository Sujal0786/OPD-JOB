package com.citycare.platform.modules.doctor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DoctorCreateRequest {

    @NotBlank(message = "Doctor name is required.")
    @Size(min = 2, max = 255)
    private String name;

    private String photoUrl;

    @NotBlank(message = "Specialty is required.")
    @Size(max = 100)
    private String specialty;

    private String qualification;

    @NotBlank(message = "Room number is required.")
    @Size(max = 50)
    private String roomNumber;

    private int avgConsultationMinutes = 10;

    public DoctorCreateRequest() {
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

    public int getAvgConsultationMinutes() {
        return avgConsultationMinutes;
    }

    public void setAvgConsultationMinutes(int avgConsultationMinutes) {
        this.avgConsultationMinutes = avgConsultationMinutes;
    }
}
