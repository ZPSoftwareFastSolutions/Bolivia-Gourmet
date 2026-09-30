/**
 * CAPA: Infrastructure / Catálogo
 *
 * Validación del catálogo estático en el ARRANQUE (y por tanto en el build).
 * Sin base de datos ni panel, es la única red entre una errata en
 * `oferta-academica.ts` y lo que se publica: si el validador la deja pasar,
 * sale en la web. Por eso falla el build, no la página en producción.
 */

import { validarPrograma, type Programa } from '@core/domain/academico/programa';
import { esCelularBoliviano, type Sede } from '@core/domain/shared/sede';

export function validarCatalogo(programas: readonly Programa[], sedes: readonly Sede[]): readonly string[] {
  const errores: string[] = [];

  const codigos = programas.map((p) => p.codigo);
  for (const codigo of codigos) {
    if (codigos.filter((c) => c === codigo).length > 1) errores.push(`Código de programa repetido: "${codigo}".`);
  }
  for (const programa of programas) errores.push(...validarPrograma(programa));

  const codigosDeSede = sedes.map((s) => s.codigo);
  if (new Set(codigosDeSede).size !== codigosDeSede.length) errores.push('Hay sedes con el mismo código.');
  for (const sede of sedes) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sede.codigo)) errores.push(`Sede "${sede.nombre}": el código debe ser kebab-case.`);
    if (sede.nombre.trim().length === 0) errores.push('Hay una sede sin nombre.');
    if (sede.direccion.trim().length === 0) errores.push(`Sede "${sede.nombre}": la dirección es obligatoria.`);
    if (!esCelularBoliviano(sede.telefono)) errores.push(`Sede "${sede.nombre}": el teléfono "${sede.telefono}" no es un celular boliviano.`);
  }
  if (sedes.filter((s) => s.activa).length === 0) errores.push('Debe haber al menos una sede activa.');

  return [...new Set(errores)];
}

export function assertCatalogoValido(programas: readonly Programa[], sedes: readonly Sede[]): void {
  const errores = validarCatalogo(programas, sedes);
  if (errores.length > 0) {
    throw new Error(`El catálogo académico no es válido:\n- ${errores.join('\n- ')}`);
  }
}
