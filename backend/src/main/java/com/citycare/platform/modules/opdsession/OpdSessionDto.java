package com.citycare.platform.modules.opdsession;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public class OpdSessionDto {

    private UUID id;
    private UUID hospitalId;
    private UUID doctorId;
    private String doctorName;
    private String doctorSpecialty;
    private String doctorRoomNumber;
    private String doctorPhotoUrl;
    private LocalDate sessionDate;
    private String sessionName;
    private LocalTime startTime;
    private LocalTime endTime;
    private OpdSessionStatus status;
    private Integer currentServingToken;
    private int nextTokenSequence;
    private int waitingCount;
    private int completedCount;
    private int totalOnlineCount;
    private int totalWalkinCount;

    public OpdSessionDto() {
    }

    public static OpdSessionDto fromEntity(OpdSession s, Integer currentServing, int nextSeq, int waiting, int completed, int online, int walkins) {
        OpdSessionDto dto = new OpdSessionDto();
        dto.id = s.getId();
        dto.hospitalId = s.getHospital().getId();
        dto.doctorId = s.getDoctor().getId();
        dto.doctorName = s.getDoctor().getName();
        dto.doctorSpecialty = s.getDoctor().getSpecialty();
        dto.doctorRoomNumber = s.getDoctor().getRoomNumber();
        dto.doctorPhotoUrl = s.getDoctor().getPhotoUrl();
        dto.sessionDate = s.getSessionDate();
        dto.sessionName = s.getSessionName();
        dto.startTime = s.getStartTime();
        dto.endTime = s.getEndTime();
        dto.status = s.getStatus();
        dto.currentServingToken = currentServing;
        dto.nextTokenSequence = nextSeq;
        dto.waitingCount = waiting;
        dto.completedCount = completed;
        dto.totalOnlineCount = online;
        dto.totalWalkinCount = walkins;
        return dto;
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

    public String getDoctorPhotoUrl() {
        return doctorPhotoUrl;
    }

    public void setDoctorPhotoUrl(String doctorPhotoUrl) {
        this.doctorPhotoUrl = doctorPhotoUrl;
    }

    public LocalDate getSessionDate() {
        return sessionDate;
    }

    public void setSessionDate(LocalDate sessionDate) {
        this.sessionDate = sessionDate;
    }

    public String getSessionName() {
        return sessionName;
    }

    public void setSessionName(String sessionName) {
        this.sessionName = sessionName;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public OpdSessionStatus getStatus() {
        return status;
    }

    public void setStatus(OpdSessionStatus status) {
        this.status = status;
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
}
