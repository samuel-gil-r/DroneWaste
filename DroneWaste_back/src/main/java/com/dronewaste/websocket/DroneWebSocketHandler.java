package com.dronewaste.websocket;

import org.springframework.stereotype.Component;

/** Componente que pusha el snapshot de drones y alertas al topic /topic/drones cada 2 segundos vía STOMP. */
@Component
public class DroneWebSocketHandler {

    /**
     * Invocado por SimulatorScheduler cada 2s: serializa el estado de los drones a JSON
     * y lo envía a /topic/drones mediante SimpMessagingTemplate.
     */
    public void broadcastDroneState() {
        // TODO: messagingTemplate.convertAndSend("/topic/drones", droneService.getAll())
    }
}
