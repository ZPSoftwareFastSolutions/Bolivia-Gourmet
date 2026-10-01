/**
 * CAPA: Domain / Shared
 *
 * Sede física del instituto. Hay dos desde el inicio (La Paz y El Alto) y
 * toda operación (inscripción, movimiento, entrega, cobro) se atribuye a una.
 * No hay multi-tenant (ADR 0001): la sede es el único eje de alcance.
 */

import type { Id } from './tipos-base';

export interface Sede {
  readonly id: Id;
  /** Identificador estable en URL y configuración: `la-paz`, `el-alto`. */
  readonly codigo: string;
  readonly nombre: string;
  readonly zona: string;
  readonly direccion: string;
  /** Teléfono de contacto de la sede (8 dígitos, celular boliviano). */
  readonly telefono: string;
  readonly activa: boolean;
  /** Punto exacto en el mapa, cuando el instituto lo ha confirmado. */
  readonly ubicacion?: UbicacionDeSede;
}

/**
 * El lugar de Google Maps que publica el propio instituto. Las coordenadas son
 * las del lugar al que lleva su enlace, no una estimación a partir de la
 * dirección escrita (que pondría el pin en otro edificio).
 */
export interface UbicacionDeSede {
  /** Enlace corto de Google Maps compartido por el instituto. */
  readonly enlace: string;
  /** Nombre del lugar en Google Maps. */
  readonly lugar: string;
  readonly latitud: number;
  readonly longitud: number;
}

/** Enlaces cortos de Google Maps (`maps.app.goo.gl`): los que comparte la app. */
const PATRON_ENLACE_DE_MAPA = /^https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+$/;

/** Bolivia queda entre las latitudes −22,9 y −9,7 y las longitudes −69,7 y −57,4. */
export function esUbicacionValida(ubicacion: UbicacionDeSede): boolean {
  return (
    PATRON_ENLACE_DE_MAPA.test(ubicacion.enlace) &&
    ubicacion.lugar.trim().length > 0 &&
    ubicacion.latitud >= -22.9 &&
    ubicacion.latitud <= -9.7 &&
    ubicacion.longitud >= -69.7 &&
    ubicacion.longitud <= -57.4
  );
}

/** Celular boliviano: 8 dígitos que empiezan por 6 o 7. */
const PATRON_CELULAR = /^[67]\d{7}$/;

export function esCelularBoliviano(valor: string): boolean {
  return PATRON_CELULAR.test(valor.replace(/\s+/g, ''));
}

/** Enlace de WhatsApp con el prefijo internacional de Bolivia (+591). */
export function enlaceDeWhatsApp(celular: string, mensaje?: string): string {
  const numero = celular.replace(/\s+/g, '');
  const base = `https://wa.me/591${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
