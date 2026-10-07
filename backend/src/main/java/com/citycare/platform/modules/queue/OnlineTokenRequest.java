package com.citycare.platform.modules.queue;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public class OnlineTokenRequest {

    @NotNull(message = "Hospital ID is required.")
    private UUID hospitalId;

    @NotNull(message = "OPD Session ID is required.")
    private UUID opdSessionId;

    @NotBlank(message = "Patient name is required.")
    @Size(min = 2, max = 255, message = "Name must be between 2 and 255 characters.")
    private String patientName;

    @NotBlank(message = "Phone number is required.")
    @Pattern(regexp = "^[0-9]{10}$", message = "Phone number must be a valid 10-digit mobile number.")
    private String patientPhone;

    @Size(max = 255, message = "Location cannot exceed 255 characters.")
    private String patientLocation;

    @Min(value = 0, message = "Age cannot be negative.")
    @Max(value = 130, message = "Invalid age.")
    private Integer patientAge;

    private String patientGender;

    @Size(max = 500, message = "Reason for visit cannot exceed 500 characters.")
    private String reasonForVisit;

    private String idempotencyKey;

    public OnlineTokenRequest() {
    }

    public UUID getHospitalId() {
        return hospitalId;
    }

    public void setHospitalId(UUID hospitalId) {
        this.hospitalId = hospitalId;
    }

    public UUID getOpdSessionId() {
        return opdSessionId;
    }

    public void setOpdSessionId(UUID opdSessionId) {
        this.opdSessionId = opdSessionId;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientPhone() {
        return patientPhone;
    }

    public void setPatientPhone(String patientPhone) {
        this.patientPhone = patientPhone;
    }

    public String getPatientLocation() {
        return patientLocation;
    }

    public void setPatientLocation(String patientLocation) {
        this.patientLocation = patientLocation;
    }

    public Integer getPatientAge() {
        return patientAge;
    }

    public void setPatientAge(Integer patientAge) {
        this.patientAge = patientAge;
    }

    public String getPatientGender() {
        return patientGender;
    }

    public void setPatientGender(String patientGender) {
        this.patientGender = patientGender;
    }

    public String getReasonForVisit() {
        return reasonForVisit;
    }

    public void setReasonForVisit(String reasonForVisit) {
        this.reasonForVisit = reasonForVisit;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }
}
