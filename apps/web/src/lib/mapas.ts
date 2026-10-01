/**
 * Direcciones de Google Maps de una sede: el mapa incrustado y el enlace para
 * abrirlo aparte. Función pura para poder probarla sin navegador.
 *
 * Con ubicación confirmada (el lugar de Google Maps que publica el
 * instituto), el mapa se centra en sus coordenadas y el enlace es el suyo.
 * Sin ella, se busca por la dirección escrita: nunca una coordenada inventada.
 */

import type { UbicacionDeSede } from '@core/domain/shared/sede';

export function direccionesDeMapa(direccion: string, ubicacion?: UbicacionDeSede): { readonly incrustado: string; readonly externo: string } {
  if (ubicacion) {
    const punto = `${ubicacion.latitud},${ubicacion.longitud}`;
    return { incrustado: `https://www.google.com/maps?q=${punto}&z=18&output=embed`, externo: ubicacion.enlace };
  }
  const consulta = encodeURIComponent(`${direccion}, Bolivia`);
  return {
    incrustado: `https://www.google.com/maps?q=${consulta}&output=embed`,
    externo: `https://www.google.com/maps/search/?api=1&query=${consulta}`,
  };
}
