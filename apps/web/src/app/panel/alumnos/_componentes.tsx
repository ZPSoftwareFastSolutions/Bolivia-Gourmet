/**
 * CAPA: Presentation / App — piezas de la sección Alumnos del panel.
 *
 * Vocabulario de pantalla (especificación §7.3): «grupos», «Carrera» (chip
 * azul) y «Capacitación» (chip de contorno vino, B.13 43). Server Components.
 */

import type { ReactNode } from 'react';
import {
  convocatoriaDelGrupo,
  describirPlan,
  ETIQUETA_DE_ESTADO_DE_COHORTE,
  type EstadoDeCohorte,
  type TipoDePrograma,
} from '@core/domain/academico/programa';
import { ETIQUETA_DE_ESTADO_DE_INSCRIPCION, type EstadoDeInscripcion, type Paquete } from '@core/domain/estudiantes/estudiante';
import type { EstadoDeSolicitudEnBandeja, GrupoEnLista, PrecioDeGrupo } from '@core/application/ports/alumnos.port';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_ALUMNOS } from '@/lib/rutas';
import { AreaDeTexto, CampoDeTexto } from '@/presentation/formularios/Campos';
import { Chip, Pestanas, type TonoDeChip } from '@/presentation/panel/Piezas';

export type Parametros = Promise<Record<string, string | string[] | undefined>>;

/** Primer valor de un parámetro de la URL, recortado. */
export function parametro(valores: Record<string, string | string[] | undefined>, nombre: string): string {
  const v = valores[nombre];
  return (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();
}

export const ETIQUETA_DE_PAQUETE: Record<Paquete, string> = { economico: 'Paquete Económico', ahorrador: 'Paquete Ahorrador' };

export function PestanasDeAlumnos({ activa, solicitudes }: { readonly activa: string; readonly solicitudes: number }) {
  return (
    <Pestanas
      etiqueta="Secciones de alumnos"
      activa={activa}
      pestanas={[
        { href: RUTAS_ALUMNOS.lista, etiqueta: 'Alumnos', icono: 'graduacion' },
        { href: RUTAS_ALUMNOS.solicitudes, etiqueta: 'Solicitudes', icono: 'documento', contador: solicitudes },
        { href: RUTAS_ALUMNOS.grupos, etiqueta: 'Grupos y cupos', icono: 'grupo' },
      ]}
    />
  );
}

export function ChipDePrograma({ tipo, nombre, anio }: { readonly tipo: TipoDePrograma | null; readonly nombre: string | null; readonly anio?: number | null }) {
  if (!tipo || !nombre) return <Chip tono="gris">Sin inscripción vigente</Chip>;
  if (tipo === 'carrera') {
    return (
      <Chip tono="azul" icono="graduacion">
        Carrera{anio ? ` · ${anio === 1 || anio === 3 ? `${anio}.er` : `${anio}.º`} año` : ''}
      </Chip>
    );
  }
  return (
    <Chip tono="vino" icono="gorro" contorno>
      Capacitación · {nombre}
    </Chip>
  );
}

const TONO_DE_INSCRIPCION: Record<EstadoDeInscripcion, TonoDeChip> = { inscrito: 'verde', retirado: 'rojo', concluido: 'gris' };

export function ChipDeInscripcion({ estado }: { readonly estado: EstadoDeInscripcion }) {
  return (
    <Chip tono={TONO_DE_INSCRIPCION[estado]} icono={estado === 'inscrito' ? 'check' : estado === 'retirado' ? 'salir' : 'medalla'}>
      {ETIQUETA_DE_ESTADO_DE_INSCRIPCION[estado]}
    </Chip>
  );
}

const TONO_DE_GRUPO: Record<EstadoDeCohorte, TonoDeChip> = { planificado: 'gris', abierto: 'verde', en_curso: 'azul', cerrado: 'gris' };

export function ChipDeGrupo({ estado }: { readonly estado: EstadoDeCohorte }) {
  return (
    <Chip tono={TONO_DE_GRUPO[estado]} contorno={estado === 'planificado' || estado === 'cerrado'}>
      {ETIQUETA_DE_ESTADO_DE_COHORTE[estado]}
    </Chip>
  );
}

/**
 * Si el grupo recibe solicitudes por el portal (ADR 0009 §6). Sin plazo no
 * se muestra nada: el grupo solo se inscribe en persona.
 */
export function ChipDeConvocatoria({ grupo, hoy }: { readonly grupo: GrupoEnLista; readonly hoy: string }) {
  const estado = convocatoriaDelGrupo(grupo, hoy);
  const desde = grupo.inscripcionDesde ? formatearDiaCorto(grupo.inscripcionDesde) : '';
  const hasta = grupo.inscripcionHasta ? formatearDiaCorto(grupo.inscripcionHasta) : '';
  switch (estado) {
    case 'abierta':
      return <Chip tono="verde" icono="calendario">{`Portal: inscripciones hasta el ${hasta}`}</Chip>;
    case 'por_abrir':
      return (
        <Chip tono="amarillo" icono="calendario">
          {grupo.estado === 'planificado' ? 'Portal: ábrelo para recibir solicitudes' : `Portal: abre el ${desde}`}
        </Chip>
      );
    case 'llena':
      return <Chip tono="rojo" icono="calendario">Portal: sin cupos</Chip>;
    case 'cerrada':
      return <Chip tono="gris" icono="calendario" contorno>Portal: inscripciones cerradas</Chip>;
    case 'sin_plazo':
      return null;
  }
}

/** «Bs 650 (Económico)» o «Consultar»: lo que recepción dice a quien pregunta. */
export function PrecioDelGrupo({ precios }: { readonly precios: readonly PrecioDeGrupo[] }) {
  if (precios.length === 0) return <span className="text-tinta-suave">Precio: Consultar</span>;
  return (
    <span className="grid gap-0.5">
      {precios.map((p) => (
        <span key={p.paquete ?? 'unico'} className="font-semibold text-estructural">
          {describirPlan(p)}
          {p.paquete ? <span className="font-normal text-tinta-suave"> · {ETIQUETA_DE_PAQUETE[p.paquete].replace('Paquete ', '')}</span> : null}
        </span>
      ))}
    </span>
  );
}

/** Campos de la ficha (alta, edición e inscripción de una persona nueva). */
export function CamposDeFicha({
  valores = {},
  completos = true,
}: {
  readonly valores?: Readonly<Record<string, string | null | undefined>>;
  /** Sin la fecha de nacimiento ni observaciones (inscripción rápida). */
  readonly completos?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <CampoDeTexto id="nombres" etiqueta="Nombres" autoComplete="off" maxLength={80} defaultValue={valores.nombres ?? ''} />
      <CampoDeTexto id="apellidos" etiqueta="Apellidos" autoComplete="off" maxLength={80} defaultValue={valores.apellidos ?? ''} />
      <CampoDeTexto
        id="documento"
        etiqueta="Carnet de identidad"
        opcional
        inputMode="text"
        maxLength={20}
        ayuda="Si ya hay alguien con este carnet, te lo diremos."
        defaultValue={valores.documento ?? ''}
      />
      <CampoDeTexto id="telefono" etiqueta="Celular" opcional inputMode="numeric" maxLength={8} ayuda="8 números, empieza por 6 o 7." defaultValue={valores.telefono ?? ''} />
      <CampoDeTexto id="correo" etiqueta="Correo" opcional type="email" maxLength={120} defaultValue={valores.correo ?? ''} />
      {completos ? (
        <>
          <CampoDeTexto id="fechaDeNacimiento" etiqueta="Fecha de nacimiento" opcional type="date" defaultValue={valores.fechaDeNacimiento ?? ''} />
          <div className="sm:col-span-2">
            <AreaDeTexto id="observaciones" etiqueta="Observaciones" opcional maxLength={500} defaultValue={valores.observaciones ?? ''} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Casillas de requisitos del programa (no bloquean, regla E4). */
export function CasillasDeRequisitos({
  requisitos,
  marcados = [],
}: {
  readonly requisitos: readonly { readonly descripcion: string; readonly detalle?: string }[];
  readonly marcados?: readonly string[];
}) {
  if (requisitos.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-1 font-semibold text-tinta">Requisitos entregados</legend>
      <p className="mb-2 text-sm text-tinta-suave">Marca lo que la persona ya trajo. Lo que falte se puede completar después.</p>
      <div className="grid gap-2">
        {requisitos.map((r) => (
          <label key={r.descripcion} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border-2 border-linea bg-tarjeta p-3 has-[:checked]:border-estructural">
            <input type="checkbox" name="requisito" value={r.descripcion} defaultChecked={marcados.includes(r.descripcion)} className="mt-1 size-5 flex-none accent-[var(--t-estructural)]" />
            <span>
              <span className="block font-semibold text-tinta">{r.descripcion}</span>
              {r.detalle ? <span className="text-sm text-tinta-suave">{r.detalle}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Fila de lista con enlace grande (toda la fila es la acción principal). */
export function FilaEnlazada({ children }: { readonly children: ReactNode }) {
  return <li className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta transition-colors hover:border-estructural">{children}</li>;
}

export const ETIQUETA_DE_ESTADO_DE_SOLICITUD: Record<EstadoDeSolicitudEnBandeja, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada por el alumno',
};

export const TONO_DE_SOLICITUD: Record<EstadoDeSolicitudEnBandeja, TonoDeChip> = {
  pendiente: 'amarillo',
  en_revision: 'azul',
  aprobada: 'verde',
  rechazada: 'rojo',
  cancelada: 'gris',
};
