import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, OverlayView, InfoWindow } from '@react-google-maps/api';
import { useMapsLoaded } from './MapWrapper';

/* ── Constantes del mapa ─────────────────────────────────────────────────── */
const CENTER   = { lat: 4.651, lng: -74.063 };
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
    { featureType: 'poi',           stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',       stylers: [{ visibility: 'off' }] },
    {
      featureType: 'administrative.neighborhood',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#00d4ff' }, { visibility: 'on' }],
    },
  ],
};

/* ── Paleta por estado ───────────────────────────────────────────────────── */
const STATUS_COLOR = {
  VACIO:      '#00ff88',
  BAJO:       '#66ffbb',
  MEDIO:      '#ffd600',
  ALTO:       '#ff8c00',
  DESBORDADO: '#ff2d55',
};
const STATUS_LABEL = {
  VACIO: 'VACÍO', BAJO: 'BAJO', MEDIO: 'MEDIO', ALTO: 'ALTO', DESBORDADO: 'DESBORDADO',
};

const getColor  = s => STATUS_COLOR[s] || STATUS_COLOR.MEDIO;
const getLabel  = s => STATUS_LABEL[s] || s;
const isOverflow = s => s === 'DESBORDADO' || s === 4;

/* ── CSS keyframes inyectado una sola vez ────────────────────────────────── */
const CITY_CSS = `
  @keyframes pingMap {
    0%   { transform: scale(1); opacity: 0.85; }
    100% { transform: scale(3); opacity: 0; }
  }
  @keyframes pulseMap {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes radarRing {
    0%   { transform: scale(0.8); opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes scanExpand {
    0%   { transform: translate(-50%,-50%) scale(1);  opacity: 0.9; }
    100% { transform: translate(-50%,-50%) scale(14); opacity: 0;   }
  }
  @keyframes scanBeam {
    0%   { opacity: 0.8; }
    100% { opacity: 0; }
  }
  @keyframes containerFlash {
    0%,100% { filter: none; }
    25%,75% { filter: brightness(6) saturate(0); }
  }
`;

/* ── Fallback cuando Maps no está disponible ─────────────────────────────── */
function MapUnavailable() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060f1a', borderRadius: 12, border: '1px solid #0a2540',
      flexDirection: 'column', gap: 12,
    }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke="#0a2540" strokeWidth="2" />
        <path d="M14 34 L24 14 L34 34" stroke="#4a7a96" strokeWidth="2" fill="none" />
      </svg>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#3a6a8a' }}>
        Google Maps no disponible — configura VITE_GOOGLE_MAPS_KEY
      </span>
    </div>
  );
}

/* ── Marcador de contenedor ──────────────────────────────────────────────── */
function ContainerPin({ container, isSelected, isScanning, onClick }) {
  const color    = getColor(container.status);
  const overflow = isOverflow(container.status);
  return (
    <div
      onClick={onClick}
      title={container.id}
      style={{ position: 'relative', width: 18, height: 18, cursor: 'pointer',
               transform: 'translate(-50%, -50%)' }}
    >
      {overflow && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 18, height: 18, borderRadius: '50%',
          background: color, marginLeft: -9, marginTop: -9,
          animation: 'pingMap 1.1s ease-out infinite',
        }} />
      )}
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: isScanning ? '#ffffff' : color,
        border: `2.5px solid ${isSelected ? '#ffffff' : isScanning ? '#00d4ff' : 'rgba(255,255,255,0.25)'}`,
        boxShadow: isScanning
          ? '0 0 14px #00d4ff, 0 0 28px #00d4ff88'
          : isSelected
            ? `0 0 12px ${color}, 0 0 24px ${color}66`
            : `0 0 5px ${color}66`,
        animation: isScanning
          ? 'containerFlash 0.5s ease-in-out 3'
          : overflow ? 'pulseMap 0.9s ease-in-out infinite' : 'none',
        position: 'relative', zIndex: 1,
        transition: 'background 0.1s, box-shadow 0.1s',
      }} />
    </div>
  );
}

/* ── Marcador de dron ────────────────────────────────────────────────────── */
function DronePin({ drone }) {
  return (
    <div style={{ position: 'relative', transform: 'translate(-50%, -50%)', width: 28, height: 28 }}>
      {/* Radar ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 28, height: 28, borderRadius: '50%', marginLeft: -14, marginTop: -14,
        border: '1px solid rgba(0,212,255,0.5)',
        animation: 'radarRing 2s ease-out infinite',
      }} />
      {/* Drone icon */}
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="5" fill="#00d4ff" />
        {[[-7,-7],[7,-7],[-7,7],[7,7]].map(([dx,dy],i) => (
          <g key={i}>
            <line x1="14" y1="14" x2={14+dx*0.6} y2={14+dy*0.6} stroke="#00d4ff" strokeWidth="1.2" />
            <circle cx={14+dx} cy={14+dy} r="3.5" fill="none" stroke="#00d4ff" strokeWidth="1.2" opacity="0.7" />
          </g>
        ))}
      </svg>
      <div style={{
        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
        marginBottom: 2, fontSize: 8, fontFamily: 'monospace', color: '#00d4ff',
        whiteSpace: 'nowrap', textShadow: '0 1px 3px #000',
      }}>
        {drone.id}
      </div>
    </div>
  );
}

/* ── InfoWindow content ──────────────────────────────────────────────────── */
function ContainerInfo({ container }) {
  const color = getColor(container.status);
  const pct   = Math.round(container.pct ?? (container.level ?? 0) * 100);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: 180, padding: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#0a1628' }}>{container.id}</strong>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
          background: color, color: '#040e17',
        }}>{getLabel(container.status)}</span>
      </div>
      <div style={{ fontSize: 11, color: '#2a4a6a', marginBottom: 2 }}>{container.name}</div>
      <div style={{ fontSize: 11, color: '#4a6a8a', marginBottom: 8 }}>Zona: {container.zone}</div>

      {/* Barra de nivel */}
      <div style={{ fontSize: 10, color: '#2a4a6a', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>Llenado</span>
        <strong style={{ color: '#0a1628' }}>{pct}%</strong>
      </div>
      <div style={{ height: 6, background: '#e0e8f0', borderRadius: 3, marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>

      <div style={{ fontSize: 9, color: '#6a8aaa', fontFamily: 'monospace', lineHeight: 1.7 }}>
        <div>LAT: {container.lat?.toFixed(4)}</div>
        <div>LNG: {container.lng?.toFixed(4)}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* CityMap                                                                    */
/* Props: containers, drones, onContainerClick(container|null), selected     */
/* ══════════════════════════════════════════════════════════════════════════ */
export default function CityMap({ containers = [], drones = [], onContainerClick, selected, activeScans = [] }) {
  const mapsLoaded = useMapsLoaded();
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);

  const onLoad = useCallback(map => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
    setMapReady(false);
  }, []);

  if (!mapsLoaded) return <MapUnavailable />;

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      <style>{CITY_CSS}</style>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={CENTER}
        zoom={14}
        options={MAP_OPTS}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {mapReady && (
          <>
            {/* ── Contenedores ─────────────────────────────────────── */}
            {containers.map(c => {
              const scanning = activeScans.some(s => s.containerId === c.id);
              return (
                <OverlayView
                  key={c.id}
                  position={{ lat: c.lat, lng: c.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={() => ({ x: -9, y: -9 })}
                >
                  <ContainerPin
                    container={c}
                    isSelected={selected?.id === c.id}
                    isScanning={scanning}
                    onClick={() => onContainerClick?.(c)}
                  />
                </OverlayView>
              );
            })}

            {/* ── Efectos de escaneo: círculo expansivo desde el dron ── */}
            {activeScans.map(scan => {
              const drone = drones.find(d => d.id === scan.droneId);
              if (!drone) return null;
              return (
                <OverlayView
                  key={scan.key}
                  position={{ lat: drone.lat, lng: drone.lng }}
                  mapPaneName={OverlayView.OVERLAY_LAYER}
                  getPixelPositionOffset={() => ({ x: 0, y: 0 })}
                >
                  <div style={{ position: 'relative', pointerEvents: 'none' }}>
                    {/* Onda expansiva */}
                    <div style={{
                      position: 'absolute',
                      width: 24, height: 24,
                      borderRadius: '50%',
                      border: '2px solid #00d4ff',
                      animation: 'scanExpand 1.4s ease-out forwards',
                    }} />
                    {/* Segunda onda (desfasada) */}
                    <div style={{
                      position: 'absolute',
                      width: 24, height: 24,
                      borderRadius: '50%',
                      border: '1px solid #00ff88',
                      animation: 'scanExpand 1.4s ease-out 0.2s forwards',
                    }} />
                  </div>
                </OverlayView>
              );
            })}

            {/* ── Drones ───────────────────────────────────────────── */}
            {drones.map(d => (
              <OverlayView
                key={d.id}
                position={{ lat: d.lat, lng: d.lng }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={() => ({ x: -14, y: -14 })}
              >
                <DronePin drone={d} />
              </OverlayView>
            ))}

            {/* ── InfoWindow del contenedor seleccionado ────────────── */}
            {selected && (
              <InfoWindow
                position={{ lat: selected.lat, lng: selected.lng }}
                options={{ pixelOffset: new window.google.maps.Size(0, -20) }}
                onCloseClick={() => onContainerClick?.(null)}
              >
                <ContainerInfo container={selected} />
              </InfoWindow>
            )}
          </>
        )}
      </GoogleMap>
    </div>
  );
}
