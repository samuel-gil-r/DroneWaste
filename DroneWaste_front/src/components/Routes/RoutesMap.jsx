import { useState, useRef, useMemo, useEffect } from 'react';
import { GoogleMap, OverlayView, Polyline } from '@react-google-maps/api';
import { useMapsLoaded } from '../Map/MapWrapper';
import { useOneTruck } from '../../hooks/useOneTruck';

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
`;

/* ── Constantes ─────────────────────────────────────────────────────────── */
const CENTER   = { lat: 4.651, lng: -74.066 };
const BOUNDS   = { south: 4.625, west: -74.080, north: 4.678, east: -74.044 };
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
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill',
      stylers: [{ color: '#00d4ff' }, { visibility: 'on' }] },
  ],
};

export const TRUCKS = [
  { id: 'R1', name: 'R1 Norte',  color: '#00d4ff', zones: ['Norte'],  depot: { lat: 4.6568, lng: -74.0635 } },
  { id: 'R2', name: 'R2 Centro', color: '#00ff88', zones: ['Centro'], depot: { lat: 4.6404, lng: -74.0663 } },
  { id: 'R3', name: 'R3 Sur',    color: '#ffd600', zones: ['Sur'],    depot: { lat: 4.6296, lng: -74.0680 } },
];

const STATUS_COLOR = {
  VACIO: '#00ff88', BAJO: '#66ffbb', MEDIO: '#ffd600', ALTO: '#ff8c00', DESBORDADO: '#ff2d55',
};
const getColor = s => STATUS_COLOR[s] || STATUS_COLOR.MEDIO;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const C = { panel: '#071520', border: '#0a2540', textDim: '#4a6a8a', text: '#c8d8e8', textMid: '#8aaac8' };

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

/* ── Marcador camión ─────────────────────────────────────────────────────── */
function TruckMarker({ color, label }) {
  return (
    <div style={{ transform: 'translate(-50%,-60%)', pointerEvents: 'none', position: 'relative' }}>
      <svg width="38" height="26" viewBox="0 0 38 26">
        <rect x="1" y="6" width="20" height="13" rx="2.5" fill={color} />
        <path d="M20 8.5 L20 19 L36 19 L36 11.5 L29 6.5 L20 6.5 Z" fill={color} opacity="0.88" />
        <path d="M22 9.5 L28.5 9.5 L33 12 L33 16 L22 16 Z" fill="#040e17" opacity="0.55" />
        <circle cx="8"  cy="22" r="3.5" fill="#040e17" stroke={color} strokeWidth="1.8" />
        <circle cx="27" cy="22" r="3.5" fill="#040e17" stroke={color} strokeWidth="1.8" />
        <circle cx="36" cy="15.5" r="1.8" fill="#ffd600" opacity="0.95" />
        <rect x="2" y="9" width="8" height="4" rx="1" fill="#040e17" opacity="0.3" />
      </svg>
      <div style={{
        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
        background: color, borderRadius: 4, padding: '1px 6px',
        fontSize: 7.5, fontFamily: 'monospace', fontWeight: 700, color: '#040e17',
        whiteSpace: 'nowrap', boxShadow: `0 0 8px ${color}88`,
      }}>{label}</div>
    </div>
  );
}

/* ── Nube de recolección ─────────────────────────────────────────────────── */
function CollectCloud({ color }) {
  return (
    <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 2, animation: 'collectCloud 2.4s ease-out forwards' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#040e17', boxShadow: `0 0 18px ${color}` }}>✓</div>
      <div style={{ fontSize: 7.5, fontFamily: 'monospace', color, letterSpacing: 0.5,
        textShadow: `0 0 6px ${color}` }}>VACIADO</div>
    </div>
  );
}

/* ── Lista de paradas ────────────────────────────────────────────────────── */
function StopsList({ stops, truck, depot, loading, collected, animLevels, collectingId }) {
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 24 }}>
      <Spinner color={truck.color} size={24} />
      <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>Calculando paradas…</span>
    </div>
  );
  if (!stops.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 20 }}>
      <div style={{ fontSize: 28, opacity: 0.4 }}>⏳</div>
      <span style={{ fontSize: 11, color: C.textDim, textAlign: 'center', lineHeight: 1.6 }}>
        Esperando mínimo 4 contenedores<br />ALTO o DESBORDADO en zona<br />
        <span style={{ color: truck.color }}>{truck.zones.join(', ')}</span>
      </span>
    </div>
  );
  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
        Paradas ordenadas
      </div>
      {stops.map((s, i) => {
        const prev       = i === 0 ? depot : stops[i-1];
        const segKm      = haversine(prev.lat, prev.lng, s.lat, s.lng).toFixed(2);
        const isCollected= !!collected[s.id];
        const isActive   = collectingId === s.id;
        const dispPct    = animLevels[s.id] ?? Math.round(s.pct ?? (s.level ?? 0) * 100);
        const color      = isCollected ? '#00ff88' : getColor(s.status);
        return (
          <div key={s.id} style={{
            padding: '9px 10px', marginBottom: 6, borderRadius: 7,
            background: isCollected ? '#00ff8810' : `${color}0e`,
            border: `1px solid ${isCollected ? '#00ff8840' : `${color}28`}`,
            transition: 'all 0.4s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                color: isCollected ? '#00ff88' : truck.color }}>
                {isCollected ? '✓' : `#${i+1}`} {s.id}
              </span>
              <span style={{ fontSize: 9, color, fontWeight: 700 }}>
                {isCollected ? 'VACIADO' : s.status}
              </span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${dispPct}%`,
                background: isCollected ? '#00ff88' : color,
                borderRadius: 2, transition: 'width 0.1s linear' }} />
            </div>
            <div style={{ fontSize: 10, color: C.textMid }}>{s.name}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
              {s.zone} · {dispPct}% · +{segKm} km
              {isCollected && <span style={{ color: '#00ff88', marginLeft: 6 }}>✓ {collected[s.id]}</span>}
              {isActive && !isCollected && <span style={{ color, marginLeft: 6, animation: 'stopFlash 0.5s ease-in-out 4 alternate' }}>⟳ recogiendo</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* RoutesMap — 3 camiones simultáneos con auto-reinicio                       */
/* ══════════════════════════════════════════════════════════════════════════ */
export default function RoutesMap({ containers = [], onContainerCollected }) {
  const mapsLoaded   = useMapsLoaded();
  const [mapReady,   setMapReady]   = useState(false);
  const [selectedId, setSelectedId] = useState('R1');

  // Ref compartido para acceso sin causar re-renders
  const containersRef = useRef(containers);
  useEffect(() => { containersRef.current = containers; }, [containers]);

  // Un hook independiente por camión
  const r1 = useOneTruck(TRUCKS[0], containersRef, onContainerCollected);
  const r2 = useOneTruck(TRUCKS[1], containersRef, onContainerCollected);
  const r3 = useOneTruck(TRUCKS[2], containersRef, onContainerCollected);

  const routes = useMemo(() => ({ R1: r1, R2: r2, R3: r3 }), [r1, r2, r3]);
  const truck  = useMemo(() => TRUCKS.find(t => t.id === selectedId), [selectedId]);
  const sel    = routes[selectedId];

  // KPIs del camión seleccionado
  const totalKm = sel.stops.reduce((acc, s, i) => {
    const prev = i === 0 ? truck.depot : sel.stops[i-1];
    return acc + haversine(prev.lat, prev.lng, s.lat, s.lng);
  }, 0);
  const estMin = Math.round(totalKm / 25 * 60);

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      <style>{ROUTE_CSS}</style>

      {/* ── Mapa ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        {mapsLoaded ? (
          <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }}
            center={CENTER} zoom={14} options={MAP_OPTS} onLoad={() => setMapReady(true)}>
            {mapReady && (
              <>
                {/* Contenedores atenuados */}
                {containers.map(c => (
                  <OverlayView key={c.id} position={{ lat: c.lat, lng: c.lng }}
                    mapPaneName={OverlayView.OVERLAY_LAYER}
                    getPixelPositionOffset={() => ({ x: -4, y: -4 })}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%',
                      background: getColor(c.status), opacity: 0.18 }} />
                  </OverlayView>
                ))}

                {/* Rutas y camiones de los 3 trucks */}
                {TRUCKS.map(t => {
                  const r = routes[t.id];
                  return (
                    <span key={t.id}>
                      {/* Trazo de ruta */}
                      {r.animPath.length > 1 && (
                        <Polyline path={r.animPath} options={{
                          strokeColor: t.color,
                          strokeWeight: selectedId === t.id ? 6 : 3,
                          strokeOpacity: selectedId === t.id ? 0.9 : 0.45,
                          zIndex: selectedId === t.id ? 10 : 5,
                        }} />
                      )}

                      {/* Depósito */}
                      {r.stops.length > 0 && (
                        <OverlayView position={t.depot} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                          getPixelPositionOffset={() => ({ x: -10, y: -10 })}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 4, background: t.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#040e17',
                            boxShadow: `0 0 8px ${t.color}88`, opacity: selectedId === t.id ? 1 : 0.5,
                          }}>D</div>
                        </OverlayView>
                      )}

                      {/* Paradas numeradas */}
                      {r.stops.map((s, i) => {
                        const done = !!r.collected[s.id];
                        return (
                          <OverlayView key={s.id} position={{ lat: s.lat, lng: s.lng }}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            getPixelPositionOffset={() => ({ x: -10, y: -10 })}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              background: done ? '#00ff88' : t.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: done ? 11 : 8, fontFamily: 'monospace', fontWeight: 700,
                              color: '#040e17',
                              boxShadow: done ? '0 0 10px #00ff88aa' : `0 0 6px ${t.color}66`,
                              opacity: selectedId === t.id ? 1 : 0.4,
                              transition: 'background 0.4s',
                            }}>
                              {done ? '✓' : i+1}
                            </div>
                          </OverlayView>
                        );
                      })}

                      {/* Nube de recolección */}
                      {r.collectingId && (() => {
                        const s = r.stops.find(x => x.id === r.collectingId);
                        if (!s) return null;
                        return (
                          <OverlayView position={{ lat: s.lat, lng: s.lng }}
                            mapPaneName={OverlayView.OVERLAY_LAYER}
                            getPixelPositionOffset={() => ({ x: -15, y: -50 })}>
                            <CollectCloud color={t.color} />
                          </OverlayView>
                        );
                      })()}

                      {/* Marcador del camión */}
                      {r.truckPos && (
                        <OverlayView position={r.truckPos}
                          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                          getPixelPositionOffset={() => ({ x: -19, y: -26 })}>
                          <TruckMarker color={t.color} label={t.name} />
                        </OverlayView>
                      )}
                    </span>
                  );
                })}
              </>
            )}
          </GoogleMap>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: '#060f1a', borderRadius: 12,
            border: '1px solid #0a2540', color: '#3a6a8a', fontFamily: 'monospace', fontSize: 12 }}>
            Mapa no disponible — configura VITE_GOOGLE_MAPS_KEY
          </div>
        )}
      </div>

      {/* ── Panel derecho ─────────────────────────────────────────────────── */}
      <div style={{ width: 268, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Selector de camión */}
        <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Camión activo
          </div>
          {TRUCKS.map(t => {
            const r = routes[t.id];
            const done    = r.tripDone;
            const inProg  = r.tripInProg;
            const loading = r.loading;
            const badge   = loading ? '…' : inProg ? '▶' : done ? '↺ 12s' : '●';
            return (
              <button key={t.id} onClick={() => setSelectedId(t.id)} style={{
                width: '100%', marginBottom: 6, padding: '9px 12px', borderRadius: 7,
                border: `1px solid ${selectedId === t.id ? t.color : C.border}`,
                background: selectedId === t.id ? `${t.color}18` : 'transparent',
                color: selectedId === t.id ? t.color : C.textDim,
                fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: t.color, marginRight: 8 }} />
                  {t.name}
                </span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{badge} {r.stops.length} paradas</span>
              </button>
            );
          })}
        </div>

        {/* KPIs del camión seleccionado */}
        <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            KPIs — {truck.name}
          </div>
          {[
            { label: 'Paradas',       val: sel.stops.length,                              color: truck.color },
            { label: 'Recolectadas',  val: `${sel.tripStats.count} / ${sel.stops.length}`,color: '#00ff88' },
            { label: 'Km totales',    val: `${totalKm.toFixed(1)} km`,                    color: truck.color },
            { label: 'Tiempo est.',   val: `${estMin} min`,                                color: '#ffd600' },
            { label: 'CO₂ evitado',   val: `${sel.tripStats.co2.toFixed(2)} kg`,          color: '#00ff88' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.textDim }}>{label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color, fontWeight: 700 }}>
                {sel.loading ? '—' : val}
              </span>
            </div>
          ))}

          <button onClick={() => sel.fetchRoute(true)} disabled={sel.loading || sel.tripInProg} style={{
            width: '100%', marginTop: 8, padding: '10px', borderRadius: 6,
            border: `1px solid ${truck.color}`,
            background: sel.loading || sel.tripInProg ? C.border : `${truck.color}18`,
            color: sel.loading || sel.tripInProg ? C.textDim : truck.color,
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            cursor: sel.loading || sel.tripInProg ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {sel.loading   ? <><Spinner color={truck.color} /> Trazando…</>
            : sel.tripInProg ? '⟳ Recogida en progreso…'
            : sel.tripDone   ? '↺ Nueva ruta en 12s…'
            : '↺ Recalcular ruta'}
          </button>

          {sel.tripDone && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#00ff8899', fontFamily: 'monospace', textAlign: 'center' }}>
              ✓ Recorrido completado — reiniciando pronto
            </div>
          )}
        </div>

        {/* Lista de paradas */}
        <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 16, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <StopsList
            stops={sel.stops} truck={truck} depot={truck.depot}
            loading={sel.loading} collected={sel.collected}
            animLevels={sel.animLevels} collectingId={sel.collectingId}
          />
        </div>
      </div>
    </div>
  );
}
