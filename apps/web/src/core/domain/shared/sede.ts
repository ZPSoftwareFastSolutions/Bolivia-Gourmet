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
