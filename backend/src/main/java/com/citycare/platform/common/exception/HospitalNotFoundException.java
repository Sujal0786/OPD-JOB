package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class HospitalNotFoundException extends BusinessException {
    public HospitalNotFoundException(String message) {
        super("HOSPITAL_NOT_FOUND", message, HttpStatus.NOT_FOUND);
    }
}
