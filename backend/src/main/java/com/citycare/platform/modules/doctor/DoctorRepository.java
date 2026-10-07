package com.citycare.platform.modules.doctor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, UUID> {
    List<Doctor> findAllByHospitalIdAndActiveTrue(UUID hospitalId);
    List<Doctor> findAllByHospitalId(UUID hospitalId);
    Optional<Doctor> findByIdAndHospitalId(UUID id, UUID hospitalId);
    List<Doctor> findAllByHospitalIdAndNameContainingIgnoreCase(UUID hospitalId, String name);
    Optional<Doctor> findFirstByHospitalIdAndNameIgnoreCase(UUID hospitalId, String name);
}
