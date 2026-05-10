package com.dronewaste.service;

import com.dronewaste.model.Container;
import com.dronewaste.model.Drone;
import com.dronewaste.repository.ContainerRepository;
import com.dronewaste.repository.DroneRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Simula el desplazamiento de drones patrullando contenedores de su zona en Chapinero. */
@Service
@RequiredArgsConstructor
public class DroneService {

    private final DroneRepository      repo;
    private final ContainerRepository  containerRepo;

    private static final double MIN_LAT =  4.626, MAX_LAT =  4.677;
    private static final double MIN_LNG = -74.078, MAX_LNG = -74.045;

    private static final double PATROL_SPEED   = 0.00028; // °/tick — ~30 m cada 2 s
    private static final double ARRIVE_THRESH  = 0.0025;  // °   — ~280 m → cambia objetivo

    /* Zona asignada a cada dron */
    private static final Map<String, String> DRONE_ZONE = Map.of(
        "D1", "Norte",
        "D2", "Centro",
        "D3", "Sur"
    );

    /* Índice del contenedor objetivo actual por dron */
    private final Map<String, Integer> targetIdx = new ConcurrentHashMap<>();

    @PostConstruct
    void init() {
        DRONE_ZONE.keySet().forEach(id -> targetIdx.put(id, 0));
    }

    @Transactional(readOnly = true)
    public List<Drone> getAll() { return repo.findAll(); }

    @Transactional(readOnly = true)
    public Optional<Drone> getById(String id) { return repo.findById(id); }

    @Transactional
    public Drone updatePosition(String id, double lat, double lng, double angle, int battery) {
        Drone d = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Drone not found: " + id));
        d.setLat(lat); d.setLng(lng);
        d.setAngle(angle); d.setBattery(battery);
        return repo.save(d);
    }

    /**
     * Avanza cada dron hacia el contenedor objetivo de su zona.
     * Cuando llega (~280 m), pasa al siguiente contenedor (cycling).
     * Prioriza contenedores ALTO/DESBORDADO; si no hay, patrulla todos.
     */
    @Transactional
    public void simulateStep() {
        repo.findAll().forEach(drone -> {
            String zone = DRONE_ZONE.getOrDefault(drone.getId(), "Centro");

            List<Container> targets = getPriorityTargets(zone);
            if (targets.isEmpty()) {
                bounceFallback(drone);
                return;
            }

            int    idx    = targetIdx.getOrDefault(drone.getId(), 0) % targets.size();
            Container tgt = targets.get(idx);

            double dLat = tgt.getLat() - drone.getLat();
            double dLng = tgt.getLng() - drone.getLng();
            double dist = Math.sqrt(dLat * dLat + dLng * dLng);

            /* Si llegó al objetivo, avanzar al siguiente */
            if (dist < ARRIVE_THRESH) {
                targetIdx.put(drone.getId(), (idx + 1) % targets.size());
            }

            /* Mover hacia el objetivo a velocidad constante */
            double newLat, newLng;
            if (dist < 1e-9) {
                newLat = drone.getLat();
                newLng = drone.getLng();
            } else {
                newLat = drone.getLat() + (dLat / dist) * PATROL_SPEED;
                newLng = drone.getLng() + (dLng / dist) * PATROL_SPEED;
            }

            newLat = Math.max(MIN_LAT, Math.min(MAX_LAT, newLat));
            newLng = Math.max(MIN_LNG, Math.min(MAX_LNG, newLng));

            drone.setLat(newLat);
            drone.setLng(newLng);
            drone.setAngle(Math.toDegrees(Math.atan2(dLng, dLat)));
            repo.save(drone);
        });
    }

    /** Retorna contenedores ALTO/DESBORDADO de la zona; si no hay, devuelve todos los de la zona. */
    private List<Container> getPriorityTargets(String zone) {
        List<Container> critical = new ArrayList<>();
        critical.addAll(containerRepo.findByZoneAndStatus(zone, "ALTO"));
        critical.addAll(containerRepo.findByZoneAndStatus(zone, "DESBORDADO"));
        if (!critical.isEmpty()) return critical;
        return containerRepo.findByZone(zone);
    }

    /** Rebote aleatorio como fallback si no hay contenedores en la zona. */
    private void bounceFallback(Drone drone) {
        double[] v = new double[]{0.00015, 0.00012};
        double   lat = drone.getLat() + v[0];
        double   lng = drone.getLng() + v[1];
        if (lat < MIN_LAT || lat > MAX_LAT) { v[0] = -v[0]; lat = drone.getLat() + v[0]; }
        if (lng < MIN_LNG || lng > MAX_LNG) { v[1] = -v[1]; lng = drone.getLng() + v[1]; }
        drone.setLat(lat); drone.setLng(lng);
        drone.setAngle(Math.toDegrees(Math.atan2(v[1], v[0])));
        repo.save(drone);
    }
}
