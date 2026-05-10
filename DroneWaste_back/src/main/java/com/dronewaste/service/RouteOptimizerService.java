package com.dronewaste.service;

import com.dronewaste.model.Container;
import com.dronewaste.repository.ContainerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

/** Implementa el algoritmo D-VRP con nearest-neighbor + 2-opt para optimizar rutas de camiones. */
@Service
@RequiredArgsConstructor
public class RouteOptimizerService {

    private final ContainerRepository containerRepo;

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

    /** Retorna la ruta optimizada (nearest-neighbor + 2-opt) para contenedores ALTO y DESBORDADO del camión. */
    public List<Container> getOptimizedRoute(String truckId) {
        String[] zones = TRUCK_ZONES.getOrDefault(truckId, new String[]{"Centro"});
        double[] depot = TRUCK_DEPOTS.getOrDefault(truckId, new double[]{4.642, -74.066});

        List<Container> critical = new ArrayList<>();
        for (String zone : zones) {
            containerRepo.findByZone(zone).stream()
                .filter(c -> "ALTO".equals(c.getStatus()) || "DESBORDADO".equals(c.getStatus()))
                .forEach(critical::add);
        }

        if (critical.isEmpty()) return Collections.emptyList();

        List<Container> route = nearestNeighbor(depot[0], depot[1], critical);
        return twoOpt(route, depot[0], depot[1]);
    }

    /** Nearest-neighbor greedy: en cada paso elige el contenedor no visitado más cercano. */
    public List<Container> nearestNeighbor(double originLat, double originLng, List<Container> targets) {
        List<Container> remaining = new ArrayList<>(targets);
        List<Container> route    = new ArrayList<>();
        double curLat = originLat, curLng = originLng;

        while (!remaining.isEmpty()) {
            Container nearest = null;
            double    minDist = Double.MAX_VALUE;
            for (Container c : remaining) {
                double d = haversine(curLat, curLng, c.getLat(), c.getLng());
                if (d < minDist) { minDist = d; nearest = c; }
            }
            route.add(nearest);
            remaining.remove(nearest);
            curLat = nearest.getLat();
            curLng = nearest.getLng();
        }
        return route;
    }

    /** 2-opt: intercambia segmentos de la ruta mientras reduzca la distancia total. */
    List<Container> twoOpt(List<Container> route, double depotLat, double depotLng) {
        if (route.size() <= 2) return route;
        List<Container> best     = new ArrayList<>(route);
        boolean         improved = true;

        while (improved) {
            improved = false;
            for (int i = 0; i < best.size() - 1; i++) {
                for (int j = i + 2; j <= best.size(); j++) {
                    double aLat = (i == 0) ? depotLat : best.get(i - 1).getLat();
                    double aLng = (i == 0) ? depotLng : best.get(i - 1).getLng();
                    double bLat = best.get(i).getLat(),     bLng = best.get(i).getLng();
                    double cLat = best.get(j - 1).getLat(), cLng = best.get(j - 1).getLng();
                    double dLat = (j == best.size()) ? depotLat : best.get(j).getLat();
                    double dLng = (j == best.size()) ? depotLng : best.get(j).getLng();

                    double curr = haversine(aLat, aLng, bLat, bLng) + haversine(cLat, cLng, dLat, dLng);
                    double swap = haversine(aLat, aLng, cLat, cLng) + haversine(bLat, bLng, dLat, dLng);

                    if (swap < curr - 0.001) {
                        List<Container> seg = new ArrayList<>(best.subList(i, j));
                        Collections.reverse(seg);
                        for (int k = i; k < j; k++) best.set(k, seg.get(k - i));
                        improved = true;
                    }
                }
            }
        }
        return best;
    }

    /** Distancia Haversine en km entre dos puntos GPS. */
    public double haversine(double lat1, double lng1, double lat2, double lng2) {
        final double R    = 6371.0;
        double       dLat = Math.toRadians(lat2 - lat1);
        double       dLng = Math.toRadians(lng2 - lng1);
        double       a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                          + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                          * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
