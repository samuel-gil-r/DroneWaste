package com.dronewaste.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Entidad JPA que registra una alerta generada cuando un contenedor supera el umbral configurado. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alerts")
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String containerId;  // referencia al contenedor (C01…C30)
    private String type;         // OVERFLOW | HIGH | ROUTE_RECALC
    private String message;      // descripción legible
    private LocalDateTime timestamp;
}
