package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class DuplicateTokenRequestException extends BusinessException {
    public DuplicateTokenRequestException(String message) {
        super("DUPLICATE_TOKEN_REQUEST", message, HttpStatus.CONFLICT);
    }
}
