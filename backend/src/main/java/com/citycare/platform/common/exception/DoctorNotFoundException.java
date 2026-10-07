package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class DoctorNotFoundException extends BusinessException {
    public DoctorNotFoundException(String message) {
        super("DOCTOR_NOT_FOUND", message, HttpStatus.NOT_FOUND);
    }
}
