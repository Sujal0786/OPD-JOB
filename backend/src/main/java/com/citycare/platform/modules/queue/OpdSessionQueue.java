package com.citycare.platform.modules.queue;

import com.citycare.platform.modules.hospital.Hospital;
import com.citycare.platform.modules.opdsession.OpdSession;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "opd_session_queues")
public class OpdSessionQueue {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opd_session_id", nullable = false, unique = true)
    private OpdSession opdSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @Column(name = "next_token_sequence", nullable = false)
    private int nextTokenSequence = 1;

    @Column(name = "current_serving_token")
    private Integer currentServingToken;

    @Column(name = "total_online_count", nullable = false)
    private int totalOnlineCount = 0;

    @Column(name = "total_walkin_count", nullable = false)
    private int totalWalkinCount = 0;

    @Version
    @Column(nullable = false)
    private long version = 0L;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public OpdSessionQueue() {
    }

    public OpdSessionQueue(UUID id, OpdSession opdSession, Hospital hospital) {
        this.id = id != null ? id : UUID.randomUUID();
        this.opdSession = opdSession;
        this.hospital = hospital;
        this.nextTokenSequence = 1;
        this.currentServingToken = null;
        this.totalOnlineCount = 0;
        this.totalWalkinCount = 0;
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

    public OpdSession getOpdSession() {
        return opdSession;
    }

    public void setOpdSession(OpdSession opdSession) {
        this.opdSession = opdSession;
    }

    public Hospital getHospital() {
        return hospital;
    }

    public void setHospital(Hospital hospital) {
        this.hospital = hospital;
    }

    public int getNextTokenSequence() {
        return nextTokenSequence;
    }

    public void setNextTokenSequence(int nextTokenSequence) {
        this.nextTokenSequence = nextTokenSequence;
    }

    public Integer getCurrentServingToken() {
        return currentServingToken;
    }

    public void setCurrentServingToken(Integer currentServingToken) {
        this.currentServingToken = currentServingToken;
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

    public long getVersion() {
        return version;
    }

    public void setVersion(long version) {
        this.version = version;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
