/**
 * CAPA: Domain / Identidad
 *
 * Quién está usando el panel interno, qué puede hacer y en qué sedes. Lo
 * calcula la base (`public.mi_contexto()`); aquí solo se describe y se
 * consulta. La autorización la decide la base en cada RPC: la pantalla usa
 * estos permisos para no MOSTRAR lo que no se puede hacer, nunca para
 * permitirlo.
 *
 * Sin React, sin Next, sin I/O.
 */

import type { Rol } from './rol';
import type { FechaISO, Id } from '../shared/tipos-base';

/** Permisos del panel (`permisos_de_rol`, migración 20261002120000). */
export type Permiso =
  | 'panel.entrar'
  | 'sedes.todas'
  | 'perfiles.leer'
  | 'perfiles.gestionar'
  | 'solicitudes.leer'
  | 'solicitudes.gestionar'
  | 'estudiantes.leer'
  | 'estudiantes.gestionar'
  | 'estudiantes.archivar'
  | 'cohortes.leer'
  | 'cohortes.gestionar'
  | 'inscripciones.gestionar'
  | 'inventario.leer'
  | 'inventario.operar'
  | 'inventario.catalogo'
  | 'inventario.comprar'
  | 'inventario.ajustar'
  | 'inventario.anular'
  | 'caja.leer'
  | 'caja.cobrar'
  | 'caja.cerrar'
  | 'caja.anular'
  | 'caja.supervisar'
  | 'contabilidad.leer'
  | 'contabilidad.gestionar';

export interface SedeOperable {
  readonly id: Id;
  readonly codigo: string;
  readonly nombre: string;
  readonly zona: string;
}

export interface ContextoDePanel {
  readonly id: Id;
  readonly rol: Rol;
  readonly nombres: string;
  readonly apellidos: string;
  readonly correo: string;
  readonly activo: boolean;
  /** Sede de trabajo (perfiles.sede_id). Recepción opera solo en ella. */
  readonly sedeId: Id | null;
  /** Fecha de negocio de Bolivia según la base. */
  readonly hoy: FechaISO;
  readonly permisos: ReadonlySet<string>;
  /** Sedes en las que puede operar (todas con `sedes.todas`). */
  readonly sedes: readonly SedeOperable[];
}

export function tienePermiso(contexto: Pick<ContextoDePanel, 'permisos'>, permiso: Permiso): boolean {
  return contexto.permisos.has(permiso);
}

/** Entra al panel quien tiene `panel.entrar` y su cuenta está activa. */
export function puedeEntrarAlPanel(contexto: Pick<ContextoDePanel, 'permisos' | 'activo'>): boolean {
  return contexto.activo && tienePermiso(contexto, 'panel.entrar');
}

/** La sede en la que trabaja por defecto: la suya o, si opera todas, la primera. */
export function sedeDeTrabajo(contexto: Pick<ContextoDePanel, 'sedeId' | 'sedes'>): SedeOperable | null {
  return contexto.sedes.find((s) => s.id === contexto.sedeId) ?? contexto.sedes[0] ?? null;
}

/** Saludo según la hora de Bolivia: «Buenos días», «Buenas tardes», «Buenas noches». */
export function saludoSegunHora(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
