package com.dronewaste.service;

import com.dronewaste.model.Alert;
import com.dronewaste.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Servicio que crea, persiste y distribuye alertas cuando un contenedor cambia de estado crítico. */
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository repo;

    @Transactional
    public Alert createOverflowAlert(String containerId) {
        Alert alert = new Alert();
        alert.setContainerId(containerId);
        alert.setType("OVERFLOW");
        alert.setMessage("Contenedor " + containerId + " ha alcanzado nivel DESBORDADO");
        alert.setTimestamp(LocalDateTime.now());
        Alert saved = repo.save(alert);
        pushAlert(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Alert> getRecent(int limit) {
        return repo.findTop20ByOrderByTimestampDesc()
                .stream().limit(limit).toList();
    }

    @Transactional(readOnly = true)
    public List<Alert> getByContainer(String containerId) {
        return repo.findTop10ByContainerIdOrderByTimestampDesc(containerId);
    }

    /** Phase 3: WebSocket push — por ahora no-op. */
    public void pushAlert(Alert alert) {
        // TODO (Fase 3): messagingTemplate.convertAndSend("/topic/alerts", alert)
    }
}
