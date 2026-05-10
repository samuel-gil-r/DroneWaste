import { createContext, useContext } from 'react';
import { useLoadScript } from '@react-google-maps/api';

const LIBRARIES = ['directions'];

/* Contexto que expone isLoaded a cualquier componente hijo */
const MapsCtx = createContext(false);
export const useMapsLoaded = () => useContext(MapsCtx);

export default function MapWrapper({ children }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

  /* useLoadScript siempre se llama (regla de hooks) — con key vacía simplemente fallará */
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const noKey = !apiKey || apiKey === 'tu_api_key_aqui';

  return (
    <MapsCtx.Provider value={isLoaded && !loadError && !noKey}>

      {/* Aviso key faltante */}
      {noKey && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 200,
          background: '#1a1400', border: '1px solid #ffd60066',
          borderRadius: 8, padding: '8px 14px',
          fontFamily: 'monospace', fontSize: 11, color: '#ffd600',
        }}>
          ⚠ VITE_GOOGLE_MAPS_KEY no configurada — reinicia con <code>npm run dev</code>
        </div>
      )}

      {/* Aviso error de carga (key inválida, API no habilitada, etc.) */}
      {loadError && !noKey && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 200,
          background: '#1a0000', border: '1px solid #ff2d5566',
          borderRadius: 8, padding: '8px 14px',
          fontFamily: 'monospace', fontSize: 11, color: '#ff2d55', maxWidth: 360,
        }}>
          ⚠ Error Google Maps: {loadError.message || 'verifica la key y APIs habilitadas'}
        </div>
      )}

      {children}
    </MapsCtx.Provider>
  );
}
