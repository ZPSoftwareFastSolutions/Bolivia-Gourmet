/**
 * CAPA: Infrastructure / Catálogo
 *
 * Adaptador que implementa `CatalogoAcademicoPort` sobre el archivo estático.
 * Es `async` a propósito: la firma del puerto ya lo es, y sustituirlo por el
 * repositorio Supabase no obligará a cambiar ningún consumidor.
 */

import type { CatalogoAcademicoPort } from '@core/application/ports/catalogo-academico.port';
import type { Programa } from '@core/domain/academico/programa';
import type { Sede } from '@core/domain/shared/sede';
import { assertCatalogoValido } from './catalogo.validator';
import { PROGRAMAS, SEDES } from './oferta-academica';

export class CatalogoEstaticoRepository implements CatalogoAcademicoPort {
  private readonly porCodigo: ReadonlyMap<string, Programa>;
  private readonly programas: readonly Programa[];
  private readonly sedes: readonly Sede[];

  constructor(programas: readonly Programa[] = PROGRAMAS, sedes: readonly Sede[] = SEDES) {
    // Falla al construir, no en la petición 10 000: un catálogo inválido
    // impide el build en vez de degradar el sitio en producción.
    assertCatalogoValido(programas, sedes);
    this.programas = programas;
    this.sedes = sedes;
    this.porCodigo = new Map(programas.map((p) => [p.codigo, p]));
  }

  async listarProgramas(): Promise<readonly Programa[]> {
    return this.programas;
  }

  async programaPorCodigo(codigo: string): Promise<Programa | null> {
    return this.porCodigo.get(codigo.trim().toLowerCase()) ?? null;
  }

  async listarSedes(): Promise<readonly Sede[]> {
    return this.sedes;
  }
}
