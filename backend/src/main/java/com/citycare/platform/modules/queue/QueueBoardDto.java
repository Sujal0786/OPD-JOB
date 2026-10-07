package com.citycare.platform.modules.queue;

import java.util.List;
import java.util.UUID;

public class QueueBoardDto {

    private UUID sessionId;
    private String sessionName;
    private UUID doctorId;
    private String doctorName;
    private String doctorRoomNumber;
    private Integer currentServingToken;
    private int nextTokenSequence;
    private int totalOnlineCount;
    private int totalWalkinCount;
    private int waitingCount;
    private int completedCount;
    private List<TokenResponse> activeTokens;

    public QueueBoardDto() {
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

    public String getDoctorRoomNumber() {
        return doctorRoomNumber;
    }

    public void setDoctorRoomNumber(String doctorRoomNumber) {
        this.doctorRoomNumber = doctorRoomNumber;
    }

    public Integer getCurrentServingToken() {
        return currentServingToken;
    }

    public void setCurrentServingToken(Integer currentServingToken) {
        this.currentServingToken = currentServingToken;
    }

    public int getNextTokenSequence() {
        return nextTokenSequence;
    }

    public void setNextTokenSequence(int nextTokenSequence) {
        this.nextTokenSequence = nextTokenSequence;
    }

    public int getTotalOnlineCount() {
        return totalOnlineCount;
    }

    public void setTotalOnlineCount(int totalOnlineCount) {
        this.totalOnlineCount = totalOnlineCount;
    }

    public int getTotalWalkinCount() {
        return totalWalkinCount;
    }

    public void setTotalWalkinCount(int totalWalkinCount) {
        this.totalWalkinCount = totalWalkinCount;
    }

    public int getWaitingCount() {
        return waitingCount;
    }

    public void setWaitingCount(int waitingCount) {
        this.waitingCount = waitingCount;
    }

    public int getCompletedCount() {
        return completedCount;
    }

    public void setCompletedCount(int completedCount) {
        this.completedCount = completedCount;
    }

    public List<TokenResponse> getActiveTokens() {
        return activeTokens;
    }

    public void setActiveTokens(List<TokenResponse> activeTokens) {
        this.activeTokens = activeTokens;
    }
}
