package com.dronewaste.scheduler;

import com.dronewaste.model.Container;
import com.dronewaste.model.Drone;
import com.dronewaste.service.AlertService;
import com.dronewaste.service.ContainerService;
import com.dronewaste.service.DroneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simula llenado gradual de contenedores con fillRate individual y staggering
 * para que no alcancen DESBORDADO todos al mismo tiempo.
 * Detecta escaneos por proximidad de dron y gestiona la recolección automática.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SimulatorScheduler {

    private final ContainerService containerService;
    private final DroneService     droneService;
    private final AlertService     alertService;

    private final Random random = new Random();

    /**
     * Multiplicador global de velocidad de llenado.
     * 0.22 → tarda ~5 min en llenar un contenedor comercial desde vacío.
     * Sube a 1.0 solo en FORZAR CRISIS (botón del front) que inyecta directamente.
     */
    private static final double FILL_MULTIPLIER = 0.22;

    /* Warmup: cada contenedor tiene un retardo aleatorio (0-40 ticks = 0-80 s)
       antes de empezar a llenarse. Se inicializa en el primer tick. */
    private volatile boolean warmupReady = false;
    private final Map<String, Integer> warmup      = new ConcurrentHashMap<>();
    private final Set<String>          overflowed  = ConcurrentHashMap.newKeySet();
    private final Map<String, Integer> overflowTicks = new ConcurrentHashMap<>();

    @Scheduled(fixedDelay = 2000)
    public void tick() {
        List<Container> containers = containerService.findAll(null, null);
        List<Drone>     drones     = droneService.getAll();

        if (!warmupReady) initWarmup(containers);

        tickContainers(containers);
        detectScans(containers, drones);
        droneService.simulateStep();
    }

    /* ── Inicializa retardos y niveles aleatorios para que cada arranque
          genere rutas distintas. Retardo: 0-45 ticks. Nivel inicial: 5-75 %. */
    private void initWarmup(List<Container> containers) {
        containers.forEach(c -> {
            warmup.put(c.getId(), random.nextInt(45));
            double randomLevel = 0.05 + random.nextDouble() * 0.70;
            containerService.updateLevel(c.getId(), randomLevel);
        });
        warmupReady = true;
        log.info("Warmup inicializado: {} contenedores con niveles aleatorios", containers.size());
    }

    /* ── Llenado con fillRate individual × FILL_MULTIPLIER ───────────── */
    private void tickContainers(List<Container> containers) {
        containers.forEach(c -> {
            /* Fase de warmup: este contenedor aún no empieza a llenarse */
            int wt = warmup.getOrDefault(c.getId(), 0);
            if (wt > 0) { warmup.put(c.getId(), wt - 1); return; }

            double newLevel;

            if (overflowed.contains(c.getId())) {
                int ticks = overflowTicks.merge(c.getId(), 1, Integer::sum);
                if (ticks >= 5) {
                    /* Recolección automática tras 5 ticks (~10 s) en DESBORDADO */
                    newLevel = 0.03 + random.nextDouble() * 0.07;
                    overflowed.remove(c.getId());
                    overflowTicks.remove(c.getId());
                    log.info("RECOLECTADO → {}", c.getId());
                } else {
                    return; // espera hasta ser recolectado
                }
            } else {
                /* fillRate × multiplicador × factor aleatorio por tick (0.4x–1.6x)
                   → cada contenedor llena a distinta velocidad en cada tick
                   → las rutas nunca son exactamente iguales entre reinicios */
                double tickFactor = 0.4 + random.nextDouble() * 1.2;
                double noise      = random.nextGaussian() * 0.002;
                newLevel = c.getLevel() + (c.getFillRate() * FILL_MULTIPLIER * tickFactor) + noise;
                newLevel = Math.max(0.01, Math.min(1.0, newLevel));
            }

            String newStatus = containerService.resolveStatus(newLevel);

            if ("DESBORDADO".equals(newStatus) && overflowed.add(c.getId())) {
                log.info("OVERFLOW → {} (fillRate={})", c.getId(), String.format("%.3f", c.getFillRate()));
                alertService.createOverflowAlert(c.getId());
                overflowTicks.put(c.getId(), 0);
            }

            containerService.updateLevel(c.getId(), newLevel);
        });
    }

    /* ── Escaneo por proximidad de dron ──────────────────────────────── */
    private void detectScans(List<Container> containers, List<Drone> drones) {
        for (Drone drone : drones) {
            for (Container container : containers) {
                double dLat = Math.abs(drone.getLat() - container.getLat());
                double dLng = Math.abs(drone.getLng() - container.getLng());
                if (Math.sqrt(dLat * dLat + dLng * dLng) < 0.003) {
                    containerService.registerScan(container.getId(), drone.getId());
                }
            }
        }
    }
}
