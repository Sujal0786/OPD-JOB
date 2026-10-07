package com.citycare.platform.modules.admin;

import com.citycare.platform.modules.hospital.HospitalStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class HospitalAdminUpdateRequest {

    @NotBlank(message = "Hospital name cannot be empty.")
    @Size(min = 3, max = 255)
    private String name;

    private String address;
    private String phone;
    private String accessCode;
    private HospitalStatus status;

    public HospitalAdminUpdateRequest() {
    }

    public HospitalAdminUpdateRequest(String name, String address, String phone, String accessCode, HospitalStatus status) {
        this.name = name;
        this.address = address;
        this.phone = phone;
        this.accessCode = accessCode;
        this.status = status;
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

    public String getAccessCode() {
        return accessCode;
    }

    public void setAccessCode(String accessCode) {
        this.accessCode = accessCode;
    }

    public HospitalStatus getStatus() {
        return status;
    }

    public void setStatus(HospitalStatus status) {
        this.status = status;
    }
}
