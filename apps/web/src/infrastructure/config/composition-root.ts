/**
 * CAPA: Infrastructure / Config
 *
 * COMPOSITION ROOT.
 *
 * Único lugar donde se decide qué implementación concreta satisface cada
 * puerto. Ninguna otra parte del código construye adaptadores: si una página
 * hiciera `new CatalogoEstaticoRepository()`, la inversión de dependencias
 * dejaría de existir.
 *
 * Hoy hay UN puerto satisfecho (el catálogo académico estático). Los
 * repositorios de datos (inventario, estudiantes, pagos) se añadirán aquí
 * cuando exista el proyecto Supabase, y se crearán POR PETICIÓN con el
 * cliente que lleva la cookie de quien pregunta: cachearlos serviría los
 * datos del primer usuario a todos.
 */

import type { CatalogoAcademicoPort } from '@core/application/ports/catalogo-academico.port';
import type { InventarioRepositoryPort } from '@core/application/ports/inventario-repository.port';
import { CatalogoEstaticoRepository } from '../catalogo/catalogo-estatico.repository';

let catalogoEnCache: CatalogoAcademicoPort | null = null;

/** Singleton de proceso: el catálogo es estático y no guarda estado por petición. */
export function catalogoAcademico(): CatalogoAcademicoPort {
  catalogoEnCache ??= new CatalogoEstaticoRepository();
  return catalogoEnCache;
}

/**
 * Falla cerrado: sin proyecto Supabase no hay inventario que consultar, y es
 * mejor que una pantalla lo diga a que muestre un cero que parece un dato.
 */
export function inventarioRepository(): InventarioRepositoryPort {
  throw new Error(
    'El repositorio de inventario no está configurado: falta el proyecto Supabase (ver TASKS.md, fase 1).',
  );
}
