package com.citycare.platform.modules.queue;

import java.util.Set;

public enum TokenStatus {
    CREATED,
    WAITING,
    RECEIVED_BY_HOSPITAL,
    CALLED,
    IN_CONSULTATION,
    COMPLETED,
    CANCELLED,
    SKIPPED,
    NO_SHOW;

    /**
     * State machine validation: defines allowed next states from the current status.
     */
    public boolean canTransitionTo(TokenStatus nextStatus) {
        if (this == nextStatus) {
            return true; // No-op transition
        }

        return switch (this) {
            case CREATED -> Set.of(WAITING, CANCELLED).contains(nextStatus);
            case WAITING -> Set.of(RECEIVED_BY_HOSPITAL, CALLED, SKIPPED, CANCELLED, NO_SHOW).contains(nextStatus);
            case RECEIVED_BY_HOSPITAL -> Set.of(CALLED, SKIPPED, CANCELLED, NO_SHOW).contains(nextStatus);
            case CALLED -> Set.of(IN_CONSULTATION, SKIPPED, NO_SHOW, CANCELLED).contains(nextStatus);
            case SKIPPED -> Set.of(CALLED, CANCELLED, NO_SHOW).contains(nextStatus); // Recall allowed
            case IN_CONSULTATION -> Set.of(COMPLETED, CANCELLED).contains(nextStatus);
            case COMPLETED, CANCELLED, NO_SHOW -> false; // Terminal states
        };
    }
}
