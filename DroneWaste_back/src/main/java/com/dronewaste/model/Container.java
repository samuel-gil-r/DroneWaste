package com.dronewaste.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Entidad JPA que representa un contenedor de residuos con posición GPS, nivel de llenado y metadatos de escaneo. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "containers")
public class Container {

    @Id
    private String id;           // C01 … C30

    @NotBlank
    private String name;         // "Cll 55 Cra 7"

    private double lat;          // latitud WGS-84
    private double lng;          // longitud WGS-84

    @DecimalMin("0.0") @DecimalMax("1.0")
    private double level;        // 0.0 (vacío) → 1.0 (lleno)

    private String status;       // VACIO | BAJO | MEDIO | ALTO | DESBORDADO

    private String zone;         // Norte | Centro | Sur

    /* Cra 7 / Cra 11 = comercial → tasa alta; residencial → tasa baja */
    private double fillRate;     // incremento por tick: 0.005–0.035

    private LocalDateTime lastScanned; // último timestamp de escaneo por dron
    private String scannedBy;          // ID del dron que realizó el escaneo (D1|D2|D3)
}
