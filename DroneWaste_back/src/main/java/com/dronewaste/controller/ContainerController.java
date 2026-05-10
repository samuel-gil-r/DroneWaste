package com.dronewaste.controller;

import com.dronewaste.model.Container;
import com.dronewaste.service.ContainerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Controlador REST que expone los 30 contenedores de Chapinero con soporte de filtrado por zona y estado. */
@RestController
@RequestMapping("/api/containers")
@RequiredArgsConstructor
public class ContainerController {

    private final ContainerService service;

    /** GET /api/containers — lista todos (o filtra por ?zone= y/o ?status=). */
    @GetMapping
    public ResponseEntity<List<Container>> getAll(
            @RequestParam(required = false) String zone,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(service.findAll(zone, status));
    }

    /** GET /api/containers/{id} — detalle de un contenedor específico. */
    @GetMapping("/{id}")
    public ResponseEntity<Container> getById(@PathVariable String id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** PUT /api/containers/{id} — actualiza nivel y/o estado desde el dron o el dashboard. */
    @PutMapping("/{id}")
    public ResponseEntity<Container> update(@PathVariable String id,
                                            @RequestBody Container body) {
        body.setId(id);
        return ResponseEntity.ok(service.save(body));
    }
}
