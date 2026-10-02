/**
 * CAPA: Presentation / App — campos del formulario de grupo (abrir y editar).
 *
 * Solo se preguntan las opciones que el programa ofrece (regla A1, B.4): un
 * curso sin turnos no pregunta turno; uno de temporada no pregunta días ni
 * duración y pide la fecha de fin. Todo como tarjetas de radio grandes.
 */

import { ETIQUETA_DE_MODALIDAD, ETIQUETA_DE_TURNO, type Programa } from '@core/domain/academico/programa';
import { esPendiente } from '@core/domain/shared/tipos-base';
import type { SedeOperable } from '@core/domain/identidad/contexto-de-panel';
import { CampoDeTexto, GrupoDeOpciones } from '@/presentation/formularios/Campos';

export interface ValoresDeGrupo {
  readonly sedeId?: string;
  readonly gestion?: number;
  readonly anioDeCarrera?: number | null;
  readonly turno?: string | null;
  readonly dias?: string | null;
  readonly duracion?: number | null;
  readonly modalidad?: string | null;
  readonly fechaInicio?: string;
  readonly fechaFin?: string | null;
  readonly capacidad?: number | null;
  readonly estado?: string;
}

const ESTADOS = [
  { valor: 'planificado', etiqueta: 'Planificado', detalle: 'Aún no recibe inscripciones.' },
  { valor: 'abierto', etiqueta: 'Abierto', detalle: 'Recibe inscripciones.' },
  { valor: 'en_curso', etiqueta: 'En curso', detalle: 'Ya empezó; sigue recibiendo.' },
] as const;

export function CamposDeGrupo({
  programa,
  sedes,
  valores = {},
  conSede,
  gestionSugerida,
}: {
  readonly programa: Programa;
  readonly sedes: readonly SedeOperable[];
  readonly valores?: ValoresDeGrupo;
  /** Al abrir se elige la sede; al editar, no se cambia (tiene inscritos). */
  readonly conSede: boolean;
  readonly gestionSugerida: number;
}) {
  const duraciones = esPendiente(programa.duracion) ? [] : programa.duracion.opciones;
  const unidad = !esPendiente(programa.duracion) && programa.duracion.unidad === 'anios' ? 'años' : 'meses';
  const esCarrera = programa.tipo === 'carrera';
  const anios = esCarrera ? Math.max(1, ...duraciones) : 0;
  return (
    <>
      <input type="hidden" name="programa" value={programa.codigo} />
      {conSede ? (
        sedes.length > 1 ? (
          <GrupoDeOpciones nombre="sede" leyenda="Sede" valor={valores.sedeId ?? sedes[0]?.id} opciones={sedes.map((s) => ({ valor: s.id, etiqueta: s.nombre, detalle: s.zona }))} />
        ) : (
          <input type="hidden" name="sede" value={sedes[0]?.id ?? ''} />
        )
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <CampoDeTexto id="gestion" etiqueta="Gestión (año)" inputMode="numeric" maxLength={4} defaultValue={String(valores.gestion ?? gestionSugerida)} />
        <CampoDeTexto id="capacidad" etiqueta="Cupos" opcional inputMode="numeric" maxLength={3} ayuda="Vacío = sin límite." defaultValue={valores.capacidad ? String(valores.capacidad) : ''} />
      </div>

      {esCarrera ? (
        <GrupoDeOpciones
          nombre="anioDeCarrera"
          leyenda="Año de la carrera"
          columnas={3}
          valor={valores.anioDeCarrera ? String(valores.anioDeCarrera) : '1'}
          opciones={Array.from({ length: anios }, (_, i) => ({ valor: String(i + 1), etiqueta: i === 0 || i === 2 ? `${i + 1}.er año` : `${i + 1}.º año` }))}
        />
      ) : null}
      {programa.turnos.length > 0 ? (
        <GrupoDeOpciones
          nombre="turno"
          leyenda="Turno"
          columnas={programa.turnos.length > 2 ? 3 : 2}
          valor={valores.turno ?? undefined}
          opciones={programa.turnos.map((t) => ({ valor: t, etiqueta: ETIQUETA_DE_TURNO[t] }))}
        />
      ) : null}
      {programa.diasDeClase.length > 0 ? (
        <GrupoDeOpciones
          nombre="dias"
          leyenda="Días de clase"
          valor={valores.dias ?? (programa.diasDeClase.length === 1 ? programa.diasDeClase[0]?.codigo : undefined)}
          opciones={programa.diasDeClase.map((d) => ({ valor: d.codigo, etiqueta: d.etiqueta }))}
        />
      ) : null}
      {duraciones.length > 0 ? (
        <GrupoDeOpciones
          nombre="duracion"
          leyenda="Duración"
          columnas={3}
          valor={valores.duracion ? String(valores.duracion) : duraciones.length === 1 ? String(duraciones[0]) : undefined}
          opciones={duraciones.map((d) => ({ valor: String(d), etiqueta: `${d} ${d === 1 ? (unidad === 'años' ? 'año' : 'mes') : unidad}` }))}
        />
      ) : null}
      {programa.modalidades.length > 0 ? (
        <GrupoDeOpciones
          nombre="modalidad"
          leyenda="Modalidad"
          columnas={3}
          valor={valores.modalidad ?? undefined}
          opciones={programa.modalidades.map((m) => ({ valor: m, etiqueta: ETIQUETA_DE_MODALIDAD[m] }))}
        />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <CampoDeTexto id="fechaInicio" etiqueta="Empieza el" type="date" defaultValue={valores.fechaInicio ?? ''} />
        <CampoDeTexto
          id="fechaFin"
          etiqueta="Termina el"
          type="date"
          opcional={duraciones.length > 0}
          ayuda={duraciones.length > 0 ? 'Opcional si el programa tiene duración.' : 'Obligatoria: este programa no tiene duración fija.'}
          defaultValue={valores.fechaFin ?? ''}
        />
      </div>

      <GrupoDeOpciones nombre="estado" leyenda="Estado" columnas={3} valor={valores.estado ?? 'abierto'} opciones={[...ESTADOS]} />
    </>
  );
}
