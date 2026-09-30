import type { NextConfig } from 'next';

/**
 * Configuración de Next.
 *
 * Solo cabeceras de seguridad y ajustes generales. No hay reescrituras ni
 * redirecciones: la aplicación sirve un solo dominio para una sola
 * institución (ADR 0001). La CSP estricta con nonce se añadirá con el proxy
 * cuando exista el panel con sesión; hasta entonces basta con esta política
 * para archivos y las cabeceras comunes.
 */

const cabecerasComunes = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [{ source: '/:ruta*', headers: cabecerasComunes }];
  },
};

export default nextConfig;
