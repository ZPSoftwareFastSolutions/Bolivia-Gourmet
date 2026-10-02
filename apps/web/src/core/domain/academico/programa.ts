/**
 * CAPA: Domain / Académico
 *
 * La oferta académica y sus aperturas (ADR 0004):
 *
 *   Programa     → lo que se publica (la carrera o un curso) con sus OPCIONES
 *   Cohorte      → una apertura concreta (en pantalla, «grupo»): sede,
 *                  gestión, fechas, UNA elección por opción y su estado
 *   PlanDePago   → cuánto y cuándo se cobra en un grupo; lo carga
 *                  administración y genera las cuotas de cada inscrito
 *
 * Las «categorías» de estudiante (carrera/curso, turno, sede, gestión) se
 * derivan del grupo en el que está inscrito; no son atributos suyos. El
 * precio ya no vive en el grupo: vive en su plan de pagos (D3) y se congela
 * con el primer cargo (A2, enmienda B.12).
 *
 * Sin React, sin Next, sin I/O.
 */

import { mesYAnio, sumarMeses } from '../shared/calendario';
import { formatearMonto } from '../shared/dinero';
import type { Sede } from '../shared/sede';
import {
  enumerar,
  esPendiente,
  exito,
  fallo,
  fechaISO,
  type Centavos,
  type Definido,
  type FechaISO,
  type Id,
  type Resultado,
} from '../shared/tipos-base';
import type { Paquete } from '../estudiantes/estudiante';

/** Vive en `shared/dinero.ts`; se reexporta para las páginas que lo importan de aquí. */
export { formatearMonto };

// ---------------------------------------------------------------- Enums

/** Abierto a nuevos tipos: añadir uno aquí y en `ETIQUETA_DE_TIPO`. */
export type TipoDePrograma = 'carrera' | 'curso' | 'curso_de_temporada';

export const ETIQUETA_DE_TIPO: Record<TipoDePrograma, string> = {
  carrera: 'Carrera técnica',
  curso: 'Curso',
  curso_de_temporada: 'Curso de temporada',
};

export type Turno = 'manana' | 'tarde' | 'noche' | 'especial' | 'unico';

export const ETIQUETA_DE_TURNO: Record<Turno, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
  especial: 'Horario especial',
  unico: 'Único turno',
};

export type Modalidad = 'practico' | 'magistral' | 'virtual';

export const ETIQUETA_DE_MODALIDAD: Record<Modalidad, string> = {
  practico: 'Curso práctico',
  magistral: 'Clase magistral',
  virtual: 'Virtual',
};

export type UnidadDeDuracion = 'anios' | 'meses';

// ---------------------------------------------------------------- Programa

export interface Duracion {
  readonly unidad: UnidadDeDuracion;
  /** Opciones que puede elegir una cohorte. Cocina: `[1, 2, 3]` meses. */
  readonly opciones: readonly number[];
}

/** Una opción de días de clase: `{ codigo: 'jue-vie', etiqueta: 'Semana (jueves y viernes)' }`. */
export interface OpcionDeDias {
  readonly codigo: string;
  readonly etiqueta: string;
}

export interface Requisito {
  readonly descripcion: string;
  readonly detalle?: string;
}

export interface MateriasDeAnio {
  readonly anio: number;
  readonly materias: readonly string[];
}

export interface BloqueDeContenido {
  readonly titulo: string;
  readonly temas: readonly string[];
}

/**
 * Precio publicado: una etiqueta y su importe. La carrera tiene dos paquetes y
 * cada uno puede conocerse por separado: el Económico tiene importe (Bs 650,
 * aclaración del 2026-10-01) y el Ahorrador sigue pendiente.
 */
export interface PrecioPublicado {
  readonly etiqueta: string;
  readonly monto: Definido<Centavos>;
  /** «por mes», «total», «por paquete»… Sin definir = la web no la inventa. */
  readonly periodicidad?: string;
}

export interface Programa {
  /** Slug estable: `gastronomia`, `cocina`, `tortas`… */
  readonly codigo: string;
  readonly tipo: TipoDePrograma;
  readonly nombre: string;
  readonly descripcion?: string;
  /** Solo carrera: «Técnico Superior en Gastronomía». */
  readonly tituloOtorgado?: string;
  readonly duracion: Definido<Duracion>;
  /** Vacío = pendiente de definir. */
  readonly diasDeClase: readonly OpcionDeDias[];
  /** Vacío = el programa no distingue turnos. */
  readonly turnos: readonly Turno[];
  /** Hora publicada de cada turno, si se conoce: `{ manana: '08:30' }`. */
  readonly horaPorTurno?: Partial<Record<Turno, string>>;
  /** Vacío = el programa no distingue modalidades. */
  readonly modalidades: readonly Modalidad[];
  /** Carrera: materias por año. */
  readonly planDeEstudios?: readonly MateriasDeAnio[];
  /** Cursos: módulos elegibles («Nacional», «Internacional», «Eventos»). */
  readonly modulos?: readonly string[];
  /** Cursos: bloques de contenido con sus temas. */
  readonly contenido?: readonly BloqueDeContenido[];
  readonly beneficios: readonly string[];
  readonly requisitos: readonly Requisito[];
  readonly notas: readonly string[];
  readonly costo: Definido<readonly PrecioPublicado[]>;
  readonly uniforme: Definido<PrecioPublicado>;
  /** Texto publicado de inicio («Febrero 2027») hasta que existan cohortes. */
  readonly inicioPublicado: Definido<string>;
  readonly activo: boolean;
}

/** «3 años», «1, 2 o 3 meses», «Consultar». */
export function describirDuracion(duracion: Definido<Duracion>): string {
  if (esPendiente(duracion)) return 'Consultar';
  const { unidad, opciones } = duracion;
  if (opciones.length === 0) return 'Consultar';
  const singular = unidad === 'anios' ? 'año' : 'mes';
  const plural = unidad === 'anios' ? 'años' : 'meses';
  const ultimo = opciones[opciones.length - 1] ?? 0;
  const palabra = opciones.length === 1 && ultimo === 1 ? singular : plural;
  return `${enumerar(opciones)} ${palabra}`;
}

/** Valida la coherencia interna de un programa (lo usa el validador del catálogo). */
export function validarPrograma(programa: Programa): readonly string[] {
  const errores: string[] = [];
  const donde = `Programa "${programa.codigo}"`;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(programa.codigo)) {
    errores.push(`${donde}: el código debe ser kebab-case.`);
  }
  if (programa.nombre.trim().length === 0) errores.push(`${donde}: el nombre es obligatorio.`);
  if (!(programa.tipo in ETIQUETA_DE_TIPO)) errores.push(`${donde}: tipo desconocido "${programa.tipo}".`);

  if (!esPendiente(programa.duracion)) {
    const { opciones } = programa.duracion;
    if (opciones.length === 0) errores.push(`${donde}: la duración definida no tiene opciones.`);
    if (opciones.some((n) => !Number.isInteger(n) || n <= 0)) {
      errores.push(`${donde}: las opciones de duración deben ser enteros positivos.`);
    }
    if (new Set(opciones).size !== opciones.length) {
      errores.push(`${donde}: hay opciones de duración repetidas.`);
    }
  }

  if (programa.tipo === 'carrera') {
    if (!programa.tituloOtorgado) errores.push(`${donde}: una carrera debe declarar el título otorgado.`);
    if (!programa.planDeEstudios || programa.planDeEstudios.length === 0) {
      errores.push(`${donde}: una carrera debe tener plan de estudios.`);
    }
  } else if (programa.planDeEstudios) {
    errores.push(`${donde}: solo la carrera tiene plan de estudios.`);
  }

  const codigosDeDias = programa.diasDeClase.map((d) => d.codigo);
  if (new Set(codigosDeDias).size !== codigosDeDias.length) {
    errores.push(`${donde}: hay opciones de días con el mismo código.`);
  }

  if (programa.horaPorTurno) {
    for (const turno of Object.keys(programa.horaPorTurno) as Turno[]) {
      if (!programa.turnos.includes(turno)) {
        errores.push(`${donde}: hay hora para el turno "${turno}" que el programa no ofrece.`);
      }
    }
  }

  if (!esPendiente(programa.costo)) {
    if (programa.costo.length === 0) {
      errores.push(`${donde}: el costo definido no tiene precios; use PENDIENTE si no se conoce.`);
    }
    for (const precio of programa.costo) errores.push(...validarPrecio(donde, precio));
  }
  if (!esPendiente(programa.uniforme)) errores.push(...validarPrecio(donde, programa.uniforme));

  return errores;
}

function validarPrecio(donde: string, precio: PrecioPublicado): readonly string[] {
  const errores: string[] = [];
  if (precio.etiqueta.trim().length === 0) errores.push(`${donde}: hay un precio sin etiqueta.`);
  if (!esPendiente(precio.monto) && (!Number.isInteger(precio.monto) || precio.monto <= 0)) {
    errores.push(`${donde}: el precio "${precio.etiqueta}" debe ser un entero positivo en centavos.`);
  }
  return errores;
}

// ---------------------------------------------------------------- Cohorte (grupo)

/**
 * B.2: `planificado` no admite inscripciones; `abierto` y `en_curso` sí;
 * `cerrado` no (y al cerrarse, sus inscritos pasan a `concluido`, B.3).
 */
export type EstadoDeCohorte = 'planificado' | 'abierto' | 'en_curso' | 'cerrado';

export const ESTADOS_DE_COHORTE: readonly EstadoDeCohorte[] = ['planificado', 'abierto', 'en_curso', 'cerrado'];

export const ETIQUETA_DE_ESTADO_DE_COHORTE: Record<EstadoDeCohorte, string> = {
  planificado: 'Planificado',
  abierto: 'Abierto',
  en_curso: 'En curso',
  cerrado: 'Cerrado',
};

const ESTADOS_QUE_ADMITEN_INSCRIPCION: readonly EstadoDeCohorte[] = ['abierto', 'en_curso'];

export function admiteInscripciones(estado: EstadoDeCohorte): boolean {
  return ESTADOS_QUE_ADMITEN_INSCRIPCION.includes(estado);
}

export interface Cohorte {
  readonly id: Id;
  readonly programaCodigo: string;
  readonly sedeId: Id;
  /** Año de la gestión (2026). */
  readonly gestion: number;
  /** Solo carrera: 1, 2 o 3. */
  readonly anioDeCarrera?: number;
  readonly fechaInicio: FechaISO;
  readonly fechaFin?: FechaISO;
  /** Una de `programa.duracion.opciones`; vacía si el programa no la define (temporada). */
  readonly duracionElegida?: number;
  /** Obligatorio si el programa ofrece turnos. */
  readonly turno?: Turno;
  /** Código de una de `programa.diasDeClase`; vacío si el programa no los define (temporada). */
  readonly diasDeClase?: string;
  /** Obligatoria si el programa ofrece modalidades. */
  readonly modalidad?: Modalidad;
  /** Sin capacidad = sin límite. */
  readonly capacidad?: number;
  readonly estado: EstadoDeCohorte;
}

export type DatosDeCohorte = Omit<Cohorte, 'id'>;

/**
 * Regla A1: un grupo solo elige entre las opciones de su programa. B.4: días
 * y duración son obligatorios solo si el programa los define; un curso de
 * temporada (sin días ni duración publicados) abre grupos con su modalidad y
 * sus fechas de inicio y fin. Devuelve TODOS los errores, no el primero: quien
 * rellena el formulario los corrige de una vez.
 */
export function validarCohorte(
  programa: Programa,
  datos: DatosDeCohorte,
): Resultado<DatosDeCohorte, readonly string[]> {
  const errores: string[] = [];

  if (datos.programaCodigo !== programa.codigo) {
    errores.push(`El grupo apunta al programa "${datos.programaCodigo}" pero se validó contra "${programa.codigo}".`);
  }
  if (!programa.activo) errores.push(`El programa "${programa.nombre}" está inactivo y no admite grupos nuevos.`);

  if (!Number.isInteger(datos.gestion) || datos.gestion < 2020 || datos.gestion > 2100) {
    errores.push('La gestión debe ser un año entre 2020 y 2100.');
  }
  if (!ESTADOS_DE_COHORTE.includes(datos.estado)) errores.push(`Estado de grupo desconocido: "${datos.estado}".`);

  const fecha = fechaISO(datos.fechaInicio);
  if (!fecha.exito) errores.push(fecha.error);
  if (datos.fechaFin) {
    const fin = fechaISO(datos.fechaFin);
    if (!fin.exito) errores.push(fin.error);
    else if (fecha.exito && fin.valor < fecha.valor) errores.push('La fecha de fin no puede ser anterior a la de inicio.');
  }

  if (!esPendiente(programa.duracion) && programa.duracion.opciones.length > 0) {
    if (datos.duracionElegida === undefined) {
      errores.push(`Elige la duración (${enumerar(programa.duracion.opciones)}).`);
    } else if (!programa.duracion.opciones.includes(datos.duracionElegida)) {
      errores.push(
        `La duración ${datos.duracionElegida} no está entre las opciones del programa (${enumerar(programa.duracion.opciones)}).`,
      );
    }
  } else {
    if (datos.duracionElegida !== undefined) errores.push('El programa no tiene duración definida; deja la duración vacía.');
    // Sin duración publicada, el grupo dice cuándo termina.
    if (!datos.fechaFin) errores.push('Un grupo sin duración definida debe indicar la fecha de fin.');
  }

  if (programa.turnos.length > 0) {
    if (!datos.turno) errores.push(`El programa ofrece turnos (${enumerar(programa.turnos.map((t) => ETIQUETA_DE_TURNO[t]))}); elige uno.`);
    else if (!programa.turnos.includes(datos.turno)) errores.push(`El turno "${ETIQUETA_DE_TURNO[datos.turno]}" no lo ofrece el programa.`);
  } else if (datos.turno) {
    errores.push('El programa no distingue turnos; deja el turno vacío.');
  }

  if (programa.diasDeClase.length > 0) {
    if (!datos.diasDeClase) errores.push('Elige los días de clase.');
    else if (!programa.diasDeClase.some((d) => d.codigo === datos.diasDeClase)) {
      errores.push(`Los días "${datos.diasDeClase}" no están entre las opciones del programa.`);
    }
  } else if (datos.diasDeClase) {
    errores.push('El programa no tiene días de clase definidos; deja los días vacíos.');
  }

  if (programa.modalidades.length > 0) {
    if (!datos.modalidad) errores.push('El programa ofrece modalidades; elige una.');
    else if (!programa.modalidades.includes(datos.modalidad)) errores.push(`La modalidad "${datos.modalidad}" no la ofrece el programa.`);
  } else if (datos.modalidad) {
    errores.push('El programa no distingue modalidades; deja la modalidad vacía.');
  }

  if (programa.tipo === 'carrera') {
    const anios = esPendiente(programa.duracion) ? 0 : Math.max(0, ...programa.duracion.opciones);
    if (datos.anioDeCarrera === undefined) errores.push('Un grupo de la carrera debe indicar el año (1, 2 o 3).');
    else if (!Number.isInteger(datos.anioDeCarrera) || datos.anioDeCarrera < 1 || datos.anioDeCarrera > anios) {
      errores.push(`El año de carrera debe estar entre 1 y ${anios}.`);
    }
  } else if (datos.anioDeCarrera !== undefined) {
    errores.push('Solo los grupos de la carrera llevan año de carrera.');
  }

  if (datos.capacidad !== undefined && (!Number.isInteger(datos.capacidad) || datos.capacidad <= 0)) {
    errores.push('La capacidad debe ser un entero positivo.');
  }

  return errores.length > 0 ? fallo(errores) : exito(datos);
}

// ---------------------------------------------------------------- Nombre del grupo

/** «1.er», «2.º», «3.er»: los ordinales que se leen en pantalla. */
export function ordinal(numero: number): string {
  return numero === 1 || numero === 3 ? `${numero}.er` : `${numero}.º`;
}

const DIA_COMPLETO: Record<string, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábados',
  dom: 'Domingos',
};

const DIA_ABREVIADO: Record<string, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
};

/**
 * Rótulo corto de los días a partir de su CÓDIGO (`sab` → «Sábados»,
 * `jue-vie` → «Jue–Vie», `lun-mie` → «Lun–Mié»). Sale del código y no de la
 * etiqueta del catálogo para que `app.nombre_de_grupo()` en la base, que solo
 * ve el código, arme el mismo nombre. Un código desconocido se muestra tal cual.
 */
export function etiquetaCortaDeDias(codigo: string): string {
  const [desde, hasta, ...resto] = codigo.split('-');
  if (desde === undefined || resto.length > 0) return codigo;
  if (hasta === undefined) return DIA_COMPLETO[desde] ?? codigo;
  const a = DIA_ABREVIADO[desde];
  const b = DIA_ABREVIADO[hasta];
  return a && b ? `${a}–${b}` : codigo;
}

/**
 * Nombre visible del grupo (§2.3). No se guarda: lo arma esta función y su
 * gemela de la base, `app.nombre_de_grupo()`, con las mismas reglas.
 *
 * - Carrera: programa · año · turno · gestión · sede
 *   («Gastronomía · 1.er año · Noche · 2026 · La Paz»).
 * - Cursos: programa · días · turno · modalidad · mes de inicio · sede, con
 *   solo las partes que el grupo tiene («Tortas · Sábados · oct 2026 · La Paz»).
 */
export function nombreDeGrupo(
  cohorte: Pick<Cohorte, 'gestion' | 'anioDeCarrera' | 'turno' | 'diasDeClase' | 'modalidad' | 'fechaInicio'>,
  programa: Pick<Programa, 'nombre' | 'tipo'>,
  sede: Pick<Sede, 'nombre'>,
): string {
  const turno = cohorte.turno ? ETIQUETA_DE_TURNO[cohorte.turno] : undefined;
  const partes =
    programa.tipo === 'carrera'
      ? [
          programa.nombre,
          cohorte.anioDeCarrera !== undefined ? `${ordinal(cohorte.anioDeCarrera)} año` : undefined,
          turno,
          String(cohorte.gestion),
          sede.nombre,
        ]
      : [
          programa.nombre,
          cohorte.diasDeClase ? etiquetaCortaDeDias(cohorte.diasDeClase) : undefined,
          turno,
          cohorte.modalidad ? ETIQUETA_DE_MODALIDAD[cohorte.modalidad] : undefined,
          mesYAnio(cohorte.fechaInicio),
          sede.nombre,
        ];
  return partes.filter((p): p is string => p !== undefined && p.length > 0).join(' · ');
}

// ---------------------------------------------------------------- Plan de pagos

/**
 * Cuánto y cuándo se cobra en un grupo (D3). Lo carga administración; sin
 * plan, el grupo no tiene precio («Consultar») y se inscribe sin cuotas. En la
 * carrera hay un plan por paquete. Los Bs 650 se cargan como dato del plan,
 * con su nota «Periodicidad por confirmar» (D4), nunca como regla del código.
 */
export interface PlanDePago {
  /** Solo en la carrera, y ahí obligatorio. */
  readonly paquete?: Paquete;
  readonly montoCuota: Centavos;
  /** De 1 a 24. */
  readonly cuotas: number;
  readonly primerVencimiento: FechaISO;
  /** De 1 a 12. */
  readonly cadaMeses: number;
  readonly nota?: string;
}

export function validarPlanDePago(plan: PlanDePago, tipoDePrograma: TipoDePrograma): Resultado<PlanDePago, readonly string[]> {
  const errores: string[] = [];
  if (!Number.isSafeInteger(plan.montoCuota) || plan.montoCuota <= 0) errores.push('El monto de la cuota debe ser mayor que cero.');
  if (!Number.isInteger(plan.cuotas) || plan.cuotas < 1 || plan.cuotas > 24) errores.push('El número de cuotas va de 1 a 24.');
  if (!Number.isInteger(plan.cadaMeses) || plan.cadaMeses < 1 || plan.cadaMeses > 12) errores.push('Cada cuántos meses va de 1 a 12.');
  const fecha = fechaISO(plan.primerVencimiento);
  if (!fecha.exito) errores.push(fecha.error);
  if (tipoDePrograma === 'carrera') {
    if (!plan.paquete) errores.push('En la carrera, el plan es de un paquete (económico o ahorrador).');
  } else if (plan.paquete) {
    errores.push('Solo la carrera tiene planes por paquete.');
  }
  const nota = plan.nota?.trim() ?? '';
  if (nota.length > 200) errores.push('La nota admite hasta 200 caracteres.');
  return errores.length > 0 ? fallo(errores) : exito({ ...plan, nota: nota.length > 0 ? nota : undefined });
}

/** Resumen del plan para la pantalla: «1 cuota de Bs 650», «3 cuotas de Bs 100 cada mes». */
export function describirPlan(plan: Pick<PlanDePago, 'montoCuota' | 'cuotas' | 'cadaMeses'>): string {
  const monto = formatearMonto(plan.montoCuota);
  if (plan.cuotas === 1) return `1 cuota de ${monto}`;
  const cada = plan.cadaMeses === 1 ? 'cada mes' : `cada ${plan.cadaMeses} meses`;
  return `${plan.cuotas} cuotas de ${monto} ${cada}`;
}

export interface Cuota {
  /** 1 a `de`; se conserva aunque se omitan las anteriores a `desde`. */
  readonly numero: number;
  readonly de: number;
  readonly monto: Centavos;
  /** `primer_vencimiento + (numero − 1) × cada_meses` meses (como PostgreSQL). */
  readonly venceEl: FechaISO;
  /** Mes en que cuenta como ingreso (§5.7). */
  readonly fecha: FechaISO;
}

/**
 * Las cuotas de una inscripción (§3.5 `app.generar_cuotas`): una por cuota,
 * cada una calculada desde el primer vencimiento (no encadenada), con el mes
 * de llegada recortado a su último día como hace PostgreSQL.
 *
 * `desde` (B.7, puesta en marcha): no genera las cuotas que vencen ANTES de
 * esa fecha, porque esos alumnos ya pagaban antes del sistema.
 *
 * `fecha` (mes en que cuenta el ingreso): §5.7 la pone en el mes del
 * vencimiento salvo que ese mes esté cerrado, y entonces en el de la
 * inscripción. La v1 no cierra meses (A.2), así que es siempre el
 * vencimiento; `fechaDeInscripcion` queda en la firma para cuando exista el
 * cierre (v1.1).
 */
export function generarCuotas(plan: PlanDePago, fechaDeInscripcion: FechaISO, desde?: FechaISO): readonly Cuota[] {
  void fechaDeInscripcion;
  const cuotas: Cuota[] = [];
  for (let numero = 1; numero <= plan.cuotas; numero += 1) {
    const venceEl = sumarMeses(plan.primerVencimiento, (numero - 1) * plan.cadaMeses);
    if (desde !== undefined && venceEl < desde) continue;
    cuotas.push({ numero, de: plan.cuotas, monto: plan.montoCuota, venceEl, fecha: venceEl });
  }
  return cuotas;
}
