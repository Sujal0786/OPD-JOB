package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class InvalidWalkInCountException extends BusinessException {
    public InvalidWalkInCountException(String message) {
        super("INVALID_WALKIN_COUNT", message, HttpStatus.BAD_REQUEST);
    }
}
