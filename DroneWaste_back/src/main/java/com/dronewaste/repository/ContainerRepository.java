package com.dronewaste.repository;

import com.dronewaste.model.Container;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Repositorio Spring Data JPA para operaciones CRUD y consultas sobre la entidad Container. */
@Repository
public interface ContainerRepository extends JpaRepository<Container, String> {

    /** Busca contenedores por estado (ej: DESBORDADO) para filtrar los críticos. */
    List<Container> findByStatus(String status);

    /** Busca contenedores por zona para asignarlos al camión correcto. */
    List<Container> findByZone(String zone);

    /** Busca contenedores de una zona con un estado específico (ej: críticos del Norte). */
    List<Container> findByZoneAndStatus(String zone, String status);
}
