package com.dronewaste.controller;

import com.dronewaste.model.Container;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Controlador REST que expone la ruta D-VRP optimizada para cada camión recolector. */
@RestController
@RequestMapping("/api/routes")
public class RouteController {

    /** GET /api/routes/{truckId} — retorna la lista ordenada de contenedores críticos para el camión. */
    @GetMapping("/{truckId}")
    public ResponseEntity<List<Container>> getRoute(@PathVariable String truckId) {
        return null; // TODO: delegar a RouteOptimizerService
    }

    /** POST /api/routes/{truckId}/recalculate — fuerza recálculo inmediato de la ruta. */
    @PostMapping("/{truckId}/recalculate")
    public ResponseEntity<List<Container>> recalculate(@PathVariable String truckId) {
        return null; // TODO
    }
}
