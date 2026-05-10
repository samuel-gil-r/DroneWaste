package com.dronewaste.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Entidad JPA que representa la posición y estado de batería de un dron autónomo en vuelo. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drones")
public class Drone {

    @Id
    private String id;        // D1, D2, D3

    private double lat;       // latitud actual
    private double lng;       // longitud actual
    private double angle;     // rumbo en grados 0-360
    private String status;    // ACTIVE | CHARGING | OFFLINE
    private int battery;      // porcentaje 0-100
}
