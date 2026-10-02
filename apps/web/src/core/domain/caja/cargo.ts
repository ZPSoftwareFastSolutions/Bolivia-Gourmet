/**
 * CAPA: Domain / Caja
 *
 * Cargo: lo que el alumno DEBE (cuentas por cobrar; especificación §2.4).
 * Nace de una cuota del plan del grupo, de la entrega de un uniforme, de una
 * venta directa o a mano (reposición de un utensilio perdido, corrección).
 * Su `fecha` dice en qué mes cuenta como ingreso; su `venceEl`, desde cuándo
 * está vencido.
 *
 * Un cargo no se edita: se anula con motivo, y solo si no tiene cobros
 * vigentes aplicados. Lo pagado sale de sus aplicaciones (`cobro.ts`).
 *
 * Sin React, sin Next, sin I/O.
 */

import { diasEntre } from '../shared/calendario';
import { exito, fallo, fechaISO, type Centavos, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';

export type OrigenDeCargo = 'plan' | 'entrega' | 'venta_directa' | 'manual';

export const ETIQUETA_DE_ORIGEN: Record<OrigenDeCargo, string> = {
  plan: 'Cuota del plan',
  entrega: 'Entrega de uniforme',
  venta_directa: 'Venta directa',
  manual: 'Cargo manual',
};

export interface Cargo {
  readonly id: Id;
  /** El alumno que debe; o, en una venta a alguien de fuera, `cliente`. */
  readonly estudianteId?: Id;
  readonly cliente?: string;
  readonly inscripcionId?: Id;
  readonly conceptoId: Id;
  /** «Paquete Económico · Gastronomía 1.er año 2026», «Cuota 2 de 3 · Tortas oct 2026». */
  readonly descripcion: string;
  readonly monto: Centavos;
  /** Mes en que cuenta como ingreso (§5.7). */
  readonly fecha: FechaISO;
  /** Desde cuándo está vencido. */
  readonly venceEl: FechaISO;
  readonly sedeId: Id;
  readonly origen: OrigenDeCargo;
  readonly planId?: Id;
  readonly numeroDeCuota?: number;
  readonly entregaId?: Id;
  readonly prestamoId?: Id;
  /** Desempata el orden «del más antiguo al más nuevo» (B.12, crítica 21). */
  readonly registradoEn: string;
  readonly anuladoEl?: FechaISO;
}

export type DatosDeCargo = Omit<Cargo, 'id' | 'registradoEn' | 'anuladoEl'>;

export function validarCargo(datos: DatosDeCargo): Resultado<DatosDeCargo, readonly string[]> {
  const errores: string[] = [];

  const cliente = datos.cliente?.trim() ?? '';
  const tieneAlumno = Boolean(datos.estudianteId);
  if (tieneAlumno === cliente.length > 0) {
    errores.push(tieneAlumno ? 'Un cargo es de un alumno o de un cliente de fuera, no de los dos.' : 'Indica a quién se le carga: un alumno o un cliente.');
  }
  if (cliente.length > 80) errores.push('El nombre del cliente admite hasta 80 caracteres.');
  if (datos.inscripcionId && !tieneAlumno) errores.push('Un cargo de una inscripción debe ser de su alumno.');

  const descripcion = datos.descripcion.trim();
  if (descripcion.length === 0) errores.push('Describe el cargo.');
  else if (descripcion.length > 200) errores.push('La descripción admite hasta 200 caracteres.');

  if (!Number.isSafeInteger(datos.monto) || datos.monto <= 0) errores.push('El monto debe ser mayor que cero.');

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);
  const vence = fechaISO(datos.venceEl);
  if (!vence.exito) errores.push(vence.error);

  if (!(datos.origen in ETIQUETA_DE_ORIGEN)) errores.push(`Origen de cargo desconocido: "${datos.origen}".`);
  const esCuota = datos.origen === 'plan';
  if (esCuota && (!datos.planId || !datos.inscripcionId || !Number.isInteger(datos.numeroDeCuota) || (datos.numeroDeCuota ?? 0) < 1)) {
    errores.push('Una cuota indica su plan, su inscripción y su número.');
  }
  if (!esCuota && (datos.planId || datos.numeroDeCuota !== undefined)) errores.push('Solo una cuota del plan lleva plan y número de cuota.');
  if (datos.origen === 'entrega' && !datos.entregaId) errores.push('Un cargo por entrega indica la entrega.');

  if (errores.length > 0) return fallo(errores);
  return exito({ ...datos, descripcion, cliente: cliente.length > 0 ? cliente : undefined });
}

// ---------------------------------------------------------------- Saldo de un cargo

export type EstadoDeCargo = 'pendiente' | 'parcial' | 'pagado' | 'anulado';

export const ETIQUETA_DE_ESTADO_DE_CARGO: Record<EstadoDeCargo, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
  anulado: 'Anulado',
};

/**
 * `aplicado`: la suma de lo aplicado por cobros NO anulados (un cobro anulado
 * deja de contar y el cargo vuelve a quedar pendiente).
 */
export interface SaldoDeCargo {
  readonly monto: Centavos;
  readonly aplicado: Centavos;
  readonly venceEl: FechaISO;
  readonly anulado: boolean;
}

/** Lo que falta pagar (0 si está anulado o pagado). */
export function pendienteDeCargo(saldo: SaldoDeCargo): Centavos {
  if (saldo.anulado) return 0 as Centavos;
  return Math.max(0, saldo.monto - saldo.aplicado) as Centavos;
}

export function estadoDeCargo(saldo: SaldoDeCargo): EstadoDeCargo {
  if (saldo.anulado) return 'anulado';
  if (saldo.aplicado >= saldo.monto) return 'pagado';
  return saldo.aplicado > 0 ? 'parcial' : 'pendiente';
}

/** Vencido = le falta algo y `venceEl < hoy`. */
export function estaVencido(saldo: SaldoDeCargo, hoy: FechaISO): boolean {
  return pendienteDeCargo(saldo) > 0 && saldo.venceEl < hoy;
}

export function diasDeAtraso(saldo: SaldoDeCargo, hoy: FechaISO): number {
  return estaVencido(saldo, hoy) ? diasEntre(saldo.venceEl, hoy) : 0;
}

/**
 * Al retirar a un alumno (B.12, crítica 15) se anulan solas las cuotas del
 * plan SIN cobros que vencen DESPUÉS de hoy; las ya vencidas siguen debiéndose.
 */
export function cuotasQueSeAnulanAlRetirar<T extends SaldoDeCargo & { readonly origen: OrigenDeCargo }>(
  cargos: readonly T[],
  hoy: FechaISO,
): readonly T[] {
  return cargos.filter((c) => c.origen === 'plan' && !c.anulado && c.aplicado === 0 && c.venceEl > hoy);
}

/** Un cargo solo se anula sin cobros vigentes aplicados (§3.9, `cargo_con_cobros`). */
export function validarAnulacionDeCargo(saldo: SaldoDeCargo, motivo: string): Resultado<true, readonly string[]> {
  const errores: string[] = [];
  if (saldo.anulado) errores.push('Este cargo ya está anulado.');
  if (saldo.aplicado > 0) errores.push('El cargo tiene cobros: anula primero el cobro.');
  if (!motivo.trim()) errores.push('Indica el motivo de la anulación.');
  return errores.length > 0 ? fallo(errores) : exito(true);
}
