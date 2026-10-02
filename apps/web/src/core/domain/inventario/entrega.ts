/**
 * CAPA: Domain / Inventario
 *
 * Entrega de uniforme: qué juego salió del inventario, hacia qué INSCRIPCIÓN
 * (no hacia el alumno suelto: así se sabe para qué programa), cuándo, en qué
 * sede y BAJO QUÉ CONTEXTO (reglas I5–I7; especificación §2.5 y §3.6).
 *
 * Solo el uniforme se entrega; el utensilio se PRESTA (`prestamo.ts`). Una
 * entrega no se anula: se DEVUELVE (en parte o entera), y la devolución vuelve
 * al inventario al costo con que salió (`valorDeDevolucion`). El cambio de
 * talla es una devolución más una entrega nueva de otra talla del mismo
 * artículo, sin cargo.
 *
 * El contexto «sesión de clase» desapareció (P10: no hay sesiones en la v1).
 *
 * Sin React, sin Next, sin I/O.
 */

import { unidades } from '../shared/cantidad';
import { exito, fallo, fechaISO, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';
import { COMPORTAMIENTO_POR_TIPO, type Articulo } from './articulo';
import type { DatosDeMovimiento } from './movimiento';

export type ContextoDeEntrega = 'inscripcion' | 'reposicion' | 'cambio_de_talla' | 'otro';

export const ETIQUETA_DE_CONTEXTO: Record<ContextoDeEntrega, string> = {
  inscripcion: 'Al inscribirse',
  reposicion: 'Reposición',
  cambio_de_talla: 'Cambio de talla',
  otro: 'Otro',
};

export interface Entrega {
  readonly id: Id;
  readonly inscripcionId: Id;
  readonly sedeId: Id;
  readonly varianteId: Id;
  /** Piezas enteras: una chaqueta, dos pañoletas; nunca 1,5 delantales. */
  readonly cantidad: number;
  /** Lo ya devuelto; solo crece. */
  readonly devuelta: number;
  readonly contexto: ContextoDeEntrega;
  /** Obligatorio con el contexto «otro». */
  readonly detalle?: string;
  readonly fecha: FechaISO;
}

export type DatosDeEntrega = Omit<Entrega, 'id' | 'devuelta'>;

/** Lo que de esta entrega todavía está en manos del alumno. */
export function pendienteDeDevolver(entrega: Pick<Entrega, 'cantidad' | 'devuelta'>): number {
  return entrega.cantidad - entrega.devuelta;
}

export function validarEntrega(
  datos: DatosDeEntrega,
  articulo: Pick<Articulo, 'tipo' | 'nombre' | 'activo'>,
): Resultado<DatosDeEntrega, readonly string[]> {
  const errores: string[] = [];
  const comportamiento = COMPORTAMIENTO_POR_TIPO[articulo.tipo];

  if (!comportamiento.admiteEntrega) {
    errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no se entrega a los alumnos.`);
  }
  if (!articulo.activo) errores.push(`El artículo "${articulo.nombre}" está inactivo.`);

  if (!Number.isSafeInteger(datos.cantidad) || datos.cantidad <= 0) {
    errores.push('La cantidad entregada debe ser un entero mayor que cero.');
  }

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  if (!datos.inscripcionId) errores.push('La entrega debe apuntar a una inscripción.');
  if (!datos.varianteId) errores.push('Elige la talla.');

  if (!(datos.contexto in ETIQUETA_DE_CONTEXTO)) {
    errores.push(`Contexto de entrega desconocido: "${datos.contexto}".`);
  } else if (datos.contexto === 'otro' && !datos.detalle?.trim()) {
    errores.push('Una entrega con contexto «otro» debe explicar el detalle.');
  }

  return errores.length > 0 ? fallo(errores) : exito(datos);
}

/** Regla I5: toda entrega genera exactamente un movimiento `entrega` que la referencia. */
export function movimientoDeEntrega(entrega: Pick<Entrega, 'id' | 'sedeId' | 'varianteId' | 'cantidad' | 'fecha' | 'detalle'>): Resultado<DatosDeMovimiento> {
  const cantidad = unidades(entrega.cantidad);
  if (!cantidad.exito) return cantidad;
  return exito({
    varianteId: entrega.varianteId,
    sedeId: entrega.sedeId,
    tipo: 'entrega',
    cantidad: cantidad.valor,
    fecha: entrega.fecha,
    entregaId: entrega.id,
    detalle: entrega.detalle,
  });
}

export interface PedidoDeDevolucion {
  readonly cantidad: number;
  readonly motivo: string;
  readonly fecha: FechaISO;
  /** Cambio de talla: la variante nueva, que debe ser del mismo artículo. */
  readonly cambiarPor?: { readonly varianteId: Id; readonly articuloId: Id };
}

export interface DevolucionDeEntrega {
  readonly movimiento: DatosDeMovimiento;
  /** Solo en el cambio de talla: la entrega nueva, SIN cargo. */
  readonly nuevaEntrega?: DatosDeEntrega;
}

/**
 * Devolver (en parte o entera) o cambiar la talla (§3.6 `devolver_uniforme`).
 * El movimiento `devolucion_entrega` referencia la MISMA entrega; su valor lo
 * calcula `valorDeDevolucion` con lo que valía al salir.
 */
export function devolverEntrega(
  entrega: Entrega & { readonly articuloId: Id },
  pedido: PedidoDeDevolucion,
): Resultado<DevolucionDeEntrega, readonly string[]> {
  const errores: string[] = [];
  const pendiente = pendienteDeDevolver(entrega);

  if (!Number.isSafeInteger(pedido.cantidad) || pedido.cantidad <= 0) {
    errores.push('La cantidad devuelta debe ser un entero mayor que cero.');
  } else if (pedido.cantidad > pendiente) {
    errores.push(pendiente === 0 ? 'Esta entrega ya fue devuelta entera.' : `De esta entrega quedan ${pendiente} por devolver.`);
  }
  if (!pedido.motivo.trim()) errores.push('Indica por qué se devuelve.');

  const fecha = fechaISO(pedido.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  if (pedido.cambiarPor) {
    if (pedido.cambiarPor.varianteId === entrega.varianteId) errores.push('Elige una talla distinta de la entregada.');
    if (pedido.cambiarPor.articuloId !== entrega.articuloId) errores.push('El cambio de talla debe ser del mismo uniforme.');
  }

  const cantidad = unidades(pedido.cantidad);
  if (errores.length > 0 || !cantidad.exito) return fallo(errores);

  return exito({
    movimiento: {
      varianteId: entrega.varianteId,
      sedeId: entrega.sedeId,
      tipo: 'devolucion_entrega',
      cantidad: cantidad.valor,
      fecha: pedido.fecha,
      entregaId: entrega.id,
      detalle: pedido.motivo.trim(),
    },
    nuevaEntrega: pedido.cambiarPor
      ? {
          inscripcionId: entrega.inscripcionId,
          sedeId: entrega.sedeId,
          varianteId: pedido.cambiarPor.varianteId,
          cantidad: pedido.cantidad,
          contexto: 'cambio_de_talla',
          fecha: pedido.fecha,
        }
      : undefined,
  });
}
