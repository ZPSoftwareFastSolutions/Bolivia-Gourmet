import type { NextConfig } from 'next';
import { POLITICA_DE_ARCHIVOS } from './src/lib/politica-de-contenido';

/**
 * Cabeceras de seguridad comunes y política de archivos (ADR 0006).
 *
 * LA CSP DE LAS PÁGINAS NO ESTÁ AQUÍ: necesita un nonce nuevo en cada
 * respuesta y eso solo lo puede poner `src/proxy.ts`. Aquí van las cabeceras
 * que no cambian y la CSP de los archivos, que no pasan por el proxy.
 */

/** Extensiones servidas tal cual. Misma lista que el `matcher` de src/proxy.ts. */
const ARCHIVOS = '.+\\.(?:ico|png|jpe?g|webp|avif|gif|svg|woff2?|css|js|map|txt|xml|json|webmanifest)$';

const cabecerasComunes = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Redundante con `frame-ancestors 'none'`, pero cubre navegadores antiguos.
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Dos años, subdominios incluidos. Sin `preload` hasta tener dominio propio:
  // entrar en la lista de precarga es difícil de deshacer. Los navegadores la
  // ignoran en http://localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

/**
 * Imágenes de `public/img`. Sus nombres no llevan hash: si se sustituye una,
 * conviene cambiarle el nombre para que nadie vea la antigua.
 */
const CACHE_DE_IMAGENES = 'public, max-age=86400, stale-while-revalidate=604800';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      { source: '/:ruta*', headers: cabecerasComunes },
      { source: `/:archivo(${ARCHIVOS})`, headers: [{ key: 'Content-Security-Policy', value: POLITICA_DE_ARCHIVOS }] },
      { source: '/img/:ruta*', headers: [{ key: 'Cache-Control', value: CACHE_DE_IMAGENES }] },
    ];
  },

  async redirects() {
    return [
      // Los navegadores piden /favicon.ico por su cuenta; el icono vive en /icon.png.
      { source: '/favicon.ico', destination: '/icon.png', permanent: true },
      // Los cursos de capacitación y «Aprende y emprende» son una sola página
      // (pedido del usuario): quien tenga guardado /emprende llega a /cursos.
      { source: '/emprende', destination: '/cursos', permanent: true },
    ];
  },
};

export default nextConfig;
