// Clasifica imagen de contenedor usando Gemini 1.5 Flash Vision API

/* ── Extrae el primer objeto JSON de cualquier texto ────────────────────── */
function extractJSON(text) {
  // Intento 1: parse directo
  try { return JSON.parse(text.trim()); } catch {}
  // Intento 2: quitar bloques markdown
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  // Intento 3: buscar la primera { ... } en el texto
  const match = text.match(/\{[\s\S]*?\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  // Intento 4: objeto más largo si hay llaves anidadas
  const fullMatch = text.match(/\{[\s\S]*\}/);
  if (fullMatch) { try { return JSON.parse(fullMatch[0]); } catch {} }
  return null;
}

/* ── Normaliza los campos independientemente del idioma / nombre ─────────── */
function normalize(raw) {
  if (!raw) return null;

  const estado = (
    raw.estado || raw.state || raw.status || raw.nivel_estado || raw.clasificacion || ''
  ).toUpperCase().trim() || 'MEDIO';

  const nivel_pct = parseInt(
    String(raw.nivel_pct ?? raw.porcentaje ?? raw.fill_level ??
           raw.level_pct ?? raw.porcentaje_llenado ?? raw.percentage ?? 50)
      .replace('%', ''), 10
  );

  const confianza = parseInt(
    String(raw.confianza ?? raw.confidence ?? raw.certainty ??
           raw.porcentaje_confianza ?? 75)
      .replace('%', ''), 10
  );

  const justificacion =
    raw.justificacion || raw.justification || raw.descripcion ||
    raw.description   || raw.analysis     || raw.observaciones ||
    raw.explanation   || 'Análisis completado por módulo de visión artificial.';

  const prioridad =
    raw.prioridad || raw.priority || raw.urgencia || 'Media';

  const accion_recomendada =
    raw.accion_recomendada || raw.accion || raw.action ||
    raw.recommendation     || raw.recomendacion || 'Programar revisión en próxima ruta.';

  const tiempo_estimado =
    raw.tiempo_estimado || raw.tiempo || raw.time_estimate ||
    raw.estimated_time  || '< 24h';

  return { estado, nivel_pct: isNaN(nivel_pct) ? 50 : nivel_pct,
           confianza: isNaN(confianza) ? 75 : confianza,
           justificacion, prioridad, accion_recomendada, tiempo_estimado };
}

/* ── Llamada a la API ────────────────────────────────────────────────────── */
export const classifyImage = async (base64Image, mimeType) => {
  /* VITE_GEMINI_KEY: key de Google AI Studio (aistudio.google.com/app/apikey)
     Es diferente a VITE_GOOGLE_MAPS_KEY — son APIs distintas.           */
  const key = import.meta.env.VITE_GEMINI_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

  const body = {
    contents: [{
      parts: [
        {
          inline_data: { mime_type: mimeType, data: base64Image }
        },
        {
          text: `Eres el módulo de visión embebida MobileNetV3 del sistema DroneWaste, en un dron sobrevolando Chapinero, Bogotá, a 30 metros de altura.

Analiza esta imagen y clasifica el nivel de llenado del contenedor de residuos.

CATEGORÍAS (usa EXACTAMENTE este texto en el campo "estado"):
- VACIO: 0-10% — sin residuos visibles, contenedor prácticamente vacío
- BAJO: 10-33% — menos de un tercio lleno
- MEDIO: 33-66% — entre un tercio y dos tercios lleno
- ALTO: 66-90% — más de dos tercios, tapa aún cerrable
- DESBORDADO: 90-100% — residuos desbordando el contenedor

Devuelve ÚNICAMENTE este JSON (sin texto antes ni después, sin markdown):
{
  "estado": "ALTO",
  "nivel_pct": 78,
  "confianza": 91,
  "justificacion": "Describe en 2-3 oraciones lo que ves en la imagen: tipo de residuos, nivel de llenado visible, condición del contenedor, factores de incertidumbre.",
  "prioridad": "Alta",
  "accion_recomendada": "Acción concreta que debe tomar el camión recolector.",
  "tiempo_estimado": "< 4h"
}`
        }
      ]
    }],
    generationConfig: {
      temperature:      0.1,
      maxOutputTokens:  600,
      responseMimeType: 'application/json', // fuerza respuesta JSON pura
    }
  };

  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!text) throw new Error('Gemini no devolvió contenido. Verifica la API key y los permisos.');

  const raw = extractJSON(text);
  if (!raw)  throw new Error(`No se pudo interpretar la respuesta de Gemini. Respuesta recibida: "${text.slice(0, 120)}…"`);

  const normalized = normalize(raw);
  if (!normalized) throw new Error('La respuesta no contiene los campos esperados.');

  return normalized;
};
