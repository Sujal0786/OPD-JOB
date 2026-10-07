package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class InvalidQueueStateTransitionException extends BusinessException {
    public InvalidQueueStateTransitionException(String message) {
        super("INVALID_STATE_TRANSITION", message, HttpStatus.BAD_REQUEST);
    }
}
