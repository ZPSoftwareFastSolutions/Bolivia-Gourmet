/**
 * CAPA: Infrastructure / Supabase
 *
 * Errores del panel interno en lenguaje simple (especificación §8.5).
 *
 * Las funciones del panel lanzan su error con el CÓDIGO como mensaje
 * (`^[a-z_]+$`) y los datos de la frase en `detail` (jsonb). Aquí cada código
 * se convierte en una frase que dice qué pasó y qué hacer, sin culpar y sin
 * vocabulario técnico. Lo que no está en el catálogo cae en la traducción
 * general de la base y, si tampoco, en el genérico. El código queda en el
 * registro del servidor; ningún texto de PostgreSQL llega a la pantalla.
 *
 * `tests/errores-de-panel.test.ts` exige que todo `message = '<codigo>'` de
 * las migraciones tenga su frase aquí, y que no sobren frases sin código.
 */

import { traducirErrorDeBase } from './errores';

interface ErrorDePostgrest {
  readonly code?: string | undefined;
  readonly message?: string | undefined;
  readonly details?: string | null | undefined;
}

export type Detalle = Readonly<Record<string, unknown>>;

/** Código → frase. Las frases que necesitan datos los leen del detalle. */
export const MENSAJES_DE_PANEL: Readonly<Record<string, (detalle: Detalle) => string>> = {
  // Comunes
  sin_permiso: () => 'Esta acción la hace administración. Si la necesitas, pídesela.',
  sede_no_operable: () => 'Solo puedes registrar operaciones en tu sede.',
  sede_no_asignada: () => 'Tu cuenta aún no tiene sede. Pide a administración que te la asigne.',
  datos_invalidos: () => 'Faltan datos o alguno no es válido. Revisa el formulario.',
  clave_reutilizada: () => 'Este formulario ya se usó para otra cosa. Vuelve a abrirlo y repite la operación.',

  // Alumnos y grupos (R2)
  alumno_no_encontrado: () => 'No encontramos a ese alumno. Búscalo otra vez.',
  alumno_archivado: () => 'La ficha de este alumno está archivada. Pide a administración que la reactive.',
  alumno_con_inscripcion: () => 'No se puede archivar: el alumno sigue inscrito. Primero retíralo o espera a que termine su grupo.',
  documento_duplicado: (d) =>
    `Ya hay un alumno con ese carnet${typeof d.nombre === 'string' ? `: ${d.nombre}` : ''}${typeof d.codigo === 'string' ? ` (${d.codigo})` : ''}. Búscalo y usa su ficha.`,
  ficha_con_cuenta: (d) =>
    `Esa ficha ya está unida a otra cuenta del portal${typeof d.codigo === 'string' ? ` (${d.codigo})` : ''}. Elige «Crear ficha nueva».`,
  grupo_no_encontrado: () => 'No encontramos ese grupo. Vuelve a la lista de grupos.',
  grupo_no_disponible: () => 'Ese grupo no recibe inscripciones ahora (está planificado o cerrado). Elige otro grupo.',
  grupo_lleno: (d) => `El grupo ya está lleno${typeof d.capacidad === 'number' ? ` (${d.capacidad} cupos)` : ''}. Elige otro grupo o pide a administración más cupos.`,
  grupo_cerrado: () => 'Ese grupo ya está cerrado y no se puede cambiar.',
  grupo_con_inscripciones: () => 'El grupo ya tiene alumnos: no se puede cambiar su programa, sede ni año.',
  grupo_no_corresponde: () => 'El grupo elegido es de otro programa que el que pidió el alumno.',
  usa_cerrar_grupo: () => 'Para cerrar un grupo usa el botón «Cerrar grupo»: así sus alumnos quedan como concluidos.',
  capacidad_menor_que_inscritos: (d) =>
    `El cupo no puede ser menor que los alumnos inscritos${typeof d.inscritos === 'number' ? ` (${d.inscritos})` : ''}.`,
  anio_de_carrera_invalido: () => 'Los grupos de la carrera llevan año (1.º, 2.º o 3.º); los cursos no.',
  programa_inactivo: () => 'Ese programa no está activo y no admite grupos nuevos.',
  paquete_requerido: () => 'En la carrera hay que elegir el paquete (Económico o Ahorrador).',
  paquete_no_admitido: () => 'Solo la carrera se inscribe por paquete; en los cursos déjalo vacío.',
  concepto_no_es_ingreso: () => 'Ese concepto no es de ingreso. Elige uno de cobro.',
  ya_inscrito: () => 'Este alumno ya está inscrito en ese grupo.',
  renovacion_no_corresponde: () => 'La renovación debe ser al año siguiente del mismo programa, y una sola vez.',
  inscripcion_no_encontrada: () => 'No encontramos esa inscripción. Vuelve a la ficha del alumno.',
  transicion_no_valida: () => 'Esa inscripción ya no está vigente: no se puede cambiar su estado.',
  motivo_requerido: () => 'Escribe el motivo: queda registrado.',
  solicitud_no_encontrada: () => 'No encontramos esa solicitud. Vuelve a la bandeja.',
  solicitud_cerrada: () => 'Esa solicitud ya fue atendida. Vuelve a la bandeja para ver las pendientes.',

  // Caja (R3)
  referencia_requerida: () => 'Escribe el número de operación que aparece en el comprobante del QR o de la transferencia.',
  referencia_repetida: (d) =>
    `Ese número de operación ya se registró${typeof d.recibo === 'string' ? ` en el recibo ${d.recibo}` : ''}. Revisa que no sea el mismo pago.`,
  cargo_de_otro_alumno: () => 'Uno de los cargos no es de este alumno. Vuelve a abrir su cuenta.',
  cargo_anulado: () => 'Uno de los cargos ya fue anulado. Vuelve a abrir la cuenta del alumno.',
  aplicacion_excede_saldo: (d) =>
    `No puedes cobrar más de lo que se debe${typeof d.pendiente === 'number' ? ` (Bs ${(d.pendiente / 100).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}.`,
  cobro_sin_aplicar: () => 'No hay nada que cobrar: elige al menos un cargo o registra una venta.',
  monto_invalido: () => 'Revisa el monto: debe ser mayor que cero.',
  concepto_no_es_gasto: () => 'Ese concepto no es de gasto. Elige uno de la lista.',
  detalle_requerido: () => 'Escribe qué es (al menos 3 letras).',
  fecha_invalida: () => 'Revisa la fecha: un gasto en efectivo es de hoy; por banco, hasta 30 días atrás.',
  inscripcion_de_otro_alumno: () => 'Esa inscripción no es de este alumno.',
  nada_que_arquear: () => 'No hay movimientos de dinero desde el último cierre.',
  observacion_requerida: () => 'La caja no cuadra: escribe qué pasó antes de cerrar.',
  retiro_excede: () => 'No puedes retirar más de lo que contaste.',
  saldo_inicial_no_admitido: () => 'El saldo inicial solo se escribe en el primer cierre de la sede.',
  documento_no_encontrado: () => 'No encontramos ese documento. Vuelve a la lista.',
  ya_anulado: () => 'Eso ya estaba anulado.',
  cargo_con_cobros: () => 'Este cargo ya tiene cobros. Anula primero el cobro.',
  sin_plan_de_pagos: () => 'Este grupo aún no tiene precio. Defínelo primero.',
  plan_congelado: () => 'Este precio ya tiene cuotas cargadas y no se puede cambiar. Si hace falta, anula las cuotas primero.',
  libro_inmutable: () => 'Ese registro no se puede cambiar: si algo quedó mal, anúlalo y regístralo de nuevo.',
};

const GENERICO = 'No pudimos guardar. Revisa tu conexión e inténtalo otra vez. Si se repite, avisa a administración.';

function leerDetalle(detalles: string | null | undefined): Detalle {
  if (!detalles) return {};
  try {
    const valor: unknown = JSON.parse(detalles);
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Detalle) : {};
  } catch {
    return {};
  }
}

/** Código propio del panel, si el error lo trae. */
export function codigoDelPanel(error: ErrorDePostgrest | null | undefined): string | null {
  const mensaje = error?.message?.trim() ?? '';
  return /^[a-z_]+$/.test(mensaje) && mensaje in MENSAJES_DE_PANEL ? mensaje : null;
}

export function traducirErrorDePanel(error: ErrorDePostgrest | null | undefined): string {
  if (!error) return GENERICO;
  const codigo = codigoDelPanel(error);
  if (codigo) {
    const frase = MENSAJES_DE_PANEL[codigo];
    if (frase) return frase(leerDetalle(error.details));
  }
  const base = traducirErrorDeBase(error);
  return base.startsWith('No pudimos completar') ? GENERICO : base;
}
