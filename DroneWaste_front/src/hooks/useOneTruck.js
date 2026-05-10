import { useState, useEffect, useCallback, useRef } from 'react';
import { useMapsLoaded } from '../components/Map/MapWrapper';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestNeighbor(origin, points) {
  if (!points.length) return [];
  const visited = new Set();
  const route = [];
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

/**
 * Gestiona toda la lógica de animación, ruta y recolección para UN camión.
 * Se auto-reinicia 12s después de completar el recorrido.
 */
export function useOneTruck(truck, containersRef, onCollected) {
  const mapsLoaded = useMapsLoaded();

  const [stops,       setStops]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fullPath,    setFullPath]    = useState([]);
  const [animPath,    setAnimPath]    = useState([]);
  const [truckPos,    setTruckPos]    = useState(null);
  const [tripInProg,  setTripInProg]  = useState(false);
  const [tripDone,    setTripDone]    = useState(false);
  const [collected,   setCollected]   = useState({});
  const [animLevels,  setAnimLevels]  = useState({});
  const [tripStats,   setTripStats]   = useState({ count: 0, km: 0, co2: 0 });
  const [nextStopNum, setNextStopNum] = useState(0);
  const [collectingId,setCollectingId]= useState(null);

  const stopsRef        = useRef([]);
  const animPathRef     = useRef([]);
  const animRef         = useRef(null);
  const truckAnimRef    = useRef({ iv: null, pathIdx: 0, nextStopIdx: 0 });
  const collectedSetRef = useRef(new Set());
  const dsRef           = useRef(null);
  const onPathDrawnRef  = useRef(null);
  const startTripRef    = useRef(null);
  const onCollectedRef  = useRef(onCollected);

  useEffect(() => { onCollectedRef.current = onCollected; }, [onCollected]);
  useEffect(() => { stopsRef.current = stops; }, [stops]);

  const computeLocal = useCallback(() => {
    const isCrit = s => s === 'ALTO' || s === 'DESBORDADO';
    const crit = containersRef.current.filter(
      c => isCrit(c.status) && truck.zones.includes(c.zone)
    );
    return nearestNeighbor(truck.depot, crit);
  }, [truck, containersRef]);

  const triggerCollection = useCallback((stop, idx) => {
    collectedSetRef.current.add(stop.id);
    const t = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    setCollected(prev => ({ ...prev, [stop.id]: t }));
    setCollectingId(stop.id);
    setNextStopNum(idx + 1);
    setTripStats(prev => ({
      count: prev.count + 1,
      km:    prev.km + 2.5,
      co2:   +(prev.co2 + 0.525).toFixed(2),
    }));

    const startPct = Math.round(stop.pct ?? (stop.level ?? 0) * 100);
    let cur = startPct;
    const step = Math.max(1, startPct / 20);
    const lv = setInterval(() => {
      cur = Math.max(0, cur - step);
      setAnimLevels(prev => ({ ...prev, [stop.id]: Math.round(cur) }));
      if (cur <= 0) clearInterval(lv);
    }, 100);
    setTimeout(() => setCollectingId(null), 2500);
    onCollectedRef.current?.(stop.id);

    const base = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    fetch(`${base}/api/containers/${stop.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stop, level: 0.02, status: 'VACIO', pct: 2 }),
    }).catch(() => {});
  }, []);

  const startTrip = useCallback(() => {
    const path = animPathRef.current;
    if (!path.length || !stopsRef.current.length) return;
    if (truckAnimRef.current.iv) clearInterval(truckAnimRef.current.iv);

    collectedSetRef.current = new Set();
    setCollected({}); setCollectingId(null); setAnimLevels({});
    setTripStats({ count: 0, km: 0, co2: 0 });
    setTripDone(false); setNextStopNum(0);
    setTruckPos(path[0]); setTripInProg(true);
    truckAnimRef.current = { iv: null, pathIdx: 0, nextStopIdx: 0 };

    truckAnimRef.current.iv = setInterval(() => {
      const { pathIdx, nextStopIdx } = truckAnimRef.current;
      const newIdx = Math.min(pathIdx + 1, path.length - 1);
      truckAnimRef.current.pathIdx = newIdx;
      setTruckPos(path[newIdx]);

      const curStops = stopsRef.current;
      if (nextStopIdx < curStops.length) {
        const stop = curStops[nextStopIdx];
        const dist = Math.hypot(path[newIdx].lat - stop.lat, path[newIdx].lng - stop.lng);
        if (dist < 0.0005 && !collectedSetRef.current.has(stop.id)) {
          triggerCollection(stop, nextStopIdx);
          truckAnimRef.current.nextStopIdx = nextStopIdx + 1;
        }
      }

      if (newIdx >= path.length - 1) {
        clearInterval(truckAnimRef.current.iv);
        truckAnimRef.current.iv = null;
        setTripInProg(false);
        setTripDone(true);
        setTruckPos(truck.depot);
      }
    }, 420);
  }, [truck, triggerCollection]);

  useEffect(() => { startTripRef.current = startTrip; }, [startTrip]);

  // Animación progresiva del trazo
  useEffect(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
    if (!fullPath.length) { setAnimPath([]); return; }
    animPathRef.current = [];
    let i = 0;
    const STEP = Math.max(1, Math.floor(fullPath.length / 90));
    animRef.current = setInterval(() => {
      i += STEP;
      if (i >= fullPath.length) {
        setAnimPath(fullPath); animPathRef.current = fullPath;
        clearInterval(animRef.current); animRef.current = null;
        if (onPathDrawnRef.current) { onPathDrawnRef.current(); onPathDrawnRef.current = null; }
      } else {
        const slice = fullPath.slice(0, i);
        setAnimPath(slice); animPathRef.current = slice;
      }
    }, 16);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [fullPath]);

  const fetchRoute = useCallback(async (force = false) => {
    if (truckAnimRef.current.iv !== null && !force) return;
    if (truckAnimRef.current.iv) { clearInterval(truckAnimRef.current.iv); truckAnimRef.current.iv = null; }
    setTripInProg(false); setTripDone(false); setTruckPos(null);
    setLoading(true);
    onPathDrawnRef.current = () => startTripRef.current?.();

    let routeStops;
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const res  = await fetch(`${base}/api/routes/${truck.id}`, { signal: AbortSignal.timeout(3000) });
      const data = res.ok ? await res.json() : null;
      routeStops = Array.isArray(data) && data.length > 0 ? data : computeLocal();
    } catch { routeStops = computeLocal(); }

    // Umbral mínimo: el camión solo sale si hay al menos 4 contenedores críticos.
    // Con menos paradas el viaje no justifica el consumo de combustible ni CO₂.
    const MIN_STOPS = 4;
    if (routeStops.length < MIN_STOPS) {
      setStops(routeStops);
      stopsRef.current = routeStops;
      setLoading(false);
      setTruckPos(truck.depot);
      // Reintentar en 30 s esperando que más contenedores lleguen al umbral
      setTimeout(() => fetchRoute(true), 30000);
      return;
    }

    setStops(routeStops);
    stopsRef.current = routeStops;

    if (mapsLoaded && window.google?.maps) {
      if (!dsRef.current) dsRef.current = new window.google.maps.DirectionsService();
      const last      = routeStops[routeStops.length - 1];
      const waypoints = routeStops.slice(0, -1).map(s => ({
        location: new window.google.maps.LatLng(s.lat, s.lng), stopover: true,
      }));
      try {
        const result = await new Promise((res, rej) => {
          dsRef.current.route({
            origin:      new window.google.maps.LatLng(truck.depot.lat, truck.depot.lng),
            destination: new window.google.maps.LatLng(last.lat, last.lng),
            waypoints, travelMode: window.google.maps.TravelMode.DRIVING, optimizeWaypoints: false,
          }, (r, status) => status === 'OK' ? res(r) : rej(status));
        });
        const path = [];
        result.routes[0].legs.forEach(leg =>
          leg.steps.forEach(step => step.path.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }))));
        setFullPath(path);
      } catch {
        setFullPath([truck.depot, ...routeStops.map(s => ({ lat: s.lat, lng: s.lng })), truck.depot]);
      }
    } else {
      setFullPath([truck.depot, ...routeStops.map(s => ({ lat: s.lat, lng: s.lng })), truck.depot]);
    }
    setLoading(false);
  }, [truck, mapsLoaded, computeLocal]); // eslint-disable-line

  // Carga inicial
  useEffect(() => { fetchRoute(); }, [mapsLoaded]); // eslint-disable-line

  // Auto-reinicio 12 s después de terminar el recorrido
  useEffect(() => {
    if (!tripDone) return;
    const t = setTimeout(() => fetchRoute(true), 12000);
    return () => clearTimeout(t);
  }, [tripDone]); // eslint-disable-line

  return {
    stops, loading, animPath, truckPos, tripInProg, tripDone,
    collected, animLevels, collectingId, nextStopNum, tripStats,
    fetchRoute,
  };
}
