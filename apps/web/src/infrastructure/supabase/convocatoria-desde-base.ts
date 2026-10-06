/**
 * CAPA: Infrastructure / Supabase
 *
 * Lectura de lo que devuelven `oferta_abierta()` y `mis_grupos()` (jsonb,
 * ADR 0009) hacia la forma del dominio del portal. Funciones puras y sin
 * `server-only` para poder probarlas con `node --test`, igual que
 * `tablero-desde-base.ts`.
 *
 * Es defensiva a propósito: un grupo al que le falta el id, el nombre o la
 * fecha de inicio se descarta (no se puede pedir ni dibujar); los campos
 * opcionales que no tienen la forma esperada quedan sin valor. Así una
 * migración a medias no rompe el portal: como mucho, falta un grupo.
 */

import type { Modalidad, TipoDePrograma, Turno } from '@core/domain/academico/programa';
import type { Paquete } from '@core/domain/estudiantes/estudiante';
import type {
  EstadoDeInscripcionDelPortal,
  GrupoDelPortal,
  InscripcionDelPortal,
  MisGrupos,
  PrecioDeGrupo,
} from '@core/domain/portal/convocatoria';
import type { Centavos, Id } from '@core/domain/shared/tipos-base';

type Objeto = Readonly<Record<string, unknown>>;

const TIPOS: readonly TipoDePrograma[] = ['carrera', 'curso', 'curso_de_temporada'];
const TURNOS: readonly Turno[] = ['manana', 'tarde', 'noche', 'especial', 'unico'];
const MODALIDADES: readonly Modalidad[] = ['practico', 'magistral', 'virtual'];
const PAQUETES: readonly Paquete[] = ['economico', 'ahorrador'];
const ESTADOS: readonly EstadoDeInscripcionDelPortal[] = ['inscrito', 'concluido'];

function objeto(valor: unknown): Objeto | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Objeto) : null;
}

function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function textoONada(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : undefined;
}

function enteroONada(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : undefined;
}

/** `2026-10-24` (una fecha `date` de PostgreSQL en JSON). */
function fechaONada(valor: unknown): string | undefined {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : undefined;
}

/** `09:00` (la base las manda recortadas a horas y minutos). */
function horaONada(valor: unknown): string | undefined {
  return typeof valor === 'string' && /^\d{2}:\d{2}$/.test(valor) ? valor : undefined;
}

function deLista<T extends string>(valor: unknown, permitidos: readonly T[]): T | undefined {
  return typeof valor === 'string' && (permitidos as readonly string[]).includes(valor) ? (valor as T) : undefined;
}

function precioDesdeBase(valor: unknown): PrecioDeGrupo | null {
  const p = objeto(valor);
  const monto = enteroONada(p?.monto_cuota);
  const cuotas = enteroONada(p?.cuotas);
  if (!p || monto === undefined || monto <= 0 || cuotas === undefined || cuotas <= 0) return null;
  return {
    paquete: deLista(p.paquete, PAQUETES),
    montoCuota: monto as Centavos,
    cuotas,
    cadaMeses: enteroONada(p.cada_meses) ?? 1,
  };
}

/** Un grupo de `app.grupo_para_portal`; `null` si le falta lo indispensable. */
export function grupoDesdeBase(valor: unknown): GrupoDelPortal | null {
  const g = objeto(valor);
  if (!g) return null;
  const id = textoONada(g.id);
  const programaCodigo = textoONada(g.programa_codigo);
  const programaTipo = deLista(g.programa_tipo, TIPOS);
  const sedeId = textoONada(g.sede_id);
  const nombre = textoONada(g.nombre);
  const gestion = enteroONada(g.gestion);
  const fechaInicio = fechaONada(g.fecha_inicio);
  if (!id || !programaCodigo || !programaTipo || !sedeId || !nombre || gestion === undefined || !fechaInicio) return null;

  // Un horario a medias no sirve para el cruce: o las dos horas, o ninguna.
  const horaInicio = horaONada(g.hora_inicio);
  const horaFin = horaONada(g.hora_fin);
  const conHoras = horaInicio !== undefined && horaFin !== undefined && horaInicio < horaFin;
  const desde = fechaONada(g.inscripcion_desde);
  const hasta = fechaONada(g.inscripcion_hasta);
  const conPlazo = desde !== undefined && hasta !== undefined;

  return {
    id: id as Id,
    programaCodigo,
    programaNombre: textoONada(g.programa_nombre) ?? programaCodigo,
    programaTipo,
    sedeId: sedeId as Id,
    sedeNombre: textoONada(g.sede_nombre) ?? '—',
    nombre,
    gestion,
    anioDeCarrera: enteroONada(g.anio_de_carrera),
    turno: deLista(g.turno, TURNOS),
    dias: textoONada(g.dias),
    horaInicio: conHoras ? horaInicio : undefined,
    horaFin: conHoras ? horaFin : undefined,
    duracion: enteroONada(g.duracion),
    modalidad: deLista(g.modalidad, MODALIDADES),
    fechaInicio,
    fechaFin: fechaONada(g.fecha_fin),
    inscripcionDesde: conPlazo ? desde : undefined,
    inscripcionHasta: conPlazo ? hasta : undefined,
    capacidad: enteroONada(g.capacidad),
    libres: enteroONada(g.libres),
    precios: lista(g.precios)
      .map(precioDesdeBase)
      .filter((p): p is PrecioDeGrupo => p !== null),
  };
}

/** La lista de `oferta_abierta()`, sin los grupos ilegibles. */
export function gruposDesdeBase(valor: unknown): readonly GrupoDelPortal[] {
  return lista(valor)
    .map(grupoDesdeBase)
    .filter((g): g is GrupoDelPortal => g !== null);
}

function inscripcionDesdeBase(valor: unknown): InscripcionDelPortal | null {
  const i = objeto(valor);
  const inscripcionId = textoONada(i?.inscripcion_id);
  const estado = deLista(i?.estado, ESTADOS);
  const grupo = grupoDesdeBase(i?.grupo);
  if (!i || !inscripcionId || !estado || !grupo) return null;
  return { inscripcionId: inscripcionId as Id, estado, paquete: deLista(i.paquete, PAQUETES), grupo };
}

/** Lo que devuelve `mis_grupos()`. */
export function misGruposDesdeBase(valor: unknown): MisGrupos {
  const m = objeto(valor);
  return {
    inscripciones: lista(m?.inscripciones)
      .map(inscripcionDesdeBase)
      .filter((i): i is InscripcionDelPortal => i !== null),
    solicitudes: lista(m?.solicitudes).flatMap((valorSolicitud) => {
      const s = objeto(valorSolicitud);
      const solicitudId = textoONada(s?.solicitud_id);
      const grupo = grupoDesdeBase(s?.grupo);
      return solicitudId && grupo ? [{ solicitudId: solicitudId as Id, grupo }] : [];
    }),
  };
}
