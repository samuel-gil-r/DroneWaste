package com.dronewaste;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Punto de entrada de la aplicación DroneWaste — habilita scheduling para la simulación. */
@SpringBootApplication
@EnableScheduling
public class DroneWasteApplication {

    public static void main(String[] args) {
        SpringApplication.run(DroneWasteApplication.class, args);
    }
}
