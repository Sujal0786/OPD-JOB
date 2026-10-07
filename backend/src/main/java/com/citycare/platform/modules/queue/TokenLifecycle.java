package com.citycare.platform.modules.queue;

import com.citycare.platform.modules.auth.HospitalUser;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "token_lifecycles")
public class TokenLifecycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opd_token_id", nullable = false)
    private OpdToken opdToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30)
    private TokenStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30)
    private TokenStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_user_id")
    private HospitalUser changedByUser;

    @Column(length = 255)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public TokenLifecycle() {
    }

    public TokenLifecycle(OpdToken opdToken, TokenStatus fromStatus, TokenStatus toStatus,
                          HospitalUser changedByUser, String reason) {
        this.opdToken = opdToken;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.changedByUser = changedByUser;
        this.reason = reason;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public OpdToken getOpdToken() {
        return opdToken;
    }

    public void setOpdToken(OpdToken opdToken) {
        this.opdToken = opdToken;
    }

    public TokenStatus getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(TokenStatus fromStatus) {
        this.fromStatus = fromStatus;
    }

    public TokenStatus getToStatus() {
        return toStatus;
    }

    public void setToStatus(TokenStatus toStatus) {
        this.toStatus = toStatus;
    }

    public HospitalUser getChangedByUser() {
        return changedByUser;
    }

    public void setChangedByUser(HospitalUser changedByUser) {
        this.changedByUser = changedByUser;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
