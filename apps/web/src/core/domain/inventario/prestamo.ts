/**
 * CAPA: Domain / Inventario
 *
 * Préstamo de utensilios (especificación §2.5, §3.6, §5.5; D19).
 *
 * Prestar es CUSTODIA: el utensilio pasa de «en el estante» a «prestado», sigue
 * siendo del instituto y su valor no cambia. Lo que vuelve regresa al estante;
 * lo que no vuelve (se perdió o se rompió) es una BAJA desde lo prestado, a
 * costo promedio, y cuenta como pérdida del mes. Cobrar la reposición al
 * alumno es un cargo manual aparte.
 *
 * Una fila por utensilio; va a EXACTAMENTE UNO de: un alumno, un grupo (para
 * la clase) u otra persona (un docente, por nombre).
 *
 * Sin React, sin Next, sin I/O.
 */

import { diasEntre } from '../shared/calendario';
import { unidades } from '../shared/cantidad';
import { exito, fallo, fechaISO, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';
import { COMPORTAMIENTO_POR_TIPO, type Articulo } from './articulo';
import type { DatosDeMovimiento, MotivoDeBaja } from './movimiento';

export interface Prestamo {
  readonly id: Id;
  readonly sedeId: Id;
  readonly varianteId: Id;
  /** Piezas enteras. */
  readonly cantidad: number;
  readonly devuelta: number;
  readonly perdida: number;
  readonly estudianteId?: Id;
  readonly cohorteId?: Id;
  /** Un docente u otra persona, por nombre. */
  readonly persona?: string;
  readonly fecha: FechaISO;
  readonly devolverEl: FechaISO;
  /** Cuando ya no queda nada fuera. */
  readonly cerradoEn?: string;
}

export type DatosDePrestamo = Omit<Prestamo, 'id' | 'devuelta' | 'perdida' | 'cerradoEn'>;

/** Lo que sigue fuera. */
export function pendienteDePrestamo(prestamo: Pick<Prestamo, 'cantidad' | 'devuelta' | 'perdida'>): number {
  return prestamo.cantidad - prestamo.devuelta - prestamo.perdida;
}

export function estaAtrasado(prestamo: Pick<Prestamo, 'cantidad' | 'devuelta' | 'perdida' | 'devolverEl'>, hoy: FechaISO): boolean {
  return pendienteDePrestamo(prestamo) > 0 && prestamo.devolverEl < hoy;
}

/** Días de atraso (0 si no está atrasado). */
export function diasDeAtraso(prestamo: Pick<Prestamo, 'cantidad' | 'devuelta' | 'perdida' | 'devolverEl'>, hoy: FechaISO): number {
  return estaAtrasado(prestamo, hoy) ? diasEntre(prestamo.devolverEl, hoy) : 0;
}

export function validarPrestamo(
  datos: DatosDePrestamo,
  articulo: Pick<Articulo, 'tipo' | 'nombre' | 'activo'>,
): Resultado<DatosDePrestamo, readonly string[]> {
  const errores: string[] = [];
  const comportamiento = COMPORTAMIENTO_POR_TIPO[articulo.tipo];

  if (!comportamiento.admitePrestamo) errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no se presta.`);
  if (!articulo.activo) errores.push(`El artículo "${articulo.nombre}" está inactivo.`);

  if (!Number.isSafeInteger(datos.cantidad) || datos.cantidad <= 0) {
    errores.push('La cantidad prestada debe ser un entero mayor que cero.');
  }

  const persona = datos.persona?.trim() ?? '';
  const destinatarios = [datos.estudianteId, datos.cohorteId, persona.length > 0 ? persona : undefined].filter((d) => d !== undefined && d !== '');
  if (destinatarios.length === 0) errores.push('Indica a quién se presta: un alumno, un grupo u otra persona.');
  else if (destinatarios.length > 1) errores.push('Un préstamo va a una sola persona o grupo.');
  if (persona.length > 80) errores.push('El nombre de la persona admite hasta 80 caracteres.');

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);
  const devolver = fechaISO(datos.devolverEl);
  if (!devolver.exito) errores.push(devolver.error);
  else if (fecha.exito && devolver.valor < fecha.valor) errores.push('La fecha de devolución no puede ser anterior al préstamo.');

  if (errores.length > 0) return fallo(errores);
  return exito({ ...datos, persona: persona.length > 0 ? persona : undefined });
}

/** El movimiento `prestamo`: de disponible a prestado, sin cambio de valor. */
export function movimientoDePrestamo(prestamo: Pick<Prestamo, 'id' | 'sedeId' | 'varianteId' | 'cantidad' | 'fecha'>): Resultado<DatosDeMovimiento> {
  const cantidad = unidades(prestamo.cantidad);
  if (!cantidad.exito) return cantidad;
  return exito({
    varianteId: prestamo.varianteId,
    sedeId: prestamo.sedeId,
    tipo: 'prestamo',
    cantidad: cantidad.valor,
    fecha: prestamo.fecha,
    prestamoId: prestamo.id,
  });
}

export interface DevolucionDePrestamo {
  readonly devueltos: number;
  readonly perdidos: number;
  /** Obligatorio si hay perdidos: se perdió o se rompió. */
  readonly motivo?: Extract<MotivoDeBaja, 'perdida' | 'rotura'>;
  readonly detalle?: string;
  readonly fecha: FechaISO;
}

export interface RecepcionDePrestamo {
  /** `devolucion_prestamo` por lo que volvió y `baja` desde lo prestado por lo que no. */
  readonly movimientos: readonly DatosDeMovimiento[];
  readonly prestamo: Prestamo;
  readonly cerrado: boolean;
}

/**
 * Recibir un préstamo (§3.6 `recibir_devolucion`): lo que volvió regresa al
 * estante; lo que no, se da de baja desde lo prestado en el mismo acto. Si ya
 * no queda nada fuera, el préstamo se cierra.
 */
export function recibirPrestamo(prestamo: Prestamo, recibido: DevolucionDePrestamo): Resultado<RecepcionDePrestamo, readonly string[]> {
  const errores: string[] = [];
  const pendiente = pendienteDePrestamo(prestamo);

  if (prestamo.cerradoEn || pendiente === 0) errores.push('Este préstamo ya está cerrado.');

  const enteros = [recibido.devueltos, recibido.perdidos].every((n) => Number.isSafeInteger(n) && n >= 0);
  if (!enteros) errores.push('Las cantidades deben ser enteros no negativos.');
  else if (recibido.devueltos + recibido.perdidos === 0) errores.push('Indica cuántos volvieron o cuántos faltan.');
  else if (pendiente > 0 && recibido.devueltos + recibido.perdidos > pendiente) {
    errores.push(`De este préstamo quedan ${pendiente} fuera.`);
  }

  if (enteros && recibido.perdidos > 0) {
    if (recibido.motivo !== 'perdida' && recibido.motivo !== 'rotura') errores.push('Indica si se perdió o se rompió.');
    if (!recibido.detalle?.trim()) errores.push('Explica qué pasó con lo que no volvió.');
  }

  const fecha = fechaISO(recibido.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  const devueltos = unidades(recibido.devueltos);
  const perdidos = unidades(recibido.perdidos);
  if (errores.length > 0 || !devueltos.exito || !perdidos.exito) return fallo(errores);

  const base = { varianteId: prestamo.varianteId, sedeId: prestamo.sedeId, fecha: recibido.fecha, prestamoId: prestamo.id };
  const movimientos: DatosDeMovimiento[] = [];
  if (recibido.devueltos > 0) movimientos.push({ ...base, tipo: 'devolucion_prestamo', cantidad: devueltos.valor });
  if (recibido.perdidos > 0) {
    movimientos.push({
      ...base,
      tipo: 'baja',
      cantidad: perdidos.valor,
      motivoBaja: recibido.motivo,
      desdePrestado: true,
      detalle: recibido.detalle?.trim(),
    });
  }

  const actualizado: Prestamo = {
    ...prestamo,
    devuelta: prestamo.devuelta + recibido.devueltos,
    perdida: prestamo.perdida + recibido.perdidos,
  };
  return exito({ movimientos, prestamo: actualizado, cerrado: pendienteDePrestamo(actualizado) === 0 });
}
