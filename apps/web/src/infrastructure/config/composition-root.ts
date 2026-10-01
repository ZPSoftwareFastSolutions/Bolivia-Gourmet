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

import type { AutenticacionPort } from '@core/application/ports/autenticacion.port';
import type { CatalogoAcademicoPort } from '@core/application/ports/catalogo-academico.port';
import type { InventarioRepositoryPort } from '@core/application/ports/inventario-repository.port';
import type { PortalRepositoryPort } from '@core/application/ports/portal-repository.port';
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

/**
 * Falla cerrado: el inventario pertenece al sistema interno (rama
 * `feat/sistema-interno`) y todavía no tiene tablas. Mejor que una pantalla
 * lo diga a que muestre un cero que parece un dato.
 */
export function inventarioRepository(): InventarioRepositoryPort {
  throw new Error(
    'El repositorio de inventario no está configurado: sus tablas llegan con el sistema interno (ver TASKS.md, fase 2).',
  );
}
