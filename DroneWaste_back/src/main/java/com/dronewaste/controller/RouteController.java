package com.dronewaste.controller;

import com.dronewaste.model.Container;
import com.dronewaste.repository.ContainerRepository;
import com.dronewaste.service.RouteOptimizerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/** Controlador REST que expone la ruta D-VRP optimizada para cada camión recolector.
 *  Llama al microservicio Python (OR-Tools) y cae al solver Java si no responde. */
@Slf4j
@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {

    private final RouteOptimizerService routeOptimizer;
    private final ContainerRepository  containerRepo;
    private final RestTemplate         restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    private static final Map<String, String[]> TRUCK_ZONES = Map.of(
        "R1", new String[]{"Norte"},
        "R2", new String[]{"Centro"},
        "R3", new String[]{"Sur"}
    );

    private static final Map<String, double[]> TRUCK_DEPOTS = Map.of(
        "R1", new double[]{4.6568, -74.0635},
        "R2", new double[]{4.6404, -74.0663},
        "R3", new double[]{4.6296, -74.0680}
    );

    @GetMapping("/{truckId}")
    public ResponseEntity<List<Container>> getRoute(@PathVariable String truckId) {
        return ResponseEntity.ok(optimizeRoute(truckId));
    }

    @PostMapping("/{truckId}/recalculate")
    public ResponseEntity<List<Container>> recalculate(@PathVariable String truckId) {
        return ResponseEntity.ok(optimizeRoute(truckId));
    }

    private List<Container> optimizeRoute(String truckId) {
        String[] zones = TRUCK_ZONES.getOrDefault(truckId, new String[]{"Centro"});
        double[] depot = TRUCK_DEPOTS.getOrDefault(truckId, new double[]{4.642, -74.066});

        // Filtrar contenedores críticos de la zona
        List<Container> critical = new ArrayList<>();
        for (String zone : zones) {
            containerRepo.findByZone(zone).stream()
                .filter(c -> "ALTO".equals(c.getStatus()) || "DESBORDADO".equals(c.getStatus()))
                .forEach(critical::add);
        }

        if (critical.isEmpty()) return Collections.emptyList();

        // Intentar solver Python OR-Tools
        try {
            List<Container> pyRoute = callPythonSolver(critical, depot);
            if (pyRoute != null && !pyRoute.isEmpty()) {
                log.info("[RouteController] OR-Tools resolvió {} paradas para {}", pyRoute.size(), truckId);
                return pyRoute;
            }
        } catch (Exception e) {
            log.warn("[RouteController] Python solver no disponible ({}), usando fallback Java", e.getMessage());
        }

        // Fallback: nearest-neighbor + 2-opt Java
        return routeOptimizer.getOptimizedRoute(truckId);
    }

    @SuppressWarnings("unchecked")
    private List<Container> callPythonSolver(List<Container> containers, double[] depot) {
        // Construir payload
        Map<String, Object> depotMap = Map.of("lat", depot[0], "lng", depot[1]);
        List<Map<String, Object>> containerList = containers.stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id",     c.getId());
            m.put("lat",    c.getLat());
            m.put("lng",    c.getLng());
            m.put("status", c.getStatus());
            m.put("zone",   c.getZone());
            m.put("name",   c.getName());
            m.put("level",  c.getLevel());
            return m;
        }).toList();

        Map<String, Object> body = new HashMap<>();
        body.put("containers",   containerList);
        body.put("depot",        depotMap);
        body.put("num_vehicles", 1);
        body.put("capacity_l",   12000);
        body.put("time_limit_s", 3);

        Map<String, Object> response = restTemplate.postForObject(
            aiServiceUrl + "/routes/solve", body, Map.class
        );

        if (response == null) return null;

        List<Map<String, Object>> routes = (List<Map<String, Object>>) response.get("routes");
        if (routes == null || routes.isEmpty()) return null;

        // Tomar la primera ruta y mapear los stops a Container
        List<Map<String, Object>> stops = (List<Map<String, Object>>) routes.get(0).get("stops");
        if (stops == null) return null;

        // Reconstruir objetos Container desde los stops (ya tienen todos los campos)
        return stops.stream().map(s -> {
            String id = (String) s.get("id");
            return containers.stream()
                .filter(c -> c.getId().equals(id))
                .findFirst()
                .orElse(null);
        }).filter(Objects::nonNull).toList();
    }
}
