package com.dronewaste.service;

import com.dronewaste.model.Drone;
import com.dronewaste.repository.DroneRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Servicio que gestiona la telemetría de los drones y simula su desplazamiento sobre Chapinero. */
@Service
@RequiredArgsConstructor
public class DroneService {

    private final DroneRepository repo;

    private static final double MIN_LAT =  4.626, MAX_LAT =  4.677;
    private static final double MIN_LNG = -74.078, MAX_LNG = -74.045;

    /* Velocidad de simulación en grados por tick (2 s). ~0.00015° lat ≈ 16 m. */
    private final Map<String, double[]> vel = new ConcurrentHashMap<>();

    @PostConstruct
    void initVelocities() {
        vel.put("D1", new double[]{ 0.00015,  0.00018 });
        vel.put("D2", new double[]{-0.00014,  0.00012 });
        vel.put("D3", new double[]{ 0.00011, -0.00016 });
    }

    @Transactional(readOnly = true)
    public List<Drone> getAll() {
        return repo.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Drone> getById(String id) {
        return repo.findById(id);
    }

    @Transactional
    public Drone updatePosition(String id, double lat, double lng, double angle, int battery) {
        Drone d = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Drone not found: " + id));
        d.setLat(lat); d.setLng(lng);
        d.setAngle(angle); d.setBattery(battery);
        return repo.save(d);
    }

    /** Avanza cada dron un paso de simulación, rebotando en los límites de Chapinero. */
    @Transactional
    public void simulateStep() {
        repo.findAll().forEach(drone -> {
            double[] v   = vel.computeIfAbsent(drone.getId(), k -> new double[]{0.0001, 0.0001});
            double   lat = drone.getLat() + v[0];
            double   lng = drone.getLng() + v[1];

            if (lat < MIN_LAT || lat > MAX_LAT) { v[0] = -v[0]; lat = drone.getLat() + v[0]; }
            if (lng < MIN_LNG || lng > MAX_LNG) { v[1] = -v[1]; lng = drone.getLng() + v[1]; }

            drone.setLat(lat);
            drone.setLng(lng);
            drone.setAngle(Math.toDegrees(Math.atan2(v[1], v[0])));
            repo.save(drone);
        });
    }
}
