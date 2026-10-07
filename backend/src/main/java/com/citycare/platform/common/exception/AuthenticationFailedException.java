package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class AuthenticationFailedException extends BusinessException {
    public AuthenticationFailedException(String message) {
        super("AUTHENTICATION_FAILED", message, HttpStatus.UNAUTHORIZED);
    }
}
