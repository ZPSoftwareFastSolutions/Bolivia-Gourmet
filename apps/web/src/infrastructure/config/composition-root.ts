/**
 * CAPA: Infrastructure / Config
 *
 * COMPOSITION ROOT.
 *
 * Único lugar donde se decide qué implementación concreta satisface cada
 * puerto. Ninguna otra parte del código construye adaptadores.
 *
 * - El catálogo académico es estático: singleton de proceso.
 * - Autenticación y portal se crean POR PETICIÓN con el cliente de Supabase
 *   que lleva la cookie de quien pregunta. Cachearlos serviría la sesión del
 *   primer estudiante a todos.
 * - Los adaptadores de Supabase se importan de forma dinámica: así este
 *   módulo (y las pruebas que lo cargan) no arrastran `next/headers` hasta que
 *   de verdad se necesitan.
 */

import type { AlumnosPort } from '@core/application/ports/alumnos.port';
import type { AutenticacionPort } from '@core/application/ports/autenticacion.port';
import type { CajaPort } from '@core/application/ports/caja.port';
import type { CatalogoAcademicoPort } from '@core/application/ports/catalogo-academico.port';
import type { ContabilidadPort } from '@core/application/ports/contabilidad.port';
import type { InventarioPort } from '@core/application/ports/inventario.port';
import type { PanelPort } from '@core/application/ports/panel.port';
import type { PortalRepositoryPort } from '@core/application/ports/portal-repository.port';
import type { TableroPort } from '@core/application/ports/tablero.port';
import type { Id } from '@core/domain/shared/tipos-base';
import { CatalogoEstaticoRepository } from '../catalogo/catalogo-estatico.repository';

let catalogoEnCache: CatalogoAcademicoPort | null = null;

/** Singleton de proceso: el catálogo es estático y no guarda estado por petición. */
export function catalogoAcademico(): CatalogoAcademicoPort {
  catalogoEnCache ??= new CatalogoEstaticoRepository();
  return catalogoEnCache;
}

/** Autenticación del portal con la cookie de ESTA petición. */
export async function autenticacion(): Promise<AutenticacionPort> {
  const [{ crearClienteDeServidor, afirmaTenerSesion }, { AutenticacionSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/autenticacion.supabase'),
  ]);
  const [cliente, conCookie] = await Promise.all([crearClienteDeServidor(), afirmaTenerSesion()]);
  return new AutenticacionSupabase(cliente, conCookie);
}

/** Datos del portal del estudiante autenticado en ESTA petición. */
export async function portalRepository(usuarioId: Id): Promise<PortalRepositoryPort> {
  const [{ crearClienteDeServidor }, { PortalSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/portal.supabase'),
  ]);
  return new PortalSupabase(await crearClienteDeServidor(), usuarioId);
}

/** Alumnos, grupos, inscripciones y solicitudes del panel, con la sesión de ESTA petición. */
export async function alumnosRepository(): Promise<AlumnosPort> {
  const [{ crearClienteDeServidor }, { PanelAlumnosSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/panel-alumnos.supabase'),
  ]);
  return new PanelAlumnosSupabase(await crearClienteDeServidor());
}

/** Caja del panel (cobros, arqueos, anulaciones, gastos), con la sesión de ESTA petición. */
export async function cajaRepository(): Promise<CajaPort> {
  const [{ crearClienteDeServidor }, { PanelCajaSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/panel-caja.supabase'),
  ]);
  return new PanelCajaSupabase(await crearClienteDeServidor());
}

export async function inventarioRepository(): Promise<InventarioPort> {
  const [{ crearClienteDeServidor }, { PanelInventarioSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/panel-inventario.supabase'),
  ]);
  return new PanelInventarioSupabase(await crearClienteDeServidor());
}

/** Contabilidad del panel (solo lectura: totales, cuadre, gastos, compras, tarjeta PEPS), con la sesión de ESTA petición. */
export async function contabilidadRepository(): Promise<ContabilidadPort> {
  const [{ crearClienteDeServidor }, { PanelContabilidadSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/panel-contabilidad.supabase'),
  ]);
  return new PanelContabilidadSupabase(await crearClienteDeServidor());
}

/** Tablero de administración (lo que suma `tablero_de_administracion`), con la sesión de ESTA petición. */
export async function tableroRepository(): Promise<TableroPort> {
  const [{ crearClienteDeServidor }, { PanelTableroSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/panel-tablero.supabase'),
  ]);
  return new PanelTableroSupabase(await crearClienteDeServidor());
}

/** Contexto del panel interno (quién, qué permisos, qué sedes) de ESTA petición. */
export async function panelRepository(): Promise<PanelPort> {
  const [{ crearClienteDeServidor }, { PanelSupabase }] = await Promise.all([
    import('../supabase/cliente-servidor'),
    import('../supabase/panel.supabase'),
  ]);
  return new PanelSupabase(await crearClienteDeServidor());
}
