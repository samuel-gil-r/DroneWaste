-- Seed: 30 contenedores sobre calles reales de Chapinero + 3 drones
-- Coordenadas verificadas: Cra 7 (-74.0635), Cra 11 (-74.0663), Cra 13 (-74.0680)
-- fillRate: comercial (Cra 7/11) 0.023-0.031 | residencial (Cra 13) 0.009-0.014

INSERT INTO containers (id, name, lat, lng, level, status, zone, fill_rate) VALUES
-- Carrera 7 (corredor comercial principal)
('C01','Cll 55 × Cra 7',  4.6296,-74.0635, 0.15,'BAJO',       'Sur',   0.028),
('C02','Cll 58 × Cra 7',  4.6323,-74.0635, 0.45,'MEDIO',      'Sur',   0.029),
('C03','Cll 61 × Cra 7',  4.6350,-74.0635, 0.80,'ALTO',       'Sur',   0.027),
('C04','Cll 64 × Cra 7',  4.6377,-74.0635, 0.05,'VACIO',      'Centro',0.026),
('C05','Cll 67 × Cra 7',  4.6404,-74.0635, 0.65,'MEDIO',      'Centro',0.030),
('C06','Cll 70 × Cra 7',  4.6431,-74.0635, 0.35,'MEDIO',      'Centro',0.028),
('C07','Cll 73 × Cra 7',  4.6458,-74.0635, 0.92,'DESBORDADO', 'Norte', 0.031),
('C08','Cll 76 × Cra 7',  4.6485,-74.0635, 0.25,'BAJO',       'Norte', 0.027),
('C09','Cll 79 × Cra 7',  4.6512,-74.0635, 0.70,'ALTO',       'Norte', 0.029),
('C10','Cll 82 × Cra 7',  4.6539,-74.0635, 0.10,'BAJO',       'Norte', 0.025),
-- Carrera 11 (corredor comercial-residencial)
('C11','Cll 57 × Cra 11', 4.6314,-74.0663, 0.55,'MEDIO',      'Sur',   0.026),
('C12','Cll 59 × Cra 11', 4.6336,-74.0663, 0.08,'VACIO',      'Sur',   0.024),
('C13','Cll 62 × Cra 11', 4.6358,-74.0663, 0.88,'ALTO',       'Sur',   0.025),
('C14','Cll 65 × Cra 11', 4.6380,-74.0663, 0.40,'MEDIO',      'Centro',0.027),
('C15','Cll 67 × Cra 11', 4.6402,-74.0663, 0.93,'DESBORDADO', 'Centro',0.028),
('C16','Cll 70 × Cra 11', 4.6424,-74.0663, 0.18,'BAJO',       'Centro',0.024),
('C17','Cll 72 × Cra 11', 4.6446,-74.0663, 0.62,'MEDIO',      'Norte', 0.026),
('C18','Cll 74 × Cra 11', 4.6468,-74.0663, 0.75,'ALTO',       'Norte', 0.025),
('C19','Cll 77 × Cra 11', 4.6490,-74.0663, 0.03,'VACIO',      'Norte', 0.023),
('C20','Cll 79 × Cra 11', 4.6512,-74.0663, 0.50,'MEDIO',      'Norte', 0.024),
-- Carrera 13 (zona residencial con comercio local)
('C21','Cll 60 × Cra 13', 4.6341,-74.0680, 0.30,'BAJO',       'Sur',   0.012),
('C22','Cll 62 × Cra 13', 4.6359,-74.0680, 0.85,'ALTO',       'Sur',   0.010),
('C23','Cll 63 × Cra 13', 4.6368,-74.0680, 0.12,'BAJO',       'Centro',0.011),
('C24','Cll 65 × Cra 13', 4.6386,-74.0680, 0.67,'ALTO',       'Centro',0.013),
('C25','Cll 67 × Cra 13', 4.6404,-74.0680, 0.44,'MEDIO',      'Centro',0.009),
('C26','Cll 68 × Cra 13', 4.6413,-74.0680, 0.91,'DESBORDADO', 'Centro',0.010),
('C27','Cll 70 × Cra 13', 4.6431,-74.0680, 0.22,'BAJO',       'Centro',0.012),
('C28','Cll 72 × Cra 13', 4.6449,-74.0680, 0.58,'MEDIO',      'Norte', 0.011),
('C29','Cll 73 × Cra 13', 4.6458,-74.0680, 0.78,'ALTO',       'Norte', 0.013),
('C30','Cll 75 × Cra 13', 4.6476,-74.0680, 0.38,'MEDIO',      'Norte', 0.010);

INSERT INTO drones (id, lat, lng, angle, status, battery) VALUES
('D1', 4.6404,-74.0635,   0.0,'ACTIVE',100),
('D2', 4.6402,-74.0663,  45.0,'ACTIVE', 87),
('D3', 4.6404,-74.0680, 120.0,'ACTIVE', 94);
