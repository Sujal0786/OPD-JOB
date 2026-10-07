package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class OpdSessionClosedException extends BusinessException {
    public OpdSessionClosedException(String message) {
        super("OPD_SESSION_CLOSED", message, HttpStatus.BAD_REQUEST);
    }
}
