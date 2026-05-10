package com.dronewaste.controller;

import com.dronewaste.model.Container;
import com.dronewaste.service.RouteOptimizerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Controlador REST que expone la ruta D-VRP optimizada para cada camión recolector. */
@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {

    private final RouteOptimizerService routeOptimizer;

    /** GET /api/routes/{truckId} — retorna la lista ordenada de contenedores críticos para el camión. */
    @GetMapping("/{truckId}")
    public ResponseEntity<List<Container>> getRoute(@PathVariable String truckId) {
        List<Container> route = routeOptimizer.getOptimizedRoute(truckId);
        return ResponseEntity.ok(route);
    }

    /** POST /api/routes/{truckId}/recalculate — fuerza recálculo inmediato de la ruta. */
    @PostMapping("/{truckId}/recalculate")
    public ResponseEntity<List<Container>> recalculate(@PathVariable String truckId) {
        List<Container> route = routeOptimizer.getOptimizedRoute(truckId);
        return ResponseEntity.ok(route);
    }
}
