package com.citycare.platform.modules.queue;

import com.citycare.platform.modules.auth.HospitalUser;
import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.opdsession.OpdSession;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "opd_tokens",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_session_token_number", columnNames = {"opd_session_id", "token_number"}),
                @UniqueConstraint(name = "uq_booking_reference", columnNames = {"booking_reference"})
        }
)
public class OpdToken {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opd_session_id", nullable = false)
    private OpdSession opdSession;

    @Column(name = "token_number", nullable = false)
    private int tokenNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "token_type", nullable = false, length = 20)
    private TokenType tokenType;

    @Column(name = "booking_reference", nullable = false, unique = true, length = 64)
    private String bookingReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TokenStatus status = TokenStatus.WAITING;

    @Column(name = "patient_name")
    private String patientName;

    @Column(name = "patient_phone", length = 20)
    private String patientPhone;

    @Column(name = "patient_location", length = 255)
    private String patientLocation;

    @Column(name = "patient_age")
    private Integer patientAge;

    @Column(name = "patient_gender", length = 20)
    private String patientGender;

    @Column(name = "reason_for_visit", length = 500)
    private String reasonForVisit;

    @Column(name = "sms_sent")
    private Boolean smsSent = false;

    @Column(name = "sms_error", length = 500)
    private String smsError;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_staff_id")
    private HospitalUser createdByStaff;

    @Column(name = "idempotency_key", unique = true, length = 128)
    private String idempotencyKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public OpdToken() {
    }

    public OpdToken(UUID id, Hospital hospital, OpdSession opdSession, int tokenNumber,
                    TokenType tokenType, String bookingReference, TokenStatus status,
                    String patientName, String patientPhone, Integer patientAge,
                    String patientGender, String reasonForVisit, HospitalUser createdByStaff,
                    String idempotencyKey) {
        this.id = id != null ? id : UUID.randomUUID();
        this.hospital = hospital;
        this.opdSession = opdSession;
        this.tokenNumber = tokenNumber;
        this.tokenType = tokenType;
        this.bookingReference = bookingReference != null ? bookingReference : UUID.randomUUID().toString().replace("-", "");
        this.status = status != null ? status : TokenStatus.WAITING;
        this.patientName = patientName;
        this.patientPhone = patientPhone;
        this.patientAge = patientAge;
        this.patientGender = patientGender;
        this.reasonForVisit = reasonForVisit;
        this.createdByStaff = createdByStaff;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
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

    public int getTokenNumber() {
        return tokenNumber;
    }

    public void setTokenNumber(int tokenNumber) {
        this.tokenNumber = tokenNumber;
    }

    public TokenType getTokenType() {
        return tokenType;
    }

    public void setTokenType(TokenType tokenType) {
        this.tokenType = tokenType;
    }

    public String getBookingReference() {
        return bookingReference;
    }

    public void setBookingReference(String bookingReference) {
        this.bookingReference = bookingReference;
    }

    public TokenStatus getStatus() {
        return status;
    }

    public void setStatus(TokenStatus status) {
        this.status = status;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientPhone() {
        return patientPhone;
    }

    public void setPatientPhone(String patientPhone) {
        this.patientPhone = patientPhone;
    }

    public String getPatientLocation() {
        return patientLocation;
    }

    public void setPatientLocation(String patientLocation) {
        this.patientLocation = patientLocation;
    }

    public Integer getPatientAge() {
        return patientAge;
    }

    public void setPatientAge(Integer patientAge) {
        this.patientAge = patientAge;
    }

    public String getPatientGender() {
        return patientGender;
    }

    public void setPatientGender(String patientGender) {
        this.patientGender = patientGender;
    }

    public String getReasonForVisit() {
        return reasonForVisit;
    }

    public void setReasonForVisit(String reasonForVisit) {
        this.reasonForVisit = reasonForVisit;
    }

    public HospitalUser getCreatedByStaff() {
        return createdByStaff;
    }

    public void setCreatedByStaff(HospitalUser createdByStaff) {
        this.createdByStaff = createdByStaff;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getSmsSent() {
        return smsSent;
    }

    public void setSmsSent(Boolean smsSent) {
        this.smsSent = smsSent;
    }

    public String getSmsError() {
        return smsError;
    }

    public void setSmsError(String smsError) {
        this.smsError = smsError;
    }
}
