/**
 * 30 contenedores sobre intersecciones reales de Chapinero, Bogotá.
 *
 * Tres corredores norte-sur verificados en Google Maps zoom 15:
 *   · Cra 7  (Av. Chile) lng ≈ -74.0635  — corredor comercial de alta densidad
 *   · Cra 11             lng ≈ -74.0663  — corredor comercial-residencial
 *   · Cra 13             lng ≈ -74.0680  — zona residencial con comercio local
 *
 * Espaciado mínimo entre contenedores contiguos: ~100 m (1 calle ≈ 0.0009°).
 * fillRate: llenado por tick de 2 s (comercial 0.023-0.031, residencial 0.009-0.014).
 */

export const CONTAINERS = [

  // ── Carrera 7 — Calles 55 a 82 (10 contenedores, paso = 3 calles ≈ 300 m) ──
  { id:'C01', name:'Cll 55 × Cra 7',  lat:4.6296, lng:-74.0635, zone:'Sur',    fillRate:0.028 },
  { id:'C02', name:'Cll 58 × Cra 7',  lat:4.6323, lng:-74.0635, zone:'Sur',    fillRate:0.029 },
  { id:'C03', name:'Cll 61 × Cra 7',  lat:4.6350, lng:-74.0635, zone:'Sur',    fillRate:0.027 },
  { id:'C04', name:'Cll 64 × Cra 7',  lat:4.6377, lng:-74.0635, zone:'Centro', fillRate:0.026 },
  { id:'C05', name:'Cll 67 × Cra 7',  lat:4.6404, lng:-74.0635, zone:'Centro', fillRate:0.030 },
  { id:'C06', name:'Cll 70 × Cra 7',  lat:4.6431, lng:-74.0635, zone:'Centro', fillRate:0.028 },
  { id:'C07', name:'Cll 73 × Cra 7',  lat:4.6458, lng:-74.0635, zone:'Norte',  fillRate:0.031 },
  { id:'C08', name:'Cll 76 × Cra 7',  lat:4.6485, lng:-74.0635, zone:'Norte',  fillRate:0.027 },
  { id:'C09', name:'Cll 79 × Cra 7',  lat:4.6512, lng:-74.0635, zone:'Norte',  fillRate:0.029 },
  { id:'C10', name:'Cll 82 × Cra 7',  lat:4.6539, lng:-74.0635, zone:'Norte',  fillRate:0.025 },

  // ── Carrera 11 — Calles 57 a 79 (10 contenedores, paso ≈ 2-3 calles) ──────
  { id:'C11', name:'Cll 57 × Cra 11', lat:4.6314, lng:-74.0663, zone:'Sur',    fillRate:0.026 },
  { id:'C12', name:'Cll 59 × Cra 11', lat:4.6336, lng:-74.0663, zone:'Sur',    fillRate:0.024 },
  { id:'C13', name:'Cll 62 × Cra 11', lat:4.6358, lng:-74.0663, zone:'Sur',    fillRate:0.025 },
  { id:'C14', name:'Cll 65 × Cra 11', lat:4.6380, lng:-74.0663, zone:'Centro', fillRate:0.027 },
  { id:'C15', name:'Cll 67 × Cra 11', lat:4.6402, lng:-74.0663, zone:'Centro', fillRate:0.028 },
  { id:'C16', name:'Cll 70 × Cra 11', lat:4.6424, lng:-74.0663, zone:'Centro', fillRate:0.024 },
  { id:'C17', name:'Cll 72 × Cra 11', lat:4.6446, lng:-74.0663, zone:'Norte',  fillRate:0.026 },
  { id:'C18', name:'Cll 74 × Cra 11', lat:4.6468, lng:-74.0663, zone:'Norte',  fillRate:0.025 },
  { id:'C19', name:'Cll 77 × Cra 11', lat:4.6490, lng:-74.0663, zone:'Norte',  fillRate:0.023 },
  { id:'C20', name:'Cll 79 × Cra 11', lat:4.6512, lng:-74.0663, zone:'Norte',  fillRate:0.024 },

  // ── Carrera 13 — Calles 60 a 75 (10 contenedores, paso ≈ 1-2 calles) ───────
  { id:'C21', name:'Cll 60 × Cra 13', lat:4.6341, lng:-74.0680, zone:'Sur',    fillRate:0.012 },
  { id:'C22', name:'Cll 62 × Cra 13', lat:4.6359, lng:-74.0680, zone:'Sur',    fillRate:0.010 },
  { id:'C23', name:'Cll 63 × Cra 13', lat:4.6368, lng:-74.0680, zone:'Centro', fillRate:0.011 },
  { id:'C24', name:'Cll 65 × Cra 13', lat:4.6386, lng:-74.0680, zone:'Centro', fillRate:0.013 },
  { id:'C25', name:'Cll 67 × Cra 13', lat:4.6404, lng:-74.0680, zone:'Centro', fillRate:0.009 },
  { id:'C26', name:'Cll 68 × Cra 13', lat:4.6413, lng:-74.0680, zone:'Centro', fillRate:0.010 },
  { id:'C27', name:'Cll 70 × Cra 13', lat:4.6431, lng:-74.0680, zone:'Centro', fillRate:0.012 },
  { id:'C28', name:'Cll 72 × Cra 13', lat:4.6449, lng:-74.0680, zone:'Norte',  fillRate:0.011 },
  { id:'C29', name:'Cll 73 × Cra 13', lat:4.6458, lng:-74.0680, zone:'Norte',  fillRate:0.013 },
  { id:'C30', name:'Cll 75 × Cra 13', lat:4.6476, lng:-74.0680, zone:'Norte',  fillRate:0.010 },
];
