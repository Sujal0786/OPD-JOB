package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class DoctorNotAvailableException extends BusinessException {
    public DoctorNotAvailableException(String message) {
        super("DOCTOR_NOT_AVAILABLE", message, HttpStatus.BAD_REQUEST);
    }
}
