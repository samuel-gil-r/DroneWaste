import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, OverlayView, Polyline } from '@react-google-maps/api';
import { useMapsLoaded } from '../Map/MapWrapper';
import { recalculateRoute } from '../../services/api';

/* ── CSS ─────────────────────────────────────────────────────────────────── */
const ROUTE_CSS = `
  @keyframes routeSpin    { to { transform: rotate(360deg); } }
  @keyframes collectCloud {
    0%   { transform: translateY(0)    scale(1);   opacity: 1; }
    60%  { transform: translateY(-22px) scale(1.1); opacity: 0.9; }
    100% { transform: translateY(-48px) scale(0.5); opacity: 0; }
  }
  @keyframes stopFlash {
    0%,100% { box-shadow: 0 0 10px #00ff88aa; background: #00ff88; }
    50%     { box-shadow: 0 0 28px #fff;      background: #ffffff; }
  }
  @keyframes kpiPop {
    0%   { transform: scale(1.5); }
    100% { transform: scale(1);   }
  }
  @keyframes summaryIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/* ── Constantes ─────────────────────────────────────────────────────────── */
const CENTER = { lat: 4.642, lng: -74.066 };
const BOUNDS = { south: 4.625, west: -74.080, north: 4.678, east: -74.044 };
const MAP_OPTS = {
  minZoom: 13, maxZoom: 16,
  disableDefaultUI: true, zoomControl: true,
  restriction: { latLngBounds: BOUNDS, strictBounds: true },
  styles: [
    { elementType: 'geometry',               stylers: [{ color: '#0a1628' }] },
    { elementType: 'labels.text.fill',       stylers: [{ color: '#4a7a96' }] },
    { elementType: 'labels.text.stroke',     stylers: [{ color: '#040e17' }] },
    { featureType: 'road', elementType: 'geometry',          stylers: [{ color: '#0d2a3f' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1a3f5c' }] },
    { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#0e3a5c' }] },
    { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#040e17' }] },
    { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    {
      featureType: 'administrative.neighborhood',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#00d4ff' }, { visibility: 'on' }],
    },
  ],
};

const TRUCKS = [
  { id: 'R1', name: 'R1 Norte',  color: '#00d4ff', zones: ['Norte'],  depot: { lat: 4.6568, lng: -74.0635 } },
  { id: 'R2', name: 'R2 Centro', color: '#00ff88', zones: ['Centro'], depot: { lat: 4.6404, lng: -74.0663 } },
  { id: 'R3', name: 'R3 Sur',    color: '#ffd600', zones: ['Sur'],    depot: { lat: 4.6296, lng: -74.0680 } },
];

const STATUS_COLOR = {
  VACIO: '#00ff88', BAJO: '#66ffbb', MEDIO: '#ffd600', ALTO: '#ff8c00', DESBORDADO: '#ff2d55',
};
const getColor  = s => STATUS_COLOR[s] || STATUS_COLOR.MEDIO;
const isCritical = s => s === 'ALTO' || s === 'DESBORDADO' || s === 3 || s === 4;

const C = { panel: '#071520', border: '#0a2540', textDim: '#4a6a8a', text: '#c8d8e8', textMid: '#8aaac8' };

/* ── Haversine (km) ──────────────────────────────────────────────────────── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Nearest-neighbor ────────────────────────────────────────────────────── */
function nearestNeighbor(origin, points) {
  if (!points.length) return [];
  const visited = new Set();
  const route   = [];
  let cur = origin;
  while (visited.size < points.length) {
    let best = -1, bestD = Infinity;
    points.forEach((p, i) => {
      if (visited.has(i)) return;
      const d = haversine(cur.lat, cur.lng, p.lat, p.lng);
      if (d < bestD) { bestD = d; best = i; }
    });
    visited.add(best);
    route.push(points[best]);
    cur = points[best];
  }
  return route;
}

/* ── 2-opt: mejora la ruta reduciendo cruces ─────────────────────────────── */
function twoOpt(route, depot) {
  if (route.length <= 2) return route;
  let best = [...route];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j <= best.length; j++) {
        const A = i === 0 ? depot : best[i - 1];
        const B = best[i];
        const C = best[j - 1];
        const D = j === best.length ? depot : best[j];
        const curr = haversine(A.lat, A.lng, B.lat, B.lng) + haversine(C.lat, C.lng, D.lat, D.lng);
        const swap = haversine(A.lat, A.lng, C.lat, C.lng) + haversine(B.lat, B.lng, D.lat, D.lng);
        if (swap < curr - 0.001) {
          best = [...best.slice(0, i), ...best.slice(i, j).reverse(), ...best.slice(j)];
          improved = true;
        }
      }
    }
  }
  return best;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
function Spinner({ color, size = 14 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${color}33`, borderTop: `2px solid ${color}`,
      animation: 'routeSpin 0.7s linear infinite',
      display: 'inline-block', flexShrink: 0,
    }} />
  );
}

/* ── Marcador camión SVG ─────────────────────────────────────────────────── */
function TruckMarker({ color, label }) {
  return (
    <div style={{ transform: 'translate(-50%, -60%)', pointerEvents: 'none', position: 'relative' }}>
      <svg width="38" height="26" viewBox="0 0 38 26">
        {/* Caja */}
        <rect x="1" y="6" width="20" height="13" rx="2.5" fill={color} />
        {/* Cabina */}
        <path d="M20 8.5 L20 19 L36 19 L36 11.5 L29 6.5 L20 6.5 Z" fill={color} opacity="0.88" />
        {/* Ventana */}
        <path d="M22 9.5 L28.5 9.5 L33 12 L33 16 L22 16 Z" fill="#040e17" opacity="0.55" />
        {/* Ruedas */}
        <circle cx="8"  cy="22" r="3.5" fill="#040e17" stroke={color} strokeWidth="1.8" />
        <circle cx="27" cy="22" r="3.5" fill="#040e17" stroke={color} strokeWidth="1.8" />
        {/* Faro */}
        <circle cx="36" cy="15.5" r="1.8" fill="#ffd600" opacity="0.95" />
        {/* Matrícula */}
        <rect x="2" y="9" width="8" height="4" rx="1" fill="#040e17" opacity="0.3" />
      </svg>
      <div style={{
        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
        background: color, borderRadius: 4, padding: '1px 6px',
        fontSize: 7.5, fontFamily: 'monospace', fontWeight: 700, color: '#040e17',
        whiteSpace: 'nowrap', boxShadow: `0 0 8px ${color}88`,
      }}>
        {label}
      </div>
    </div>
  );
}

/* ── Nube de recolección ─────────────────────────────────────────────────── */
function CollectCloud({ color }) {
  return (
    <div style={{
      pointerEvents: 'none', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 2,
      animation: 'collectCloud 2.4s ease-out forwards',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#040e17',
        boxShadow: `0 0 18px ${color}`,
      }}>✓</div>
      <div style={{ fontSize: 7.5, fontFamily: 'monospace', color, letterSpacing: 0.5, textShadow: `0 0 6px ${color}` }}>
        VACIADO
      </div>
    </div>
  );
}

/* ── Panel de paradas ────────────────────────────────────────────────────── */
function StopsList({ stops, truck, depot, loading, collected, animLevels, collectingId }) {
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 24 }}>
      <Spinner color={truck.color} size={24} />
      <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>Calculando paradas…</span>
    </div>
  );

  if (stops.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 20 }}>
      <div style={{ fontSize: 28, opacity: 0.4 }}>✓</div>
      <span style={{ fontSize: 11, color: C.textDim, textAlign: 'center', lineHeight: 1.5 }}>
        No hay contenedores que<br />requieran recolección
      </span>
    </div>
  );

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
        Paradas ordenadas
      </div>
      {stops.map((s, i) => {
        const prev      = i === 0 ? depot : stops[i - 1];
        const segKm     = haversine(prev.lat, prev.lng, s.lat, s.lng).toFixed(2);
        const isCollected = !!collected[s.id];
        const isActive    = collectingId === s.id;
        const dispPct   = animLevels[s.id] ?? Math.round(s.pct ?? (s.level ?? 0) * 100);
        const color     = isCollected ? '#00ff88' : getColor(s.status);

        return (
          <div key={s.id} style={{
            padding: '9px 10px', marginBottom: 6, borderRadius: 7,
            background: isCollected ? '#00ff8810' : `${color}0e`,
            border: `1px solid ${isCollected ? '#00ff8840' : `${color}28`}`,
            transition: 'all 0.4s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                color: isCollected ? '#00ff88' : truck.color,
              }}>
                {isCollected ? '✓' : `#${i + 1}`} {s.id}
              </span>
              <span style={{ fontSize: 9, color, fontWeight: 700 }}>
                {isCollected ? 'VACIADO' : s.status}
              </span>
            </div>

            {/* Barra de nivel animada */}
            <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 4 }}>
              <div style={{
                height: '100%', width: `${dispPct}%`,
                background: isCollected ? '#00ff88' : color,
                borderRadius: 2, transition: 'width 0.1s linear',
              }} />
            </div>

            <div style={{ fontSize: 10, color: C.textMid }}>{s.name}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
              {s.zone} · {dispPct}% · +{segKm} km
              {isCollected && (
                <span style={{ color: '#00ff88', marginLeft: 6 }}>
                  ✓ {collected[s.id]}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* RoutesMap                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */
export default function RoutesMap({ containers = [], onContainerCollected }) {
  const mapsLoaded = useMapsLoaded();

  /* ── Ruta ───────────────────────────────────────────────────────────── */
  const [truckId,   setTruckId]   = useState('R1');
  const [stops,     setStops]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [mapReady,  setMapReady]  = useState(false);
  const [dirError,  setDirError]  = useState(false);
  const [fullPath,  setFullPath]  = useState([]);
  const [animPath,  setAnimPath]  = useState([]);

  /* ── Animación del camión ───────────────────────────────────────────── */
  const [truckPos,     setTruckPos]     = useState(null);
  const [tripInProg,   setTripInProg]   = useState(false);
  const [tripDone,     setTripDone]     = useState(false);
  const [nextStopNum,  setNextStopNum]  = useState(0);   // "parada X de N"
  const [collected,    setCollected]    = useState({});  // {id: timeStr}
  const [collectingId, setCollectingId] = useState(null);
  const [animLevels,   setAnimLevels]   = useState({});  // {id: pct 0-100}
  const [tripStats,    setTripStats]    = useState({ count: 0, km: 0, co2: 0 });

  /* ── Refs ───────────────────────────────────────────────────────────── */
  const dsRef           = useRef(null);
  const animRef         = useRef(null);
  const truckAnimRef    = useRef({ iv: null, pathIdx: 0, nextStopIdx: 0 });
  const stopsRef        = useRef([]);
  const animPathRef     = useRef([]);
  const collectedSetRef = useRef(new Set());
  const onPathDrawnRef       = useRef(null);
  const startTripRef         = useRef(null);
  const onContainerCollectedRef = useRef(onContainerCollected);
  useEffect(() => { onContainerCollectedRef.current = onContainerCollected; }, [onContainerCollected]);

  /* truck memoizado por truckId: referencia estable entre renders */
  const truck = useMemo(() => TRUCKS.find(t => t.id === truckId), [truckId]);

  /* Refs para acceso sin incluirlos en deps de callbacks */
  const truckRef      = useRef(truck);
  const containersRef = useRef(containers);
  useEffect(() => { truckRef.current = truck; }, [truck]);
  useEffect(() => { containersRef.current = containers; }, [containers]);

  /* ── Sync stopsRef ──────────────────────────────────────────────────── */
  useEffect(() => { stopsRef.current = stops; }, [stops]);

  /* ── Animación progresiva del trazo — sin limpiar el viejo ─────────── */
  useEffect(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
    if (!fullPath.length) { setAnimPath([]); return; }

    animPathRef.current = [];
    let i = 0;
    const STEP = Math.max(1, Math.floor(fullPath.length / 90));
    animRef.current = setInterval(() => {
      i += STEP;
      if (i >= fullPath.length) {
        setAnimPath(fullPath);
        animPathRef.current = fullPath;
        clearInterval(animRef.current);
        animRef.current = null;
        /* Notificar que el trazo está listo */
        if (onPathDrawnRef.current) { onPathDrawnRef.current(); onPathDrawnRef.current = null; }
      } else {
        const slice = fullPath.slice(0, i);
        setAnimPath(slice);
        animPathRef.current = slice;
      }
    }, 16);
    return () => { if (animRef.current) { clearInterval(animRef.current); animRef.current = null; } };
  }, [fullPath]);

  /* ── triggerCollection ──────────────────────────────────────────────── */
  const triggerCollection = useCallback((stop, idx) => {
    collectedSetRef.current.add(stop.id);
    const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    setCollected(prev => ({ ...prev, [stop.id]: timeStr }));
    setCollectingId(stop.id);
    setNextStopNum(idx + 1);
    setTripStats(prev => ({ count: prev.count + 1, km: prev.km + 2.5, co2: +(prev.co2 + 0.525).toFixed(2) }));

    /* Vaciar la barra de nivel en 2 s */
    const startPct = Math.round(stop.pct ?? (stop.level ?? 0) * 100);
    let cur = startPct;
    const step = Math.max(1, startPct / 20);
    const lv = setInterval(() => {
      cur = Math.max(0, cur - step);
      setAnimLevels(prev => ({ ...prev, [stop.id]: Math.round(cur) }));
      if (cur <= 0) clearInterval(lv);
    }, 100);

    setTimeout(() => setCollectingId(null), 2500);

    /* Propagar al mapa principal para que el contenedor se ponga verde */
    onContainerCollectedRef.current?.(stop.id);

    /* Notificar al backend */
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    fetch(`${base}/api/containers/${stop.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stop, level: 0.02, status: 'VACIO', pct: 2 }),
    }).catch(() => {});
  }, []);

  /* ── startTrip ──────────────────────────────────────────────────────── */
  const startTrip = useCallback(() => {
    const path = animPathRef.current;
    if (!path.length || !stopsRef.current.length) return;

    /* Detener viaje anterior */
    if (truckAnimRef.current.iv) { clearInterval(truckAnimRef.current.iv); truckAnimRef.current.iv = null; }

    collectedSetRef.current = new Set();
    setCollected({});
    setCollectingId(null);
    setAnimLevels({});
    setTripStats({ count: 0, km: 0, co2: 0 });
    setTripDone(false);
    setNextStopNum(0);
    setTruckPos(path[0]);
    setTripInProg(true);
    truckAnimRef.current = { iv: null, pathIdx: 0, nextStopIdx: 0 };

    truckAnimRef.current.iv = setInterval(() => {
      const { pathIdx, nextStopIdx } = truckAnimRef.current;
      const newIdx = Math.min(pathIdx + 1, path.length - 1);
      truckAnimRef.current.pathIdx = newIdx;
      setTruckPos(path[newIdx]);

      /* Proximidad al próximo contenedor (umbral 0.0005° ≈ 55 m) */
      const stops = stopsRef.current;
      if (nextStopIdx < stops.length) {
        const stop = stops[nextStopIdx];
        const dist = Math.hypot(path[newIdx].lat - stop.lat, path[newIdx].lng - stop.lng);
        if (dist < 0.0005 && !collectedSetRef.current.has(stop.id)) {
          triggerCollection(stop, nextStopIdx);
          truckAnimRef.current.nextStopIdx = nextStopIdx + 1;
        }
      }

      /* Fin de ruta */
      if (newIdx >= path.length - 1) {
        clearInterval(truckAnimRef.current.iv);
        truckAnimRef.current.iv = null;
        setTripInProg(false);
        setTripDone(true);
        setTruckPos(truckRef.current.depot); // ref — sin truck en deps
      }
    }, 80);
  }, [triggerCollection]); // ESTABLE: no depende de truck ni containers

  /* Mantiene startTripRef sincronizado sin que otros callbacks dependan de él */
  useEffect(() => { startTripRef.current = startTrip; }, [startTrip]);

  /* ── Fetch ruta ─────────────────────────────────────────────────────── */
  /* Usa refs: NO depende de containers ni de funciones que cambien cada 2 s */
  const computeLocal = useCallback(() => {
    const t        = truckRef.current;
    const critical = containersRef.current.filter(c => isCritical(c.status) && t.zones.includes(c.zone));
    const nn       = nearestNeighbor(t.depot, critical);
    return twoOpt(nn, t.depot); // mejora eliminando cruces
  }, []); // ESTABLE — accede por ref

  const fetchRoute = useCallback(async (force = false) => {
    /* Guard: si el camión está en movimiento y nadie lo forzó, no reiniciar */
    if (truckAnimRef.current.iv !== null && !force) return;

    /* Detener viaje en curso */
    if (truckAnimRef.current.iv) { clearInterval(truckAnimRef.current.iv); truckAnimRef.current.iv = null; }
    setTripInProg(false); setTripDone(false); setTruckPos(null);

    setLoading(true);
    setDirError(false);

    /* startTripRef siempre apunta a la versión actual sin crear nueva dep */
    onPathDrawnRef.current = () => startTripRef.current?.();

    const currentTruck = truckRef.current;

    let routeStops;
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const res  = await fetch(`${base}/api/routes/${currentTruck.id}`, { signal: AbortSignal.timeout(3000) });
      const data = res.ok ? await res.json() : null;
      routeStops = Array.isArray(data) && data.length > 0 ? data : computeLocal();
    } catch { routeStops = computeLocal(); }
    setStops(routeStops);

    if (!routeStops.length) { setLoading(false); return; }

    if (mapsLoaded && window.google?.maps) {
      if (!dsRef.current) dsRef.current = new window.google.maps.DirectionsService();
      const { depot } = currentTruck;
      const last      = routeStops[routeStops.length - 1];
      const waypoints = routeStops.slice(0, -1).map(s => ({
        location: new window.google.maps.LatLng(s.lat, s.lng), stopover: true,
      }));
      try {
        const result = await new Promise((res, rej) => {
          dsRef.current.route({
            origin: new window.google.maps.LatLng(depot.lat, depot.lng),
            destination: new window.google.maps.LatLng(last.lat, last.lng),
            waypoints, travelMode: window.google.maps.TravelMode.DRIVING, optimizeWaypoints: false,
          }, (r, status) => status === 'OK' ? res(r) : rej(new Error(status)));
        });
        const path = [];
        result.routes[0].legs.forEach(leg =>
          leg.steps.forEach(step => step.path.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }))));
        setFullPath(path);
      } catch {
        setDirError(true);
        setFullPath([depot, ...routeStops.map(s => ({ lat: s.lat, lng: s.lng })), depot]);
      }
    } else {
      setFullPath([currentTruck.depot, ...routeStops.map(s => ({ lat: s.lat, lng: s.lng })), currentTruck.depot]);
    }
    setLoading(false);
  /* Solo se recrea cuando cambia el camión o Maps se carga.
     containers NO está en deps — se accede por containersRef. */
  }, [truckId, mapsLoaded, computeLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecalculate = useCallback(async () => {
    setRecalcing(true);
    try { await recalculateRoute(truckId); } catch {}
    setRecalcing(false);
    await fetchRoute(true); // force=true → sí interrumpe el viaje actual
  }, [truckId, fetchRoute]);

  /* CRÍTICO: [truckId, mapsLoaded] — NO [fetchRoute].
     Si fuera [fetchRoute], containers (que cambia c/2s) causaría el reset. */
  useEffect(() => { fetchRoute(); }, [truckId, mapsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── KPIs de ruta base (sin contar la animación del viaje) ──────────── */
  const totalKm = stops.reduce((acc, s, i) => {
    const prev = i === 0 ? truck.depot : stops[i - 1];
    return acc + haversine(prev.lat, prev.lng, s.lat, s.lng);
  }, 0);
  const savedKm  = Math.max(0, stops.length * 3.2 - totalKm);
  const estMin   = Math.round(totalKm / 25 * 60);
  const co2Base  = (savedKm * 0.21).toFixed(2);

  const isWorking = loading || recalcing;

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      <style>{ROUTE_CSS}</style>

      {/* ── Mapa ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>

        {/* Overlay de carga */}
        {isWorking && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: '#040e1799', backdropFilter: 'blur(2px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <Spinner color={truck.color} size={32} />
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: truck.color }}>
              {recalcing ? 'Recalculando ruta D-VRP…' : 'Trazando ruta…'}
            </span>
          </div>
        )}

        {/* Contador en vivo: Parada X de N */}
        {tripInProg && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            zIndex: 11, background: '#071520ee', borderRadius: 8, padding: '6px 16px',
            border: `1px solid ${truck.color}55`,
            fontFamily: 'monospace', fontSize: 12, color: truck.color,
            boxShadow: `0 0 12px ${truck.color}44`,
          }}>
            Parada {Math.min(nextStopNum + 1, stops.length)} de {stops.length} — en camino
          </div>
        )}

        {mapsLoaded ? (
          <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }}
            center={CENTER} zoom={14} options={MAP_OPTS} onLoad={() => setMapReady(true)}>
            {mapReady && (
              <>
                {/* Contenedores atenuados */}
                {containers.map(c => (
                  <OverlayView key={c.id} position={{ lat: c.lat, lng: c.lng }}
                    mapPaneName={OverlayView.OVERLAY_LAYER}
                    getPixelPositionOffset={() => ({ x: -5, y: -5 })}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(c.status), opacity: 0.2 }} />
                  </OverlayView>
                ))}

                {/* Trazo de ruta */}
                {animPath.length > 1 && (
                  <Polyline path={animPath} options={{
                    strokeColor: truck.color, strokeWeight: 6, strokeOpacity: 0.88, zIndex: 10,
                  }} />
                )}

                {/* Depósito */}
                {stops.length > 0 && (
                  <OverlayView position={truck.depot} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={() => ({ x: -13, y: -13 })}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 5, background: truck.color,
                      boxShadow: `0 0 10px ${truck.color}88`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#040e17',
                    }}>D</div>
                  </OverlayView>
                )}

                {/* Paradas numeradas */}
                {stops.map((s, i) => {
                  const done    = !!collected[s.id];
                  const active  = collectingId === s.id;
                  return (
                    <OverlayView key={s.id} position={{ lat: s.lat, lng: s.lng }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      getPixelPositionOffset={() => ({ x: -13, y: -13 })}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: done ? '#00ff88' : truck.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: done ? 14 : 9, fontFamily: 'monospace', fontWeight: 700, color: '#040e17',
                        boxShadow: done
                          ? '0 0 14px #00ff88aa'
                          : `0 0 10px ${truck.color}88`,
                        animation: active ? 'stopFlash 0.5s ease-in-out 4' : 'none',
                        transition: 'background 0.4s, box-shadow 0.4s',
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                    </OverlayView>
                  );
                })}

                {/* Nube de recolección sobre el contenedor activo */}
                {collectingId && (() => {
                  const s = stops.find(x => x.id === collectingId);
                  if (!s) return null;
                  return (
                    <OverlayView position={{ lat: s.lat, lng: s.lng }}
                      mapPaneName={OverlayView.OVERLAY_LAYER}
                      getPixelPositionOffset={() => ({ x: -15, y: -50 })}>
                      <CollectCloud color={truck.color} />
                    </OverlayView>
                  );
                })()}

                {/* Marcador del camión moviéndose */}
                {truckPos && (
                  <OverlayView position={truckPos}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={() => ({ x: -19, y: -26 })}>
                    <TruckMarker color={truck.color} label={truck.name} />
                  </OverlayView>
                )}

                {/* Empty state */}
                {!loading && stops.length === 0 && (
                  <OverlayView position={CENTER} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}>
                    <div style={{
                      background: '#071520ee', border: `1px solid ${truck.color}44`,
                      borderRadius: 12, padding: '16px 24px', textAlign: 'center', pointerEvents: 'none',
                    }}>
                      <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
                      <div style={{ fontSize: 12, color: truck.color, fontFamily: 'monospace', fontWeight: 700 }}>
                        Zona {truck.zones.join(', ')} al día
                      </div>
                      <div style={{ fontSize: 10, color: '#4a6a8a', marginTop: 4 }}>
                        No hay contenedores que requieran recolección
                      </div>
                    </div>
                  </OverlayView>
                )}
              </>
            )}
          </GoogleMap>
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: '#060f1a', borderRadius: 12,
            border: '1px solid #0a2540', color: '#3a6a8a', fontFamily: 'monospace', fontSize: 12,
          }}>
            Mapa no disponible — configura VITE_GOOGLE_MAPS_KEY
          </div>
        )}
      </div>

      {/* ── Panel derecho ─────────────────────────────────────────────────── */}
      <div style={{ width: 268, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Selector camión */}
        <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Seleccionar camión
          </div>
          {TRUCKS.map(t => (
            <button key={t.id} onClick={() => setTruckId(t.id)} disabled={isWorking || tripInProg} style={{
              width: '100%', marginBottom: 6, padding: '9px 12px', borderRadius: 7,
              border: `1px solid ${truckId === t.id ? t.color : C.border}`,
              background: truckId === t.id ? `${t.color}18` : 'transparent',
              color: truckId === t.id ? t.color : C.textDim,
              fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', textAlign: 'left',
              opacity: (isWorking || tripInProg) ? 0.5 : 1, transition: 'all 0.15s',
            }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t.color, marginRight: 8 }} />
              {t.name}
            </button>
          ))}
        </div>

        {/* KPIs — mezcla de ruta base y stats del viaje */}
        <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            KPIs de ruta
          </div>
          {[
            { label: 'Paradas totales',     val: stops.length,                      color: truck.color },
            { label: 'Recolectadas',        val: `${tripStats.count} / ${stops.length}`, color: '#00ff88', anim: true },
            { label: 'Km totales',          val: `${totalKm.toFixed(1)} km`,        color: truck.color },
            { label: 'Km ahorrados',        val: `${(savedKm + tripStats.km).toFixed(1)} km`, color: '#00ff88', anim: true },
            { label: 'Tiempo est.',         val: `${estMin} min`,                   color: '#ffd600'   },
            { label: 'CO₂ evitado',         val: `${(parseFloat(co2Base) + tripStats.co2).toFixed(2)} kg`, color: '#00ff88', anim: true },
          ].map(({ label, val, color, anim }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.textDim }}>{label}</span>
              <span key={`${label}-${val}`} style={{
                fontFamily: 'monospace', fontSize: 13, color, fontWeight: 700,
                opacity: isWorking ? 0.4 : 1,
                animation: anim && tripStats.count > 0 ? 'kpiPop 0.4s ease-out' : 'none',
              }}>
                {isWorking ? '—' : val}
              </span>
            </div>
          ))}

          {/* Botón RECALCULAR / NUEVA RUTA */}
          <button
            onClick={tripDone ? () => fetchRoute(true) : handleRecalculate}
            disabled={isWorking || tripInProg}
            style={{
              width: '100%', marginTop: 8, padding: '10px', borderRadius: 6,
              border: `1px solid ${truck.color}`,
              background: isWorking || tripInProg ? C.border : `${truck.color}18`,
              color: isWorking || tripInProg ? C.textDim : truck.color,
              fontFamily: 'monospace', fontSize: 11,
              cursor: isWorking || tripInProg ? 'not-allowed' : 'pointer',
              fontWeight: 700, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {recalcing ? <><Spinner color={truck.color} /> Recalculando…</>
              : loading  ? <><Spinner color={truck.color} /> Trazando ruta…</>
              : tripInProg ? '⟳ Recogida en progreso…'
              : tripDone   ? '↺ NUEVA RUTA'
              : '↺ RECALCULAR RUTA'}
          </button>

          {dirError && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#ffd60099', fontFamily: 'monospace' }}>
              Directions API sin cuota — ruta en línea recta
            </div>
          )}
        </div>

        {/* Resumen final del viaje */}
        {tripDone && (
          <div style={{
            background: '#00ff8810', border: '1px solid #00ff8833', borderRadius: 12,
            padding: 16, animation: 'summaryIn 0.5s ease',
          }}>
            <div style={{ fontSize: 9, color: '#00ff88', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              ✓ Viaje completado
            </div>
            {[
              { label: 'Contenedores vaciados', val: `${tripStats.count}` },
              { label: 'Km ahorradores',        val: `${tripStats.km.toFixed(1)} km` },
              { label: 'CO₂ evitado',           val: `${tripStats.co2.toFixed(2)} kg` },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textDim }}>{label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#00ff88', fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de paradas */}
        <div style={{
          background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 16, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <StopsList
            stops={stops} truck={truck} depot={truck.depot}
            loading={loading} collected={collected}
            animLevels={animLevels} collectingId={collectingId}
          />
        </div>
      </div>
    </div>
  );
}
