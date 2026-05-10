package com.dronewaste.controller;

import com.dronewaste.model.Alert;
import com.dronewaste.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Controlador REST que expone el historial de alertas para el feed en tiempo real del dashboard. */
@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService service;

    /** GET /api/alerts — últimas N alertas globales ordenadas por timestamp DESC. */
    @GetMapping
    public ResponseEntity<List<Alert>> getAll(@RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(service.getRecent(limit));
    }

    /** GET /api/alerts/container/{id} — historial de alertas de un contenedor específico. */
    @GetMapping("/container/{id}")
    public ResponseEntity<List<Alert>> getByContainer(@PathVariable String id) {
        return ResponseEntity.ok(service.getByContainer(id));
    }
}
