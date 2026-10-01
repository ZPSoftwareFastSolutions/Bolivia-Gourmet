/**
 * CAPA: Presentation / App (layout raíz)
 *
 * - Carga las tres familias de la marca (docs/brand §4.2) con `next/font`:
 *   autoalojadas, sin petición a Google en tiempo de ejecución (`font-src
 *   'self'`) y sin salto de layout.
 * - Fuerza el renderizado DINÁMICO de todo el sitio: la CSP estricta lleva un
 *   nonce nuevo en cada respuesta y una página generada en el build no puede
 *   llevarlo (ADR 0006). `connection()` espera a la petición real.
 * - `noindex` hasta tener dominio propio (P12): un sitio de demostración no
 *   debe aparecer en buscadores con una URL provisional.
 */

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bebas_Neue, Kaushan_Script, Montserrat } from 'next/font/google';
import { connection } from 'next/server';
import { INSTITUTO } from '@contenido/instituto';
import { COLOR_DE_TEMA } from '@/lib/marca';
import '@/styles/globals.css';

const cuerpo = Montserrat({ subsets: ['latin'], display: 'swap', variable: '--font-montserrat' });
const display = Bebas_Neue({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-bebas' });
const script = Kaushan_Script({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-kaushan' });

const URL_DEL_SITIO = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(URL_DEL_SITIO),
  title: {
    default: `${INSTITUTO.nombreCorto} · Instituto de Gastronomía`,
    template: `%s · ${INSTITUTO.nombreCorto}`,
  },
  description: `${INSTITUTO.descripcion} Carrera de ${INSTITUTO.tituloOtorgado} y cursos cortos en La Paz y El Alto.`,
  applicationName: INSTITUTO.nombreCorto,
  authors: [{ name: INSTITUTO.nombreComercial }],
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    siteName: INSTITUTO.nombreComercial,
    title: `${INSTITUTO.nombreCorto}: ${INSTITUTO.lema}`,
    description: INSTITUTO.descripcion,
    images: [{ url: '/img/og.jpg', width: 1200, height: 630, alt: 'Estudiantes de Bolivia Gastronómica con uniforme de chef' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale`: impedir el zoom es una barrera para personas con baja visión.
  colorScheme: 'light',
  themeColor: COLOR_DE_TEMA,
};

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  await connection();
  return (
    <html lang="es-BO" className={`${cuerpo.variable} ${display.variable} ${script.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
