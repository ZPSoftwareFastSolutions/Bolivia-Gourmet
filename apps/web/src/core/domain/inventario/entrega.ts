/**
 * CAPA: Domain / Inventario
 *
 * Entrega: qué artículo salió del inventario, hacia qué INSCRIPCIÓN (no hacia
 * el estudiante suelto: así se sabe para qué programa), cuándo, en qué sede,
 * quién la hizo y BAJO QUÉ CONTEXTO (ADR 0003, reglas I5–I7).
 *
 * El contexto es explícito porque el encargo relaciona entregas de uniforme
 * con sesiones de clase, pero pide NO asumir que todo estudiante recibe uno
 * en cada clase. Hasta que el cliente defina esa regla (P2), la sesión es un
 * contexto posible entre varios y el sistema registra sin decidir.
 *
 * Sin React, sin Next, sin I/O.
 */

import { exito, fallo, fechaISO, type FechaISO, type Id, type Resultado } from '../shared/tipos-base';
import { COMPORTAMIENTO_POR_TIPO, type Articulo } from './articulo';
import type { DatosDeMovimiento } from './movimiento';

export type ContextoDeEntrega =
  | { readonly tipo: 'inscripcion' }
  | { readonly tipo: 'sesion'; readonly sesionId: Id }
  | { readonly tipo: 'reposicion' }
  | { readonly tipo: 'otro'; readonly detalle: string };

export const ETIQUETA_DE_CONTEXTO: Record<ContextoDeEntrega['tipo'], string> = {
  inscripcion: 'Al inscribirse',
  sesion: 'En una sesión de clase',
  reposicion: 'Reposición',
  otro: 'Otro',
};

export type EstadoDeEntrega = 'entregado' | 'devuelto';

export interface Entrega {
  readonly id: Id;
  readonly inscripcionId: Id;
  readonly varianteId: Id;
  readonly cantidad: number;
  readonly fecha: FechaISO;
  readonly sedeId: Id;
  readonly responsableId: Id;
  readonly contexto: ContextoDeEntrega;
  readonly estado: EstadoDeEntrega;
  /** Si el artículo se cobra (uniforme), el pago que lo respalda. */
  readonly pagoId?: Id;
  readonly nota?: string;
}

export type DatosDeEntrega = Omit<Entrega, 'id' | 'estado'>;

export function validarEntrega(
  datos: DatosDeEntrega,
  articulo: Pick<Articulo, 'tipo' | 'nombre' | 'activo'>,
): Resultado<DatosDeEntrega, readonly string[]> {
  const errores: string[] = [];
  const comportamiento = COMPORTAMIENTO_POR_TIPO[articulo.tipo];

  if (!comportamiento.seEntregaAEstudiantes) {
    errores.push(`Un artículo de tipo "${comportamiento.etiqueta}" no se entrega a estudiantes.`);
  }
  if (!articulo.activo) errores.push(`El artículo "${articulo.nombre}" está inactivo.`);

  // Lo que se entrega a una persona se cuenta por piezas: una chaqueta, dos
  // pañoletas. Nunca 1,5 delantales.
  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    errores.push('La cantidad entregada debe ser un entero mayor que cero.');
  }

  const fecha = fechaISO(datos.fecha);
  if (!fecha.exito) errores.push(fecha.error);

  if (!datos.inscripcionId) errores.push('La entrega debe apuntar a una inscripción.');
  if (!datos.responsableId) errores.push('La entrega debe tener un responsable.');

  if (datos.contexto.tipo === 'sesion' && !datos.contexto.sesionId) {
    errores.push('Una entrega en sesión debe indicar la sesión.');
  }
  if (datos.contexto.tipo === 'otro' && datos.contexto.detalle.trim().length === 0) {
    errores.push('Una entrega con contexto «otro» debe explicar el detalle.');
  }

  return errores.length > 0 ? fallo(errores) : exito(datos);
}

/** Regla I5: toda entrega genera exactamente un movimiento `entrega` que la referencia. */
export function movimientoDeEntrega(entrega: Entrega): DatosDeMovimiento {
  return {
    varianteId: entrega.varianteId,
    sedeId: entrega.sedeId,
    tipo: 'entrega',
    cantidad: entrega.cantidad,
    fecha: entrega.fecha,
    responsableId: entrega.responsableId,
    referencia: { tipo: 'entrega', id: entrega.id },
    nota: entrega.nota,
  };
}

/** Regla I5: toda devolución genera exactamente un movimiento `devolucion` hacia la misma entrega. */
export function movimientoDeDevolucion(
  entrega: Entrega,
  fecha: FechaISO,
  responsableId: Id,
  motivo?: string,
): Resultado<DatosDeMovimiento> {
  if (entrega.estado === 'devuelto') return fallo('Esta entrega ya fue devuelta.');
  return exito({
    varianteId: entrega.varianteId,
    sedeId: entrega.sedeId,
    tipo: 'devolucion',
    cantidad: entrega.cantidad,
    fecha,
    responsableId,
    referencia: { tipo: 'entrega', id: entrega.id },
    motivo,
  });
}
