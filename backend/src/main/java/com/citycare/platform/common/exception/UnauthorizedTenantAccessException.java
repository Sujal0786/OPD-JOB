package com.citycare.platform.common.exception;

import org.springframework.http.HttpStatus;

public class UnauthorizedTenantAccessException extends BusinessException {
    public UnauthorizedTenantAccessException(String message) {
        super("UNAUTHORIZED_TENANT_ACCESS", message, HttpStatus.FORBIDDEN);
    }
}
