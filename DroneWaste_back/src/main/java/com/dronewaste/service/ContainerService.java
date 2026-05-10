package com.dronewaste.service;

import com.dronewaste.model.Container;
import com.dronewaste.repository.ContainerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** Servicio que centraliza la lógica de negocio: lectura, actualización y escaneo de contenedores. */
@Service
@RequiredArgsConstructor
public class ContainerService {

    private final ContainerRepository repo;

    @Transactional(readOnly = true)
    public List<Container> findAll(String zone, String status) {
        if (zone != null && status != null) return repo.findByZoneAndStatus(zone, status);
        if (zone   != null)                 return repo.findByZone(zone);
        if (status != null)                 return repo.findByStatus(status);
        return repo.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Container> findById(String id) {
        return repo.findById(id);
    }

    @Transactional
    public Container updateLevel(String id, double newLevel) {
        Container c = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Container not found: " + id));
        c.setLevel(Math.max(0.0, Math.min(1.0, newLevel)));
        c.setStatus(resolveStatus(c.getLevel()));
        return repo.save(c);
    }

    @Transactional
    public Container save(Container container) {
        container.setStatus(resolveStatus(container.getLevel()));
        return repo.save(container);
    }

    /** Registra que un dron escaneó este contenedor (actualiza lastScanned y scannedBy). */
    @Transactional
    public void registerScan(String containerId, String droneId) {
        repo.findById(containerId).ifPresent(c -> {
            c.setLastScanned(LocalDateTime.now());
            c.setScannedBy(droneId);
            repo.save(c);
        });
    }

    public String resolveStatus(double level) {
        if (level < 0.10) return "VACIO";
        if (level < 0.33) return "BAJO";
        if (level < 0.66) return "MEDIO";
        if (level < 0.90) return "ALTO";
        return "DESBORDADO";
    }
}
