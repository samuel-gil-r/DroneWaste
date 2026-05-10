package com.dronewaste.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** DTO que representa un camión recolector con su zona asignada y color de ruta en el mapa. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Truck {

    private String id;       // R1, R2, R3
    private String label;    // "R1 Norte"
    private double lat;      // posición actual del camión
    private double lng;
    private String color;    // color hex para el mapa
    private String zone;     // Norte | Centro | Sur
}
