// Cliente REST hacia el backend Spring Boot — con timeout de 3 s y manejo de errores

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const get = (path) =>
  fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(3000) })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

const put = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

const post = (path) =>
  fetch(`${BASE}${path}`, { method: 'POST', signal: AbortSignal.timeout(3000) })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

/* ── Contenedores ─────────────────────────────────────────────────────── */
export const getContainers = (zone, status) => {
  const p = new URLSearchParams();
  if (zone)   p.set('zone', zone);
  if (status) p.set('status', status);
  const q = p.toString();
  return get(`/api/containers${q ? `?${q}` : ''}`);
};

export const getContainer  = (id)       => get(`/api/containers/${id}`);
export const updateContainer = (id, body) => put(`/api/containers/${id}`, body);

/* ── Drones ───────────────────────────────────────────────────────────── */
export const getDrones = () => get('/api/drones');
export const getDrone  = (id) => get(`/api/drones/${id}`);

/* ── Alertas ──────────────────────────────────────────────────────────── */
export const getAlerts           = (limit = 20)  => get(`/api/alerts?limit=${limit}`);
export const getAlertsByContainer = (id)          => get(`/api/alerts/container/${id}`);

/* ── Rutas ────────────────────────────────────────────────────────────── */
export const getRoute          = (truckId) => get(`/api/routes/${truckId}`);
export const recalculateRoute  = (truckId) => post(`/api/routes/${truckId}/recalculate`);
