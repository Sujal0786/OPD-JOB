package com.citycare.platform.modules.queue;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class WalkInBatchRequest {

    private UUID opdSessionId;

    @NotNull(message = "Walk-in count is required.")
    @Min(value = 1, message = "At least 1 walk-in patient must be added.")
    @Max(value = 100, message = "Maximum 100 walk-ins can be added in a single batch.")
    private Integer count;

    private String note;

    public WalkInBatchRequest() {
    }

    public WalkInBatchRequest(UUID opdSessionId, Integer count, String note) {
        this.opdSessionId = opdSessionId;
        this.count = count;
        this.note = note;
    }

    public UUID getOpdSessionId() {
        return opdSessionId;
    }

    public void setOpdSessionId(UUID opdSessionId) {
        this.opdSessionId = opdSessionId;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
