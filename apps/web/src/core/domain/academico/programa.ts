/**
 * CAPA: Domain / Académico
 *
 * La oferta académica y sus aperturas (ADR 0004):
 *
 *   Programa  → lo que se publica (la carrera o un curso) con sus OPCIONES
 *   Cohorte   → una apertura concreta: sede, fecha, UNA elección por opción,
 *               costo congelado
 *
 * Las «categorías» de estudiante (carrera/curso, turno, sede, gestión) se
 * derivan de la cohorte en la que está inscrito; no son atributos suyos.
 *
 * Sin React, sin Next, sin I/O.
 */

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

/** «Bs 650», «Bs 1.250,50» o «Consultar». Formato boliviano: punto de miles, coma decimal. */
export function formatearMonto(monto: Definido<Centavos>): string {
  if (esPendiente(monto)) return 'Consultar';
  const bolivianos = Math.floor(monto / 100);
  const centavos = monto % 100;
  const miles = String(bolivianos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return centavos === 0 ? `Bs ${miles}` : `Bs ${miles},${String(centavos).padStart(2, '0')}`;
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

// ---------------------------------------------------------------- Cohorte

export type EstadoDeCohorte = 'planificada' | 'abierta' | 'en_curso' | 'cerrada';

export interface Cohorte {
  readonly id: Id;
  readonly programaCodigo: string;
  readonly sedeId: Id;
  /** «Gastronomía · Febrero 2027 · Noche». */
  readonly nombre: string;
  readonly fechaInicio: FechaISO;
  readonly fechaFin?: FechaISO;
  /** Una de `programa.duracion.opciones`. */
  readonly duracionElegida: number;
  /** Obligatorio si el programa ofrece turnos. */
  readonly turno?: Turno;
  /** Código de una de `programa.diasDeClase`. */
  readonly diasDeClase: string;
  /** Obligatoria si el programa ofrece modalidades. */
  readonly modalidad?: Modalidad;
  /** Congelado al abrir la cohorte (regla A2). Puede estar pendiente. */
  readonly costoVigente: Definido<Centavos>;
  /** Solo carrera: 1, 2 o 3. */
  readonly anioDeCarrera?: number;
  readonly estado: EstadoDeCohorte;
  readonly capacidad?: number;
}

export type DatosDeCohorte = Omit<Cohorte, 'id'>;

/**
 * Regla A1: una cohorte solo elige entre las opciones de su programa.
 * Devuelve TODOS los errores, no el primero: quien rellena el formulario los
 * corrige de una vez.
 */
export function validarCohorte(
  programa: Programa,
  datos: DatosDeCohorte,
): Resultado<DatosDeCohorte, readonly string[]> {
  const errores: string[] = [];

  if (datos.programaCodigo !== programa.codigo) {
    errores.push(`La cohorte apunta al programa "${datos.programaCodigo}" pero se validó contra "${programa.codigo}".`);
  }
  if (!programa.activo) errores.push(`El programa "${programa.nombre}" está inactivo y no admite cohortes nuevas.`);
  if (datos.nombre.trim().length === 0) errores.push('El nombre de la cohorte es obligatorio.');

  const fecha = fechaISO(datos.fechaInicio);
  if (!fecha.exito) errores.push(fecha.error);
  if (datos.fechaFin) {
    const fin = fechaISO(datos.fechaFin);
    if (!fin.exito) errores.push(fin.error);
    else if (fecha.exito && fin.valor < fecha.valor) errores.push('La fecha de fin no puede ser anterior a la de inicio.');
  }

  if (esPendiente(programa.duracion)) {
    errores.push(`El programa "${programa.nombre}" no tiene duración definida; defínala antes de abrir cohortes.`);
  } else if (!programa.duracion.opciones.includes(datos.duracionElegida)) {
    errores.push(
      `La duración ${datos.duracionElegida} no está entre las opciones del programa (${enumerar(programa.duracion.opciones)}).`,
    );
  }

  if (programa.turnos.length > 0) {
    if (!datos.turno) errores.push(`El programa ofrece turnos (${enumerar(programa.turnos.map((t) => ETIQUETA_DE_TURNO[t]))}); elija uno.`);
    else if (!programa.turnos.includes(datos.turno)) errores.push(`El turno "${ETIQUETA_DE_TURNO[datos.turno]}" no lo ofrece el programa.`);
  } else if (datos.turno) {
    errores.push('El programa no distingue turnos; deje el turno vacío.');
  }

  if (programa.diasDeClase.length === 0) {
    errores.push(`El programa "${programa.nombre}" no tiene días de clase definidos.`);
  } else if (!programa.diasDeClase.some((d) => d.codigo === datos.diasDeClase)) {
    errores.push(`Los días "${datos.diasDeClase}" no están entre las opciones del programa.`);
  }

  if (programa.modalidades.length > 0) {
    if (!datos.modalidad) errores.push('El programa ofrece modalidades; elija una.');
    else if (!programa.modalidades.includes(datos.modalidad)) errores.push(`La modalidad "${datos.modalidad}" no la ofrece el programa.`);
  } else if (datos.modalidad) {
    errores.push('El programa no distingue modalidades; deje la modalidad vacía.');
  }

  if (programa.tipo === 'carrera') {
    const anios = esPendiente(programa.duracion) ? 0 : Math.max(...programa.duracion.opciones);
    if (datos.anioDeCarrera === undefined) errores.push('Una cohorte de carrera debe indicar el año (1, 2 o 3).');
    else if (!Number.isInteger(datos.anioDeCarrera) || datos.anioDeCarrera < 1 || datos.anioDeCarrera > anios) {
      errores.push(`El año de carrera debe estar entre 1 y ${anios}.`);
    }
  } else if (datos.anioDeCarrera !== undefined) {
    errores.push('Solo las cohortes de carrera llevan año de carrera.');
  }

  if (!esPendiente(datos.costoVigente) && (!Number.isInteger(datos.costoVigente) || datos.costoVigente < 0)) {
    errores.push('El costo vigente debe ser un importe en centavos no negativo.');
  }

  if (datos.capacidad !== undefined && (!Number.isInteger(datos.capacidad) || datos.capacidad <= 0)) {
    errores.push('La capacidad debe ser un entero positivo.');
  }

  return errores.length > 0 ? fallo(errores) : exito(datos);
}
