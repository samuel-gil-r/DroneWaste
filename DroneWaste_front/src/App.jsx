import { useState, useEffect, useRef, useCallback } from 'react';
import SplashScreen              from './pages/SplashScreen';
import MapWrapper                from './components/Map/MapWrapper';
import CityMap                   from './components/Map/CityMap';
import RoutesMap                 from './components/Routes/RoutesMap';
import { classifyImage }         from './services/claudeVision';
import { getContainers, getDrones, getAlerts } from './services/api';
import { CONTAINERS }            from './constants/mapData';

/* ── Global CSS ─────────────────────────────────────────────────────────── */
const STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #040e17; color: #c8d8e8; font-family: system-ui, sans-serif; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #071520; }
  ::-webkit-scrollbar-thumb { background: #0a2540; border-radius: 2px; }
  @keyframes ping {
    0%   { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }
  @keyframes slideIn {
    from { transform: translateX(-16px); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 4px #00d4ff88); }
    50%       { filter: drop-shadow(0 0 14px #00d4ffcc); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/* ── Palette ─────────────────────────────────────────────────────────────── */
const C = {
  bg: '#040e17', panel: '#071520',
  border: '#0a2540', border2: '#0d3060',
  blue: '#00d4ff', green: '#00ff88', red: '#ff2d55',
  yellow: '#ffd600', orange: '#ff8c00',
  text: '#c8d8e8', textDim: '#4a6a8a', textMid: '#8aaac8',
};

/* ── Status config ───────────────────────────────────────────────────────── */
const STATUS = {
  VACIO:      { label: 'VACÍO',      color: C.green  },
  BAJO:       { label: 'BAJO',       color: '#44dd88' },
  MEDIO:      { label: 'MEDIO',      color: C.yellow },
  ALTO:       { label: 'ALTO',       color: C.orange },
  DESBORDADO: { label: 'DESBORDADO', color: C.red    },
};

const getStatus = pct => {
  if (pct <= 10) return 'VACIO';
  if (pct <= 33) return 'BAJO';
  if (pct <= 66) return 'MEDIO';
  if (pct <= 90) return 'ALTO';
  return 'DESBORDADO';
};

const normalizeStatus = s => {
  const m = { 'VACÍO':'VACIO', VACIO:'VACIO', BAJO:'BAJO', MEDIO:'MEDIO', ALTO:'ALTO', DESBORDADO:'DESBORDADO' };
  return m[s?.toUpperCase?.()] || 'MEDIO';
};

/* ── 30 contenedores — importados de mapData.js (fuente única) ──────────── */
const RAW = CONTAINERS;

const initContainers = () =>
  RAW.map(c => { const pct = Math.random() * 85 + 5; return { ...c, pct, status: getStatus(pct) }; });

/* ── Drones — coords en lat/lng dentro de Chapinero ─────────────────────── */
const DRONE_BOUNDS = { minLat: 4.627, maxLat: 4.676, minLng: -74.078, maxLng: -74.046 };
const DRONES_INIT  = [
  { id: 'D1', lat: 4.635, lng: -74.072, vlat:  0.00008, vlng:  0.00012 },
  { id: 'D2', lat: 4.651, lng: -74.063, vlat: -0.00009, vlng:  0.00010 },
  { id: 'D3', lat: 4.664, lng: -74.055, vlat:  0.00007, vlng: -0.00011 },
];

/* ══════════════════════════════════════════════════════════════════════════ */
/* PARTICLE FIELD                                                             */
/* ══════════════════════════════════════════════════════════════════════════ */
function ParticleField() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const N = 55;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.45, vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 0.6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,212,255,0.55)'; ctx.fill();
      });
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${0.12 * (1 - d / 110)})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LOGO                                                                       */
/* ══════════════════════════════════════════════════════════════════════════ */
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ animation: 'glow 3s ease-in-out infinite', flexShrink: 0 }}>
        <path d="M22 40 C8 32 3 16 13 8 C17 5 24 4 29 9 C34 14 35 26 22 40Z" fill={C.green} opacity="0.82" />
        <rect x="14" y="18" width="16" height="9" rx="3" fill={C.blue} />
        {[[-8,-5],[8,-5],[-8,5],[8,5]].map(([dx,dy],i) => (
          <line key={i} x1={dx<0?14:30} y1={dy<0?20:26} x2={22+dx} y2={22+dy} stroke={C.blue} strokeWidth="1.8" />
        ))}
        {[[14,15],[30,15],[14,29],[30,29]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="5" ry="1.8" fill="none" stroke={C.blue} strokeWidth="1.3" opacity="0.75" />
        ))}
        <circle cx="22" cy="26" r="2.5" fill="#040e17" />
        <circle cx="22" cy="26" r="1.2" fill={C.blue} opacity="0.9" />
      </svg>
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, color: C.blue, letterSpacing: 2 }}>
          DRONE<span style={{ color: C.green }}>WASTE</span>
        </div>
        <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5 }}>BOGOTÁ · SMART CITY</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* SIDEBAR                                                                    */
/* ══════════════════════════════════════════════════════════════════════════ */
function Sidebar({ containers, alerts, onForceCrisis }) {
  const total       = containers.length;
  const desbordados = containers.filter(c => c.status === 'DESBORDADO').length;
  const altos       = containers.filter(c => c.status === 'ALTO').length;
  const normales    = total - desbordados - altos;
  const critPct     = Math.round(((desbordados + altos) / total) * 100);

  return (
    <aside style={{
      width: 252, minHeight: '100vh', background: 'rgba(7,21,32,0.97)',
      borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      padding: '18px 14px', gap: 18, flexShrink: 0, position: 'relative', zIndex: 10,
    }}>
      <Logo />

      <Sect label="Estado Sistema">
        {[
          { label: 'Contenedores', val: total,       color: C.text   },
          { label: 'Desbordados',  val: desbordados, color: C.red    },
          { label: 'Nivel Alto',   val: altos,       color: C.orange },
          { label: 'Normales',     val: normales,    color: C.green  },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: C.textDim }}>{label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color, fontWeight: 700 }}>{val}</span>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>CRÍTICOS</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: critPct > 30 ? C.red : C.orange }}>{critPct}%</span>
          </div>
          <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
            <div style={{
              height: '100%', width: `${critPct}%`, borderRadius: 3, transition: 'width 0.6s',
              background: critPct > 30 ? `linear-gradient(90deg,${C.orange},${C.red})` : `linear-gradient(90deg,${C.yellow},${C.orange})`,
              boxShadow: `0 0 8px ${critPct > 30 ? C.red : C.orange}88`,
            }} />
          </div>
        </div>
      </Sect>

      <Sect label="KPIs de Hoy">
        {[
          { label: 'Km ahorrados',  val: '247 km',  color: C.green },
          { label: 'T. respuesta',  val: '38 s',    color: C.blue  },
          { label: 'CO₂ evitado',   val: '18.4 kg', color: C.green },
          { label: 'Recolecciones', val: '23',       color: C.blue  },
        ].map(({ label, val, color }) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: `${C.border}55`, borderRadius: 7, padding: '7px 10px', marginBottom: 5,
          }}>
            <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color, fontWeight: 700 }}>{val}</span>
          </div>
        ))}
      </Sect>

      <Sect label="Flota Activa">
        {['D1', 'D2', 'D3'].map(id => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: C.green,
              boxShadow: `0 0 6px ${C.green}`, animation: 'pulse 1.8s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.blue, fontWeight: 700 }}>{id}</span>
            <svg width="16" height="10" viewBox="0 0 16 10" style={{ marginLeft: 2 }}>
              <rect x="4" y="3" width="8" height="5" rx="1" fill={C.blue} opacity="0.8" />
              {[[1,2],[13,2],[1,7],[13,7]].map(([cx,cy],i) => (
                <ellipse key={i} cx={cx} cy={cy} rx="2.5" ry="1" fill="none" stroke={C.blue} strokeWidth="0.8" opacity="0.7" />
              ))}
            </svg>
            <span style={{ fontSize: 9, color: C.green, marginLeft: 'auto', letterSpacing: 0.5 }}>EN VUELO</span>
          </div>
        ))}
      </Sect>

      <button onClick={onForceCrisis} style={{
        background: `linear-gradient(135deg,${C.red},#cc1133)`,
        border: 'none', borderRadius: 8, padding: '10px 14px',
        color: '#fff', fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
        cursor: 'pointer', letterSpacing: 1, boxShadow: `0 0 18px ${C.red}44`,
      }}>
        ⚠ FORZAR CRISIS
      </button>

      <Sect label="Alertas Recientes" style={{ flex: 1, overflow: 'hidden' }}>
        {!alerts.length && <div style={{ fontSize: 11, color: C.textDim }}>Sin alertas activas</div>}
        {alerts.slice(0, 4).map(a => (
          <div key={a.id} style={{
            background: '#ff2d5511', border: `1px solid ${C.red}33`,
            borderRadius: 6, padding: '6px 9px', marginBottom: 5,
            animation: 'slideIn 0.3s ease',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.red, fontWeight: 700 }}>{a.containerId}</div>
            <div style={{ fontSize: 10, color: C.text, marginTop: 2 }}>{a.msg}</div>
            <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{a.time}</div>
          </div>
        ))}
      </Sect>
    </aside>
  );
}

function Sect({ label, children, style }) {
  return (
    <section style={style}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 9, borderBottom: `1px solid ${C.border}`, paddingBottom: 5 }}>
        {label}
      </div>
      {children}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LIVE MAP — wrapper que usa CityMap                                         */
/* ══════════════════════════════════════════════════════════════════════════ */
function LiveMap({ containers, drones, onContainerClick, selected, activeScans }) {
  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      {/* Mapa Google Maps */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CityMap
          containers={containers}
          drones={drones}
          onContainerClick={onContainerClick}
          selected={selected}
          activeScans={activeScans}
        />
      </div>

      {/* Panel de detalle lateral */}
      <div style={{
        width: 210, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        opacity: selected ? 1 : 0.3, transition: 'opacity 0.2s',
      }}>
        {selected ? (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: 18, color: C.blue, fontWeight: 700 }}>{selected.id}</div>
            <div style={{ fontSize: 11, color: C.textMid }}>{selected.name}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>Zona: <span style={{ color: C.text }}>{selected.zone}</span></div>
            <div style={{
              background: `${STATUS[selected.status]?.color ?? C.blue}18`,
              border: `1px solid ${STATUS[selected.status]?.color ?? C.blue}44`,
              borderRadius: 8, padding: '10px 14px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: STATUS[selected.status]?.color ?? C.blue }}>
                {STATUS[selected.status]?.label ?? selected.status}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: C.textDim }}>Llenado</span>
                <span style={{ fontFamily: 'monospace', fontSize: 14, color: STATUS[selected.status]?.color ?? C.blue, fontWeight: 700 }}>
                  {Math.round(selected.pct)}%
                </span>
              </div>
              <div style={{ height: 8, background: C.border, borderRadius: 4 }}>
                <div style={{
                  height: '100%', width: `${selected.pct}%`,
                  background: STATUS[selected.status]?.color ?? C.blue,
                  borderRadius: 4, transition: 'width 0.5s',
                  boxShadow: `0 0 8px ${STATUS[selected.status]?.color ?? C.blue}88`,
                }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', lineHeight: 1.8 }}>
              <div>LAT: {selected.lat.toFixed(4)}</div>
              <div>LNG: {selected.lng.toFixed(4)}</div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="16" stroke={C.border} strokeWidth="1.5" />
              <circle cx="18" cy="18" r="6"  fill={C.border} />
            </svg>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>Clic en un contenedor</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* CLASSIFIER TAB                                                             */
/* ══════════════════════════════════════════════════════════════════════════ */
function Classifier({ onNewAlert }) {
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const handleFile = useCallback(file => {
    if (!file?.type.startsWith('image/')) return;
    setImage(file); setResult(null); setError(null);
    const r = new FileReader();
    r.onload = e => setPreview(e.target.result);
    r.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const classify = async () => {
    if (!image) return;
    setLoading(true); setProgress(0); setError(null); setResult(null);
    const tick = setInterval(() => setProgress(p => Math.min(p + 7, 88)), 180);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(image);
      });
      const json = await classifyImage(b64, image.type);
      clearInterval(tick); setProgress(100);
      const statusKey = normalizeStatus(json.estado);
      setResult({ ...json, statusKey });
      if (statusKey === 'DESBORDADO') {
        onNewAlert({ id: Date.now(), containerId: 'FOTO-IA', msg: 'DESBORDADO detectado por visión artificial', time: new Date().toLocaleTimeString() });
      }
    } catch (e) {
      clearInterval(tick); setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sColor = result ? (STATUS[result.statusKey]?.color || C.blue) : C.blue;

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            flex: preview ? 'none' : 1, minHeight: 200,
            border: `2px dashed ${dragging ? C.blue : C.border}`,
            borderRadius: 12, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: dragging ? `${C.blue}08` : '#040e17',
            transition: 'border-color 0.2s, background 0.2s', overflow: 'hidden',
          }}
        >
          {preview ? (
            <img src={preview} alt="preview" style={{ maxHeight: 300, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="24" stroke={C.border} strokeWidth="1.5" />
                <path d="M26 14V36M26 14L18 22M26 14L34 22" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ color: C.textMid, fontSize: 13 }}>Arrastra una foto del contenedor</div>
              <div style={{ color: C.textDim, fontSize: 11 }}>o haz clic para seleccionar</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        {preview && (
          <button onClick={() => { setImage(null); setPreview(null); setResult(null); setError(null); }}
            style={{ alignSelf:'flex-start', background:'transparent', border:`1px solid ${C.border}`, borderRadius:6, padding:'5px 12px', color:C.textDim, fontSize:11, cursor:'pointer' }}>
            Cambiar foto
          </button>
        )}
        {loading && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:11, color:C.blue, fontFamily:'monospace' }}>Analizando con MobileNetV3…</span>
              <span style={{ fontSize:11, color:C.blue, fontFamily:'monospace' }}>{progress}%</span>
            </div>
            <div style={{ height:6, background:C.border, borderRadius:3 }}>
              <div style={{ height:'100%', width:`${progress}%`, background:`linear-gradient(90deg,${C.blue},${C.green})`, borderRadius:3, transition:'width 0.18s', boxShadow:`0 0 12px ${C.blue}88` }} />
            </div>
          </div>
        )}
        <button onClick={classify} disabled={!image || loading} style={{
          background: image && !loading ? `linear-gradient(135deg,${C.blue},#006688)` : C.border,
          border:'none', borderRadius:8, padding:'13px 24px',
          color: image && !loading ? '#fff' : C.textDim,
          fontFamily:'monospace', fontSize:13, fontWeight:700,
          cursor: image && !loading ? 'pointer' : 'not-allowed', letterSpacing:1,
          boxShadow: image && !loading ? `0 0 20px ${C.blue}44` : 'none', transition:'all 0.2s',
        }}>
          {loading ? '⟳ CLASIFICANDO…' : '▶ CLASIFICAR CON IA'}
        </button>
        {error && <div style={{ fontSize:11, color:C.red, fontFamily:'monospace', background:'#ff2d5511', borderRadius:6, padding:'8px 12px' }}>Error: {error}</div>}
      </div>

      <div style={{ width:320, background:C.panel, borderRadius:12, border:`1px solid ${C.border}`, padding:20, display:'flex', flexDirection:'column', gap:12, overflow:'auto' }}>
        {result ? (
          <div style={{ animation:'fadeIn 0.4s ease', display:'flex', flexDirection:'column', gap:12 }}>

            {/* Header */}
            <div style={{ fontSize:9, color:C.textDim, letterSpacing:1.5, textTransform:'uppercase' }}>
              Análisis · Gemini Vision
            </div>

            {/* Estado + nivel */}
            <div style={{ background:`${sColor}15`, border:`1px solid ${sColor}44`, borderRadius:10, padding:'14px 18px', textAlign:'center' }}>
              <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:700, color:sColor, letterSpacing:2 }}>
                {result.estado ?? 'DESCONOCIDO'}
              </div>
              <div style={{ fontFamily:'monospace', fontSize:40, color:sColor, fontWeight:700, lineHeight:1, marginTop:6 }}>
                {result.nivel_pct ?? '—'}%
              </div>
            </div>

            {/* Barra de nivel */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:10, color:C.textDim }}>
                <span>Nivel de llenado</span>
                <span style={{ color:sColor, fontFamily:'monospace', fontWeight:700 }}>{result.nivel_pct ?? 0}%</span>
              </div>
              <div style={{ height:10, background:C.border, borderRadius:5 }}>
                <div style={{ height:'100%', width:`${result.nivel_pct ?? 0}%`, background:sColor, borderRadius:5, boxShadow:`0 0 10px ${sColor}88`, transition:'width 0.5s' }} />
              </div>
            </div>

            {/* Confianza */}
            <Row label="Confianza IA" val={`${result.confianza ?? '—'}%`} color={result.confianza >= 85 ? C.green : result.confianza >= 60 ? C.yellow : C.orange} />

            {/* Descripción del análisis — bloque prominente */}
            <div style={{ background:`${C.border}66`, borderRadius:8, padding:12 }}>
              <div style={{ fontSize:9, color:sColor, letterSpacing:1.2, marginBottom:7, fontWeight:700 }}>
                📷 DESCRIPCIÓN DEL ANÁLISIS
              </div>
              <div style={{ fontSize:12, color:C.text, lineHeight:1.7, fontStyle:'italic' }}>
                {result.justificacion ?? 'No se obtuvo descripción del análisis.'}
              </div>
            </div>

            {/* Acción recomendada */}
            <div style={{ background:`${C.green}12`, border:`1px solid ${C.green}30`, borderRadius:8, padding:10 }}>
              <div style={{ fontSize:9, color:C.green, letterSpacing:1, marginBottom:5, fontWeight:700 }}>
                ✅ ACCIÓN RECOMENDADA
              </div>
              <div style={{ fontSize:11, color:C.text, lineHeight:1.6 }}>
                {result.accion_recomendada ?? 'Programar revisión.'}
              </div>
            </div>

            {/* Metadata */}
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, background:`${C.border}44`, borderRadius:7, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:C.textDim, marginBottom:3 }}>TIEMPO EST.</div>
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.yellow, fontWeight:700 }}>
                  {result.tiempo_estimado ?? '< 24h'}
                </div>
              </div>
              <div style={{ flex:1, background:`${C.border}44`, borderRadius:7, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:C.textDim, marginBottom:3 }}>PRIORIDAD</div>
                <div style={{ fontFamily:'monospace', fontSize:12, color:C.orange, fontWeight:700 }}>
                  {result.prioridad ?? 'Media'}
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:20, textAlign:'center' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity:0.25 }}>
              <circle cx="32" cy="32" r="30" stroke={C.blue} strokeWidth="2" />
              <path d="M22 38C22 38 25 28 32 28C39 28 42 38 42 38" stroke={C.blue} strokeWidth="2" strokeLinecap="round"/>
              <circle cx="24" cy="30" r="2.5" fill={C.blue}/><circle cx="40" cy="30" r="2.5" fill={C.blue}/>
            </svg>
            <div style={{ fontSize:13, color:C.textMid }}>Sube una foto para clasificar</div>
            <div style={{ fontSize:11, color:C.textDim, lineHeight:1.6 }}>
              Gemini Vision analizará la imagen como si fuera capturada por el dron a 30 m de altura y describirá el nivel de llenado del contenedor.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, val, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:11, color:C.textDim }}>{label}</span>
      <span style={{ fontFamily:'monospace', fontSize:13, color, fontWeight:700 }}>{val}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* APP ROOT                                                                   */
/* ══════════════════════════════════════════════════════════════════════════ */
const TABS = ['Mapa', 'Clasificar', 'Rutas'];

export default function App() {
  const [showSplash,        setShowSplash]        = useState(true);
  const [tab,               setTab]               = useState('Mapa');
  const [containers,        setContainers]        = useState(initContainers);
  const [drones,            setDrones]            = useState(DRONES_INIT);
  const [alerts,            setAlerts]            = useState([]);
  const [selected,          setSelected]          = useState(null);
  const [backendOnline,     setBackendOnline]     = useState(false);
  const [activeScans,       setActiveScans]       = useState([]); // efectos de escaneo activos
  const prevOverflow    = useRef(new Set());
  const prevLastScanned = useRef({});            // {containerId: lastScanned ISO string}

  const addAlert = useCallback(a => setAlerts(prev => [a, ...prev].slice(0, 20)), []);

  /* ── Polling al backend cada 2 s (no corre durante el splash) ──────── */
  useEffect(() => {
    if (showSplash) return;          // ← espera a que el splash termine
    const sync = async () => {
      try {
        const [rawContainers, rawDrones, rawAlerts] = await Promise.all([
          getContainers(),
          getDrones(),
          getAlerts(10),
        ]);

        if (Array.isArray(rawContainers) && rawContainers.length) {
          const mapped = rawContainers.map(c => ({
            ...c, pct: Math.round((c.level ?? 0) * 100),
          }));
          setContainers(mapped);
          setBackendOnline(true);

          /* Detectar nuevos escaneos comparando lastScanned */
          const now = Date.now();
          const newScans = [];
          mapped.forEach(c => {
            if (c.lastScanned && c.lastScanned !== prevLastScanned.current[c.id]) {
              prevLastScanned.current[c.id] = c.lastScanned;
              newScans.push({
                key: `${c.id}-${c.lastScanned}`,
                containerId: c.id,
                droneId:     c.scannedBy,
                ts:          now,
              });
            }
          });
          if (newScans.length) {
            setActiveScans(prev => [
              ...prev.filter(s => now - s.ts < 1800),
              ...newScans,
            ]);
          } else {
            /* Limpiar los expirados */
            setActiveScans(prev => prev.filter(s => now - s.ts < 1800));
          }
        }

        if (Array.isArray(rawDrones) && rawDrones.length) {
          setDrones(prev => rawDrones.map(d => ({
            ...d,
            vlat: prev.find(p => p.id === d.id)?.vlat ?? 0.00008,
            vlng: prev.find(p => p.id === d.id)?.vlng ?? 0.00010,
          })));
        }

        if (Array.isArray(rawAlerts) && rawAlerts.length) {
          setAlerts(rawAlerts.map(a => ({
            id:          a.id,
            containerId: a.containerId,
            msg:         a.message,
            time:        new Date(a.timestamp).toLocaleTimeString(),
          })));
        }
      } catch {
        setBackendOnline(false);
      }
    };

    sync();
    const id = setInterval(sync, 2000);
    return () => clearInterval(id);
  }, [showSplash]); // arranca solo cuando showSplash pasa a false

  /* ── Simulación local de contenedores — solo si backend está caído ── */
  useEffect(() => {
    if (backendOnline) return;
    const id = setInterval(() => {
      setContainers(prev => prev.map(c => {
        const pct    = Math.max(0, Math.min(100, c.pct + (Math.random() - 0.22) * 4.5));
        const status = getStatus(pct);
        if (status === 'DESBORDADO' && !prevOverflow.current.has(c.id)) {
          prevOverflow.current.add(c.id);
          addAlert({ id: Date.now() + Math.random(), containerId: c.id, msg: `Desbordado en ${c.name}`, time: new Date().toLocaleTimeString() });
        } else if (status !== 'DESBORDADO') {
          prevOverflow.current.delete(c.id);
        }
        return { ...c, pct, status };
      }));
    }, 1800);
    return () => clearInterval(id);
  }, [backendOnline, addAlert]);

  /* ── Animación local de drones — solo si backend está caído ─────── */
  useEffect(() => {
    if (backendOnline) return;
    const id = setInterval(() => {
      setDrones(prev => prev.map(d => {
        let { lat, lng, vlat, vlng } = d;
        lat += vlat; lng += vlng;
        if (lat < DRONE_BOUNDS.minLat || lat > DRONE_BOUNDS.maxLat) vlat *= -1;
        if (lng < DRONE_BOUNDS.minLng || lng > DRONE_BOUNDS.maxLng) vlng *= -1;
        return { ...d, lat, lng, vlat, vlng };
      }));
    }, 80);
    return () => clearInterval(id);
  }, [backendOnline]);

  /* Sincronizar contenedor seleccionado con simulación */
  useEffect(() => {
    if (!selected) return;
    setSelected(s => containers.find(c => c.id === s?.id) || null);
  }, [containers]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Cuando el camión vacía un contenedor en Rutas → verde en mapa principal */
  const handleCollected = useCallback(id => {
    setContainers(prev => prev.map(c =>
      c.id === id ? { ...c, pct: 2, status: 'VACIO' } : c
    ));
  }, []);

  const forceCrisis = useCallback(() => {
    const idx = [...Array(containers.length).keys()].sort(() => Math.random() - 0.5).slice(0, 5);
    setContainers(prev => prev.map((c, i) => {
      if (!idx.includes(i)) return c;
      const pct = 91 + Math.random() * 9;
      return { ...c, pct, status: 'DESBORDADO' };
    }));
  }, [containers.length]);

  /* ── Splash ───────────────────────────────────────────────────────────── */
  const handleSplashDone = useCallback(() => setShowSplash(false), []);
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashDone} />;
  }

  return (
    <MapWrapper>
      <style>{STYLE}</style>
      <ParticleField />
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Sidebar containers={containers} alerts={alerts} onForceCrisis={forceCrisis} />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <nav style={{
            display: 'flex', gap: 2, padding: '10px 18px',
            borderBottom: `1px solid ${C.border}`, background: 'rgba(7,21,32,0.96)',
            backdropFilter: 'blur(8px)',
          }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 22px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 12, fontWeight: tab === t ? 700 : 400, letterSpacing: 1,
                background: tab === t ? `${C.blue}18` : 'transparent',
                color: tab === t ? C.blue : C.textDim,
                borderBottom: tab === t ? `2px solid ${C.blue}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                {t.toUpperCase()}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: backendOnline ? C.green : C.orange, animation: 'pulse 1.5s ease-in-out infinite', boxShadow: `0 0 6px ${backendOnline ? C.green : C.orange}` }} />
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: backendOnline ? C.green : C.orange }}>
                {backendOnline ? 'BACKEND CONECTADO' : 'SIMULACIÓN LOCAL'}
              </span>
            </div>
          </nav>

          <div style={{ flex: 1, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {tab === 'Mapa' && (
              <LiveMap containers={containers} drones={drones} onContainerClick={setSelected} selected={selected} activeScans={activeScans} />
            )}
            {tab === 'Clasificar' && <Classifier onNewAlert={addAlert} />}
            {tab === 'Rutas'      && <RoutesMap  containers={containers} onContainerCollected={handleCollected} />}
          </div>
        </main>
      </div>
    </MapWrapper>
  );
}
