package com.citycare.platform.modules.queue;

import com.citycare.platform.modules.opdsession.OpdSession;

import java.time.Instant;
import java.util.UUID;

public class TokenResponse {

    private UUID id;
    private UUID hospitalId;
    private String hospitalName;
    private UUID sessionId;
    private String sessionName;
    private UUID doctorId;
    private String doctorName;
    private String doctorSpecialty;
    private String doctorRoomNumber;
    private int tokenNumber;
    private TokenType tokenType;
    private String bookingReference;
    private TokenStatus status;
    private String patientName;
    private String patientPhone;
    private String patientLocation;
    private Integer patientAge;
    private String patientGender;
    private String reasonForVisit;
    private Integer currentServingToken;
    private int tokensAhead;
    private int estimatedWaitMinutes;
    private Instant createdAt;

    public TokenResponse() {
    }

    public static TokenResponse fromEntity(OpdToken t, Integer currentServing, int tokensAhead, int avgWaitPerToken) {
        return fromEntity(t, t.getOpdSession(), currentServing, tokensAhead, avgWaitPerToken);
    }

    public static TokenResponse fromEntity(OpdToken t, OpdSession session, Integer currentServing, int tokensAhead, int avgWaitPerToken) {
        TokenResponse res = new TokenResponse();
        res.id = t.getId();
        res.hospitalId = session != null ? session.getHospital().getId() : t.getHospital().getId();
        res.hospitalName = session != null ? session.getHospital().getName() : t.getHospital().getName();
        res.sessionId = session != null ? session.getId() : t.getOpdSession().getId();
        res.sessionName = session != null ? session.getSessionName() : t.getOpdSession().getSessionName();
        res.doctorId = session != null ? session.getDoctor().getId() : t.getOpdSession().getDoctor().getId();
        res.doctorName = session != null ? session.getDoctor().getName() : t.getOpdSession().getDoctor().getName();
        res.doctorSpecialty = session != null ? session.getDoctor().getSpecialty() : t.getOpdSession().getDoctor().getSpecialty();
        res.doctorRoomNumber = session != null ? session.getDoctor().getRoomNumber() : t.getOpdSession().getDoctor().getRoomNumber();
        res.tokenNumber = t.getTokenNumber();
        res.tokenType = t.getTokenType();
        res.bookingReference = t.getBookingReference();
        res.status = t.getStatus();
        res.patientName = t.getPatientName();
        res.patientPhone = t.getPatientPhone();
        res.patientLocation = t.getPatientLocation();
        res.patientAge = t.getPatientAge();
        res.patientGender = t.getPatientGender();
        res.reasonForVisit = t.getReasonForVisit();
        res.currentServingToken = currentServing;
        res.tokensAhead = Math.max(0, tokensAhead);
        res.estimatedWaitMinutes = res.tokensAhead * (avgWaitPerToken > 0 ? avgWaitPerToken : 10);
        res.createdAt = t.getCreatedAt();
        res.smsSent = Boolean.TRUE.equals(t.getSmsSent());
        res.smsError = t.getSmsError();
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getHospitalId() {
        return hospitalId;
    }

    public void setHospitalId(UUID hospitalId) {
        this.hospitalId = hospitalId;
    }

    public String getHospitalName() {
        return hospitalName;
    }

    public void setHospitalName(String hospitalName) {
        this.hospitalName = hospitalName;
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public void setSessionId(UUID sessionId) {
        this.sessionId = sessionId;
    }

    public String getSessionName() {
        return sessionName;
    }

    public void setSessionName(String sessionName) {
        this.sessionName = sessionName;
    }

    public UUID getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(UUID doctorId) {
        this.doctorId = doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getDoctorSpecialty() {
        return doctorSpecialty;
    }

    public void setDoctorSpecialty(String doctorSpecialty) {
        this.doctorSpecialty = doctorSpecialty;
    }

    public String getDoctorRoomNumber() {
        return doctorRoomNumber;
    }

    public void setDoctorRoomNumber(String doctorRoomNumber) {
        this.doctorRoomNumber = doctorRoomNumber;
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

    public Integer getCurrentServingToken() {
        return currentServingToken;
    }

    public void setCurrentServingToken(Integer currentServingToken) {
        this.currentServingToken = currentServingToken;
    }

    public int getTokensAhead() {
        return tokensAhead;
    }

    public void setTokensAhead(int tokensAhead) {
        this.tokensAhead = tokensAhead;
    }

    public int getEstimatedWaitMinutes() {
        return estimatedWaitMinutes;
    }

    public void setEstimatedWaitMinutes(int estimatedWaitMinutes) {
        this.estimatedWaitMinutes = estimatedWaitMinutes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    private boolean smsSent;
    private String smsMessage;
    private String smsError;

    public boolean isSmsSent() {
        return smsSent;
    }

    public void setSmsSent(boolean smsSent) {
        this.smsSent = smsSent;
    }

    public String getSmsMessage() {
        return smsMessage;
    }

    public void setSmsMessage(String smsMessage) {
        this.smsMessage = smsMessage;
    }

    public String getSmsError() {
        return smsError;
    }

    public void setSmsError(String smsError) {
        this.smsError = smsError;
    }
}
