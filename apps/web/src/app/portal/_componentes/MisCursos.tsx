/**
 * CAPA: Presentation / App — «Mis cursos» y «Mi horario» del estudiante (ADR 0009).
 *
 * Mis cursos: lo que la persona cursa hoy (inscripción vigente), con su sede,
 * horario y fechas. Mi horario: esos cursos en la semana, día por día y por
 * hora; en el teléfono cada día es una tarjeta (nada se desplaza de lado).
 * Lo que no tiene horario definido se lista aparte, sin inventarle una hora.
 */

import { horarioSemanal, NOMBRE_DEL_DIA } from '@core/domain/academico/horario';
import { horarioDelGrupo, type InscripcionDelPortal } from '@core/domain/portal/convocatoria';
import { Icono } from '@/presentation/icons/Icono';
import { aspectoDePrograma } from '@/presentation/programas';
import { Etiqueta } from '@ui/Marca';
import { fechasDeGrupo, horarioDeGrupo } from './grupos';

export function TarjetaDeCurso({ inscripcion }: { readonly inscripcion: InscripcionDelPortal }) {
  const { grupo } = inscripcion;
  const carrera = grupo.programaTipo === 'carrera';
  return (
    <article className="flex gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
      <span
        className={
          carrera
            ? 'inline-grid size-12 flex-none place-items-center rounded-full bg-estructural text-sobre-estructural'
            : 'inline-grid size-12 flex-none place-items-center rounded-full bg-cursos text-sobre-cursos'
        }
      >
        <Icono nombre={aspectoDePrograma(grupo.programaCodigo).icono} tamano={24} />
      </span>
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-tinta">{grupo.programaNombre}</h3>
          <Etiqueta tono={inscripcion.estado === 'inscrito' ? 'exito' : 'neutro'}>{inscripcion.estado === 'inscrito' ? 'Cursando' : 'Concluido'}</Etiqueta>
        </div>
        <p className="text-sm text-tinta-suave">{grupo.nombre}</p>
        <ul className="mt-1 grid gap-1 text-sm text-tinta">
          <li className="flex items-center gap-2">
            <Icono nombre="reloj" tamano={16} className="text-estructural" />
            {horarioDeGrupo(grupo)}
          </li>
          <li className="flex items-center gap-2">
            <Icono nombre="calendario" tamano={16} className="text-estructural" />
            {fechasDeGrupo(grupo)}
          </li>
          <li className="flex items-center gap-2">
            <Icono nombre="pin" tamano={16} className="text-estructural" />
            Sede {grupo.sedeNombre}
          </li>
        </ul>
      </div>
    </article>
  );
}

/** Mi horario: cada curso vigente en sus días, por hora. */
export function MiHorario({ cursos }: { readonly cursos: readonly InscripcionDelPortal[] }) {
  const semana = horarioSemanal(cursos, (c) => horarioDelGrupo(c.grupo));
  return (
    <section aria-labelledby="mi-horario" className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:p-8">
      <h2 id="mi-horario" className="flex items-center gap-2 text-xl font-bold text-estructural">
        <Icono nombre="calendario" />
        Mi horario
      </h2>
      {semana.dias.length > 0 ? (
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {semana.dias.map(({ dia, bloques }) => (
            <li key={dia} className="rounded-md border border-linea p-4">
              <h3 className="t-etiqueta">{NOMBRE_DEL_DIA[dia]}</h3>
              <ul className="mt-2 grid gap-2">
                {bloques.map((b) => (
                  <li key={`${b.elemento.inscripcionId}-${b.inicio}`} className="border-s-4 border-accion-fuerte ps-3">
                    <span className="block font-bold text-tinta">
                      {b.inicio}–{b.fin}
                    </span>
                    <span className="block text-sm text-tinta-suave">
                      {b.elemento.grupo.programaNombre} · {b.elemento.grupo.sedeNombre}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
      {semana.sinHora.length > 0 ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-tinta-suave">
          <Icono nombre="info" tamano={16} className="mt-0.5 flex-none text-estructural" />
          <span>
            Sin horario definido todavía: {semana.sinHora.map((c) => c.grupo.nombre).join(', ')}. Recepción te confirmará los días y las horas.
          </span>
        </p>
      ) : null}
    </section>
  );
}
