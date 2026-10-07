package com.citycare.platform.modules.queue;

import jakarta.validation.constraints.NotNull;

public class TokenStatusUpdateRequest {

    @NotNull(message = "New status is required.")
    private TokenStatus status;

    private String reason;

    public TokenStatusUpdateRequest() {
    }

    public TokenStatusUpdateRequest(TokenStatus status, String reason) {
        this.status = status;
        this.reason = reason;
    }

    public TokenStatus getStatus() {
        return status;
    }

    public void setStatus(TokenStatus status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
