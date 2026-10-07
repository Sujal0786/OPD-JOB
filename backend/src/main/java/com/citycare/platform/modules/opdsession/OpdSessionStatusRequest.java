package com.citycare.platform.modules.opdsession;

import jakarta.validation.constraints.NotNull;

public class OpdSessionStatusRequest {

    @NotNull(message = "Session status is required.")
    private OpdSessionStatus status;

    public OpdSessionStatusRequest() {
    }

    public OpdSessionStatusRequest(OpdSessionStatus status) {
        this.status = status;
    }

    public OpdSessionStatus getStatus() {
        return status;
    }

    public void setStatus(OpdSessionStatus status) {
        this.status = status;
    }
}
