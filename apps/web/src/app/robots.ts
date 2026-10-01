/**
 * robots.txt — el sitio NO se indexa todavía: no tiene dominio propio (P12)
 * y es una demostración. Cuando se publique con dominio, se abre `/` y se
 * mantienen cerrados el portal y los retornos de autenticación.
 */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
