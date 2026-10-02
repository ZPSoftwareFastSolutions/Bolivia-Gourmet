/**
 * CAPA: Domain / Caja
 *
 * Cobro: dinero que entró, con su recibo (especificación §2.4, §3.8; D5).
 *
 * Un cobro se APLICA ENTERO a cargos del alumno (la suma aplicada es igual al
 * monto): sin anticipos. Si no se indican los cargos, se aplica del más
 * antiguo al más nuevo (`vence_el`, luego `registrado_en`), y la base lo exige
 * igual (B.12, crítica 21). Si se indican, se respeta lo indicado y solo se
 * exige que cada aplicación no supere lo pendiente del cargo.
 *
 * En QR y transferencia el número de operación del comprobante es
 * obligatorio y no se repite (por medio, sin distinguir mayúsculas).
 *
 * Sin React, sin Next, sin I/O.
 */

import { formatearMontoExacto } from '../shared/dinero';
import { exito, fallo, type Centavos, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';

export type MedioDePago = 'efectivo' | 'qr' | 'transferencia';

export const MEDIOS_DE_PAGO: readonly MedioDePago[] = ['efectivo', 'qr', 'transferencia'];

export const ETIQUETA_DE_MEDIO: Record<MedioDePago, string> = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
};

/** Medios que exigen el número de operación del comprobante. */
export const MEDIOS_CON_REFERENCIA: readonly MedioDePago[] = ['qr', 'transferencia'];

export function exigeReferencia(medio: MedioDePago): boolean {
  return MEDIOS_CON_REFERENCIA.includes(medio);
}

// ---------------------------------------------------------------- Errores

export type CodigoDeErrorDeCobro =
  | 'monto_invalido'
  | 'medio_invalido'
  | 'referencia_requerida'
  | 'referencia_repetida'
  | 'cobro_sin_aplicar'
  | 'aplicacion_excede_saldo'
  | 'aplicacion_repetida'
  | 'cargo_de_otro_alumno'
  | 'cargo_anulado'
  | 'nota_larga';

export interface ErrorDeCobro {
  readonly codigo: CodigoDeErrorDeCobro;
  readonly mensaje: string;
  readonly cargoId?: Id;
  /** Lo que se podía aplicar (al cargo, o en total). */
  readonly pendiente?: Centavos;
}

function esMontoPositivo(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor > 0;
}

// ---------------------------------------------------------------- Datos del cobro

export interface DatosDeCobro {
  readonly monto: Centavos;
  readonly medio: MedioDePago;
  readonly referencia?: string;
  readonly nota?: string;
}

/**
 * Forma del cobro: monto, medio, número de operación (obligatorio en QR y
 * transferencia; en efectivo no se guarda) y nota. Devuelve TODOS los errores.
 */
export function validarCobro(datos: DatosDeCobro): Resultado<DatosDeCobro, readonly ErrorDeCobro[]> {
  const errores: ErrorDeCobro[] = [];
  if (!esMontoPositivo(datos.monto)) errores.push({ codigo: 'monto_invalido', mensaje: 'El monto del cobro debe ser mayor que cero.' });

  const medioConocido = MEDIOS_DE_PAGO.includes(datos.medio);
  if (!medioConocido) errores.push({ codigo: 'medio_invalido', mensaje: 'Elige cómo pagó: efectivo, QR o transferencia.' });

  const referencia = datos.referencia?.trim() ?? '';
  if (medioConocido && exigeReferencia(datos.medio)) {
    if (referencia.length === 0) {
      errores.push({ codigo: 'referencia_requerida', mensaje: 'Escribe el número de operación que aparece en el comprobante.' });
    } else if (referencia.length > 60) {
      errores.push({ codigo: 'referencia_requerida', mensaje: 'El número de operación admite hasta 60 caracteres.' });
    }
  }

  const nota = datos.nota?.trim() ?? '';
  if (nota.length > 300) errores.push({ codigo: 'nota_larga', mensaje: 'La nota admite hasta 300 caracteres.' });

  if (errores.length > 0) return fallo(errores);
  return exito({
    monto: datos.monto,
    medio: datos.medio,
    referencia: exigeReferencia(datos.medio) ? referencia : undefined,
    nota: nota.length > 0 ? nota : undefined,
  });
}

/** Clave de unicidad del número de operación: `(medio, upper(referencia))`, como el índice único de la base. */
export function claveDeReferencia(medio: MedioDePago, referencia: string): string {
  return `${medio}:${referencia.trim().toUpperCase()}`;
}

/** `referencia_repetida`: ya hay un cobro vigente con ese número de operación en ese medio. */
export function esReferenciaRepetida(
  medio: MedioDePago,
  referencia: string,
  vigentes: readonly { readonly medio: MedioDePago; readonly referencia?: string }[],
): boolean {
  const clave = claveDeReferencia(medio, referencia);
  return vigentes.some((v) => v.referencia !== undefined && claveDeReferencia(v.medio, v.referencia) === clave);
}

// ---------------------------------------------------------------- Aplicación a cargos

export interface CargoPorCobrar {
  readonly id: Id;
  readonly estudianteId?: Id;
  readonly venceEl: FechaISO;
  /** Momento de registro: desempata dos cargos que vencen el mismo día. */
  readonly registradoEn: string;
  readonly monto: Centavos;
  /** Lo aplicado por cobros vigentes. */
  readonly aplicado: Centavos;
  readonly anulado: boolean;
}

export interface Aplicacion {
  readonly cargoId: Id;
  readonly monto: Centavos;
}

function pendienteDe(cargo: CargoPorCobrar): number {
  return cargo.anulado ? 0 : Math.max(0, cargo.monto - cargo.aplicado);
}

/** Del más antiguo al más nuevo: vencimiento, luego registro, luego id (orden total y estable). */
export function ordenDeAplicacion(a: CargoPorCobrar, b: CargoPorCobrar): number {
  if (a.venceEl !== b.venceEl) return a.venceEl < b.venceEl ? -1 : 1;
  if (a.registradoEn !== b.registradoEn) return a.registradoEn < b.registradoEn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Reparte un cobro entre los cargos del alumno (§3.8 `registrar_cobro`).
 *
 * - Sin `aplicaciones`: del más antiguo al más nuevo hasta agotar el monto.
 *   Si el monto supera lo que debe, `aplicacion_excede_saldo` (sin anticipos).
 * - Con `aplicaciones`: cada una a un cargo pendiente del mismo alumno y sin
 *   pasar su pendiente; la suma debe ser el monto (`cobro_sin_aplicar`).
 */
export function aplicarCobro(
  monto: Centavos,
  cargos: readonly CargoPorCobrar[],
  opciones: { readonly estudianteId?: Id; readonly aplicaciones?: readonly Aplicacion[] } = {},
): Resultado<readonly Aplicacion[], readonly ErrorDeCobro[]> {
  if (!esMontoPositivo(monto)) return fallo([{ codigo: 'monto_invalido', mensaje: 'El monto del cobro debe ser mayor que cero.' }]);

  const indicadas = opciones.aplicaciones ?? [];
  if (indicadas.length > 0) return aplicarIndicadas(monto, cargos, indicadas, opciones.estudianteId);

  const candidatos = cargos
    .filter((c) => opciones.estudianteId === undefined || c.estudianteId === opciones.estudianteId)
    .filter((c) => pendienteDe(c) > 0)
    .sort(ordenDeAplicacion);
  const totalPendiente = candidatos.reduce((t, c) => t + pendienteDe(c), 0);

  if (totalPendiente === 0) {
    return fallo([{ codigo: 'cobro_sin_aplicar', mensaje: 'No hay cargos pendientes: registra una venta directa.' }]);
  }
  if (monto > totalPendiente) {
    return fallo([
      {
        codigo: 'aplicacion_excede_saldo',
        mensaje: `Debe ${formatearMontoExacto(totalPendiente as Centavos)}; no se cobra más de lo que se debe.`,
        pendiente: totalPendiente as Centavos,
      },
    ]);
  }

  const aplicaciones: Aplicacion[] = [];
  let resto: number = monto;
  for (const cargo of candidatos) {
    if (resto === 0) break;
    const parte = Math.min(resto, pendienteDe(cargo));
    aplicaciones.push({ cargoId: cargo.id, monto: parte as Centavos });
    resto -= parte;
  }
  return exito(aplicaciones);
}

function aplicarIndicadas(
  monto: Centavos,
  cargos: readonly CargoPorCobrar[],
  indicadas: readonly Aplicacion[],
  estudianteId: Id | undefined,
): Resultado<readonly Aplicacion[], readonly ErrorDeCobro[]> {
  const errores: ErrorDeCobro[] = [];
  const vistos = new Set<Id>();
  let suma = 0;

  for (const aplicacion of indicadas) {
    const cargo = cargos.find((c) => c.id === aplicacion.cargoId);
    if (vistos.has(aplicacion.cargoId)) {
      errores.push({ codigo: 'aplicacion_repetida', mensaje: 'El mismo cargo aparece dos veces.', cargoId: aplicacion.cargoId });
      continue;
    }
    vistos.add(aplicacion.cargoId);

    if (!esMontoPositivo(aplicacion.monto)) {
      errores.push({ codigo: 'monto_invalido', mensaje: 'Cada monto aplicado debe ser mayor que cero.', cargoId: aplicacion.cargoId });
      continue;
    }
    suma += aplicacion.monto;

    if (!cargo || (estudianteId !== undefined && cargo.estudianteId !== estudianteId)) {
      errores.push({ codigo: 'cargo_de_otro_alumno', mensaje: 'Ese cargo no es de este alumno.', cargoId: aplicacion.cargoId });
      continue;
    }
    if (cargo.anulado) {
      errores.push({ codigo: 'cargo_anulado', mensaje: 'Ese cargo está anulado.', cargoId: cargo.id });
      continue;
    }
    const pendiente = pendienteDe(cargo);
    if (aplicacion.monto > pendiente) {
      errores.push({
        codigo: 'aplicacion_excede_saldo',
        mensaje: `A ese cargo le faltan ${formatearMontoExacto(pendiente as Centavos)}.`,
        cargoId: cargo.id,
        pendiente: pendiente as Centavos,
      });
    }
  }

  if (errores.length === 0 && suma !== monto) {
    errores.push({
      codigo: 'cobro_sin_aplicar',
      mensaje: `Lo aplicado (${formatearMontoExacto(suma as Centavos)}) debe ser igual al cobro (${formatearMontoExacto(monto)}).`,
    });
  }
  return errores.length > 0 ? fallo(errores) : exito(indicadas);
}

// ---------------------------------------------------------------- Recibo

/**
 * Número de recibo visible: prefijo de la sede (iniciales de su código:
 * `la-paz` → LP, `el-alto` → EA), año y correlativo sin huecos a 6 cifras:
 * «LP-2026-000123».
 */
export function formatearRecibo(codigoDeSede: string, anio: number, numero: number): string {
  const prefijo = codigoDeSede
    .split('-')
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return `${prefijo}-${anio}-${String(numero).padStart(6, '0')}`;
}
