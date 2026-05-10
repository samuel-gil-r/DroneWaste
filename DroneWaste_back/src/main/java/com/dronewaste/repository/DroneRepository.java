package com.dronewaste.repository;

import com.dronewaste.model.Drone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Repositorio Spring Data JPA para operaciones CRUD sobre la entidad Drone. */
@Repository
public interface DroneRepository extends JpaRepository<Drone, String> {}
