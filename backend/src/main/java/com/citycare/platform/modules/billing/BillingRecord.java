package com.citycare.platform.modules.billing;

import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.opdsession.OpdSession;
import com.citycare.platform.modules.queue.OpdToken;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "billing_records")
public class BillingRecord {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opd_session_id", nullable = false)
    private OpdSession opdSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opd_token_id", nullable = false)
    private OpdToken opdToken;

    @Column(name = "token_number", nullable = false)
    private int tokenNumber;

    @Column(name = "is_billable", nullable = false)
    private boolean billable = false;

    @Column(name = "amount_inr", nullable = false, precision = 10, scale = 2)
    private BigDecimal amountInr = BigDecimal.ZERO;

    @Column(name = "fee_status", nullable = false, length = 30)
    private String feeStatus = "RECORDED";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public BillingRecord() {
    }

    public BillingRecord(UUID id, Hospital hospital, OpdSession opdSession, OpdToken opdToken,
                         int tokenNumber, boolean billable, BigDecimal amountInr, String feeStatus) {
        this.id = id != null ? id : UUID.randomUUID();
        this.hospital = hospital;
        this.opdSession = opdSession;
        this.opdToken = opdToken;
        this.tokenNumber = tokenNumber;
        this.billable = billable;
        this.amountInr = amountInr != null ? amountInr : BigDecimal.ZERO;
        this.feeStatus = feeStatus != null ? feeStatus : "RECORDED";
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Hospital getHospital() {
        return hospital;
    }

    public void setHospital(Hospital hospital) {
        this.hospital = hospital;
    }

    public OpdSession getOpdSession() {
        return opdSession;
    }

    public void setOpdSession(OpdSession opdSession) {
        this.opdSession = opdSession;
    }

    public OpdToken getOpdToken() {
        return opdToken;
    }

    public void setOpdToken(OpdToken opdToken) {
        this.opdToken = opdToken;
    }

    public int getTokenNumber() {
        return tokenNumber;
    }

    public void setTokenNumber(int tokenNumber) {
        this.tokenNumber = tokenNumber;
    }

    public boolean isBillable() {
        return billable;
    }

    public void setBillable(boolean billable) {
        this.billable = billable;
    }

    public BigDecimal getAmountInr() {
        return amountInr;
    }

    public void setAmountInr(BigDecimal amountInr) {
        this.amountInr = amountInr;
    }

    public String getFeeStatus() {
        return feeStatus;
    }

    public void setFeeStatus(String feeStatus) {
        this.feeStatus = feeStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
