package com.dronewaste.repository;

import com.dronewaste.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Repositorio Spring Data JPA para persistir y consultar alertas ordenadas por timestamp. */
@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {

    /** Retorna las últimas N alertas de un contenedor específico para el feed del frontend. */
    List<Alert> findTop10ByContainerIdOrderByTimestampDesc(String containerId);

    /** Retorna las alertas más recientes globales para el panel lateral del dashboard. */
    List<Alert> findTop20ByOrderByTimestampDesc();
}
