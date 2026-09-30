/**
 * CAPA: Presentation / App (layout raíz)
 *
 * Carga las tres familias tipográficas de la marca (docs/brand §4.2) y las
 * expone como variables CSS que `globals.css` mapea a los tokens
 * `--t-fuente-*`. `next/font` las descarga y autoaloja en el build: sin
 * petición a Google en tiempo de ejecución y sin salto de layout.
 */

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bebas_Neue, Kaushan_Script, Montserrat } from 'next/font/google';
import { INSTITUTO } from '@contenido/instituto';
import '@/styles/globals.css';

const cuerpo = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

const display = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-bebas',
});

const script = Kaushan_Script({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-kaushan',
});

export const metadata: Metadata = {
  title: {
    default: INSTITUTO.nombreComercial,
    template: `%s | ${INSTITUTO.nombreCorto}`,
  },
  description: INSTITUTO.descripcion,
  authors: [{ name: 'ZP Software Fast Solutions' }],
  // Sin dominio ni contenido definitivo, el sitio no debe indexarse todavía.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No se fija `maximumScale`: impedir el zoom es una barrera de accesibilidad.
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${cuerpo.variable} ${display.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
