import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Animaciones exclusivas del splash ──────────────────────────────────── */
const SPLASH_CSS = `
  @keyframes leafGrow {
    from { transform: scale(0) rotate(-25deg); opacity: 0; }
    to   { transform: scale(1) rotate(0deg);   opacity: 0.88; }
  }
  @keyframes droneLevitate {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-10px); }
  }
  @keyframes barShimmer {
    0%   { box-shadow: 0 0 6px #00d4ff44; }
    50%  { box-shadow: 0 0 22px #00d4ffbb, 0 0 40px #00ff8833; }
    100% { box-shadow: 0 0 6px #00d4ff44; }
  }
  @keyframes sweepRotate {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

const TITLE    = 'DRONEWASTE';
const SUBTITLE = 'Sistema Inteligente de Gestión de Residuos Urbanos';
const LOCATION = 'CHAPINERO · BOGOTÁ D.C. · 2026';

const PHASES = [
  { label: 'Inicializando flota de drones...',    at: 0   },
  { label: 'Conectando AWS IoT Core...',           at: 22  },
  { label: 'Cargando contenedores Chapinero...',   at: 45  },
  { label: 'Calibrando algoritmo D-VRP...',        at: 70  },
  { label: 'Sistema listo ✓',                      at: 90  },
];

/* ── Componente principal ────────────────────────────────────────────────── */
export default function SplashScreen({ onComplete }) {
  /* Ref estable para onComplete — evita que el efecto de carga se reinicie
     cuando el padre re-renderiza y crea una nueva referencia de la función. */
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  const canvasRef         = useRef(null);
  const [typed, setTyped] = useState('');
  const [showSub, setShowSub]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]       = useState(PHASES[0].label);
  const [cursorOn, setCursorOn] = useState(true);
  const [fadeOut, setFadeOut]   = useState(false);

  /* ── Canvas: partículas + radar giratorio ─────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let sweepAngle = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const N   = 50;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      /* grid lines */
      ctx.strokeStyle = 'rgba(0,212,255,0.04)';
      ctx.lineWidth   = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      /* radar rings */
      ctx.save();
      ctx.translate(cx, cy);
      [100, 200, 320, 460, 620].forEach(r => {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.05)';
        ctx.lineWidth   = 1;
        ctx.stroke();
      });

      /* cross-hairs */
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 700, Math.sin(a) * 700);
        ctx.strokeStyle = 'rgba(0,212,255,0.04)';
        ctx.lineWidth   = 0.5;
        ctx.stroke();
      }

      /* sweep line */
      sweepAngle += 0.007;
      const sx = Math.cos(sweepAngle) * 640;
      const sy = Math.sin(sweepAngle) * 640;
      const sweep = ctx.createLinearGradient(0, 0, sx, sy);
      sweep.addColorStop(0, 'rgba(0,212,255,0)');
      sweep.addColorStop(0.7, 'rgba(0,212,255,0.18)');
      sweep.addColorStop(1, 'rgba(0,255,136,0.08)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 640, sweepAngle - 0.55, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweep;
      ctx.fill();
      ctx.restore();

      /* particles */
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,212,255,0.45)';
        ctx.fill();
      });

      /* connections */
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${0.1 * (1 - d / 100)})`;
          ctx.lineWidth   = 0.4;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  /* ── Typewriter ──────────────────────────────────────────────────────── */
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(TITLE.slice(0, i));
      if (i >= TITLE.length) { clearInterval(iv); setTimeout(() => setShowSub(true), 350); }
    }, 85);
    return () => clearInterval(iv);
  }, []);

  /* ── Cursor blink ────────────────────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => setCursorOn(v => !v), 520);
    return () => clearInterval(iv);
  }, []);

  /* ── Barra de carga — 3 segundos ─────────────────────────────────────── */
  /* Deps vacías: corre UNA sola vez al montar. onCompleteRef siempre apunta
     a la versión más reciente del callback sin re-crear el intervalo. */
  useEffect(() => {
    const start    = Date.now();
    const DURATION = 3000;
    const iv = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / DURATION) * 100);
      setProgress(pct);
      const current = [...PHASES].reverse().find(p => pct >= p.at) || PHASES[0];
      setPhase(current.label);
      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => { setFadeOut(true); setTimeout(() => onCompleteRef.current?.(), 650); }, 500);
      }
    }, 40);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#040e17',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, overflow: 'hidden',
      opacity: fadeOut ? 0 : 1, transition: 'opacity 0.65s ease',
    }}>
      <style>{SPLASH_CSS}</style>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── Dron + hoja ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36, animation: 'droneLevitate 3.2s ease-in-out infinite' }}>
          <SplashLogo />
        </div>

        {/* ── Título typewriter ──────────────────────────────────────── */}
        <div style={{
          fontFamily: 'monospace', fontSize: 'clamp(36px, 6vw, 60px)',
          fontWeight: 700, letterSpacing: '0.12em', color: '#00d4ff',
          textShadow: '0 0 30px #00d4ff55, 0 0 60px #00d4ff22',
          minHeight: '1.2em', lineHeight: 1,
        }}>
          {typed}
          <span style={{ opacity: cursorOn ? 1 : 0, transition: 'opacity 0.1s' }}>|</span>
        </div>

        {/* ── Subtítulo ─────────────────────────────────────────────── */}
        <div style={{
          marginTop: 18, fontSize: 14, color: '#7a9ab8', letterSpacing: '0.15em',
          textAlign: 'center', fontFamily: 'system-ui, sans-serif',
          opacity: showSub ? 1 : 0, transition: 'opacity 0.9s ease',
          maxWidth: 480,
        }}>
          {SUBTITLE}
        </div>

        {/* ── Localización ──────────────────────────────────────────── */}
        <div style={{
          marginTop: 10, fontSize: 10, color: '#00ff88',
          letterSpacing: '0.3em', fontFamily: 'monospace',
          opacity: showSub ? 1 : 0, transition: 'opacity 1.1s ease 0.4s',
        }}>
          {LOCATION}
        </div>

        {/* ── Barra de carga ────────────────────────────────────────── */}
        <div style={{ marginTop: 56, width: 'clamp(320px, 50vw, 520px)' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
            fontFamily: 'monospace', fontSize: 11,
          }}>
            <span style={{ color: '#3a6a8a' }}>{phase}</span>
            <span style={{ color: '#00d4ff' }}>{Math.round(progress)}%</span>
          </div>

          {/* track */}
          <div style={{ height: 3, background: '#0a2540', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, width: `${progress}%`,
              background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
              borderRadius: 2, transition: 'width 0.04s linear',
              animation: 'barShimmer 1.8s ease-in-out infinite',
            }} />
          </div>

          {/* tick marks */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            {[0, 25, 50, 75, 100].map(t => (
              <div key={t} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <div style={{
                  width: 1, height: 5,
                  background: progress >= t ? '#00d4ff' : '#0a2540',
                  transition: 'background 0.4s',
                }} />
                <span style={{
                  fontSize: 8, fontFamily: 'monospace',
                  color: progress >= t ? '#00d4ff55' : '#0a2540',
                  transition: 'color 0.4s',
                }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tags de tecnología ────────────────────────────────────── */}
        <div style={{ marginTop: 28, display: 'flex', gap: 20 }}>
          {['AWS IoT Core', 'MobileNetV3', 'D-VRP', 'Spring Boot 3'].map(s => (
            <span key={s} style={{
              fontSize: 8, color: '#1a3a5a', fontFamily: 'monospace',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Logo SVG del splash ─────────────────────────────────────────────────── */
function SplashLogo() {
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      {/* Hoja — crece al cargar */}
      <path
        d="M65 118 C28 95 14 52 38 30 C47 22 62 18 74 28 C88 40 90 74 65 118Z"
        fill="#00ff88"
        style={{ animation: 'leafGrow 1.1s cubic-bezier(.34,1.56,.64,1) forwards' }}
      />
      {/* Cuerpo del dron */}
      <rect x="40" y="55" width="50" height="24" rx="7" fill="#00d4ff" />
      {/* Brazos */}
      {[
        [40, 60, 18, 38],
        [90, 60, 112, 38],
        [40, 73, 18, 92],
        [90, 73, 112, 92],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#00d4ff" strokeWidth="3" strokeLinecap="round" />
      ))}
      {/* Hélices */}
      {[[18, 38], [112, 38], [18, 92], [112, 92]].map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="14" ry="5"
          fill="none" stroke="#00d4ff" strokeWidth="2.5" opacity="0.72" />
      ))}
      {/* Cámara */}
      <circle cx="65" cy="70" r="7" fill="#040e17" />
      <circle cx="65" cy="70" r="3.5" fill="#00d4ff" opacity="0.9" />
      <circle cx="67" cy="68" r="1.2" fill="#fff" opacity="0.55" />
      {/* Luz de estado */}
      <circle cx="50" cy="67" r="2" fill="#00ff88" opacity="0.8" />
    </svg>
  );
}
