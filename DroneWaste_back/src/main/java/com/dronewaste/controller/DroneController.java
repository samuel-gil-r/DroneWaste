package com.dronewaste.controller;

import com.dronewaste.model.Drone;
import com.dronewaste.service.DroneService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Controlador REST para consultar el estado de la flota y registrar posiciones de telemetría. */
@RestController
@RequestMapping("/api/drones")
@RequiredArgsConstructor
public class DroneController {

    private final DroneService service;

    /** GET /api/drones — retorna posición, ángulo y batería de los tres drones. */
    @GetMapping
    public ResponseEntity<List<Drone>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    /** GET /api/drones/{id} — telemetría de un dron individual. */
    @GetMapping("/{id}")
    public ResponseEntity<Drone> getById(@PathVariable String id) {
        return service.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** POST /api/drones/{id}/position — recibe telemetría del dron (lat, lng, angle, battery). */
    @PostMapping("/{id}/position")
    public ResponseEntity<Drone> updatePosition(@PathVariable String id,
                                                @RequestBody Drone telemetry) {
        return ResponseEntity.ok(service.updatePosition(
                id, telemetry.getLat(), telemetry.getLng(),
                telemetry.getAngle(), telemetry.getBattery()));
    }
}
