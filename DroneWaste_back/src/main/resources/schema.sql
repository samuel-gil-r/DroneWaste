-- Tablas DroneWaste — H2 in-memory

DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS drones;
DROP TABLE IF EXISTS containers;

CREATE TABLE containers (
    id           VARCHAR(10)  PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    lat          DOUBLE       NOT NULL,
    lng          DOUBLE       NOT NULL,
    level        DOUBLE       NOT NULL DEFAULT 0.0,
    status       VARCHAR(20)  NOT NULL DEFAULT 'VACIO',
    zone         VARCHAR(20)  NOT NULL,
    fill_rate    DOUBLE       NOT NULL DEFAULT 0.015, -- incremento/tick: comercial > residencial
    last_scanned TIMESTAMP    NULL,                   -- último escaneo por dron
    scanned_by   VARCHAR(10)  NULL                    -- D1|D2|D3
);

CREATE TABLE drones (
    id      VARCHAR(10)  PRIMARY KEY,
    lat     DOUBLE       NOT NULL,
    lng     DOUBLE       NOT NULL,
    angle   DOUBLE       NOT NULL DEFAULT 0.0,
    status  VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    battery INTEGER      NOT NULL DEFAULT 100
);

CREATE TABLE alerts (
    id           BIGINT       AUTO_INCREMENT PRIMARY KEY,
    container_id VARCHAR(10)  NOT NULL,
    type         VARCHAR(50)  NOT NULL,
    message      VARCHAR(255) NOT NULL,
    timestamp    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
