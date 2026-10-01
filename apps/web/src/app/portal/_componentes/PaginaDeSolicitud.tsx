/**
 * CAPA: Presentation / App — página compartida de inscripción y renovación.
 *
 * Dos pasos sin JavaScript: (1) elegir el programa (enlaces `?programa=`);
 * (2) el formulario con SOLO las opciones de ese programa, sacadas del
 * catálogo. Así la carrera pregunta paquete y turno, y un curso sin turnos no
 * los pregunta.
 */

import Link from 'next/link';
import { describirDuracion, ETIQUETA_DE_TIPO, ETIQUETA_DE_TURNO, formatearMonto, type Programa } from '@core/domain/academico/programa';
import { ETIQUETA_DE_MODALIDAD, ETIQUETA_DE_PAQUETE, PAQUETES } from '@core/domain/portal/solicitud';
import type { Sede } from '@core/domain/shared/sede';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { Icono } from '@/presentation/icons/Icono';
import { aspectoDePrograma } from '@/presentation/programas';
import { FormularioDeSolicitud, type OpcionesDeSolicitud } from './FormularioDeSolicitud';

function opcionesDe(programa: Programa, sedes: readonly Sede[], tipo: 'inscripcion' | 'renovacion'): OpcionesDeSolicitud {
  const duracion = programa.duracion;
  const precios = esPendiente(programa.costo) ? [] : programa.costo;
  return {
    tipo,
    programaCodigo: programa.codigo,
    sedes: sedes.map((s) => ({ valor: s.codigo, etiqueta: `${s.nombre} · ${s.zona}`, detalle: s.direccion })),
    turnos: programa.turnos.map((t) => {
      const hora = programa.horaPorTurno?.[t];
      return { valor: t, etiqueta: ETIQUETA_DE_TURNO[t], detalle: hora && /^\d{2}:\d{2}$/.test(hora) ? `Desde las ${hora}` : hora };
    }),
    dias: programa.diasDeClase.map((d) => ({ valor: d.codigo, etiqueta: d.etiqueta })),
    // Con una sola opción (la carrera dura 3 años) no se pregunta.
    duraciones:
      !esPendiente(duracion) && duracion.opciones.length > 1
        ? duracion.opciones.map((n) => ({ valor: String(n), etiqueta: describirDuracion({ unidad: duracion.unidad, opciones: [n] }) }))
        : [],
    modalidades: programa.modalidades.map((m) => ({ valor: m, etiqueta: ETIQUETA_DE_MODALIDAD[m] })),
    paquetes:
      programa.tipo === 'carrera'
        ? PAQUETES.map((p) => {
            const precio = precios.find((pr) => pr.etiqueta === ETIQUETA_DE_PAQUETE[p]);
            return { valor: p, etiqueta: ETIQUETA_DE_PAQUETE[p], detalle: precio ? formatearMonto(precio.monto) : 'Consultar' };
          })
        : [],
  };
}

export function PaginaDeSolicitud({
  tipo,
  programas,
  sedes,
  elegido,
}: {
  readonly tipo: 'inscripcion' | 'renovacion';
  readonly programas: readonly Programa[];
  readonly sedes: readonly Sede[];
  readonly elegido: Programa | null;
}) {
  const ruta = tipo === 'renovacion' ? RUTAS.renovacion : RUTAS.solicitud;
  const activos = programas.filter((p) => p.activo);

  return (
    <div className="shell grid gap-8 py-10 lg:py-14">
      <nav aria-label="Migas de pan">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
          <li>
            <Link href={RUTAS.portal} className="enlace">
              Mi panel
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-semibold text-tinta">
            {tipo === 'renovacion' ? 'Renovar gestión' : 'Nueva inscripción'}
          </li>
        </ol>
      </nav>

      <header>
        <p className="t-etiqueta">{tipo === 'renovacion' ? 'Antiguos alumnos' : 'Solicitud de inscripción'}</p>
        <h1 className="mt-2 text-estructural">
          <span className="t-script block text-3xl">{tipo === 'renovacion' ? 'Sigue cocinando' : 'Elige tu camino'}</span>
          <span className="t-display block text-5xl">{tipo === 'renovacion' ? 'Renueva tu gestión' : '¿Qué quieres estudiar?'}</span>
        </h1>
      </header>

      <section aria-labelledby="paso-1" className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:p-8">
        <h2 id="paso-1" className="flex items-center gap-3 text-lg font-bold text-tinta">
          <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sm text-sobre-estructural">1</span>
          Programa
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activos.map((p) => {
            const actual = elegido?.codigo === p.codigo;
            return (
              <li key={p.codigo}>
                <Link
                  href={`${ruta}?programa=${p.codigo}#paso-2`}
                  aria-current={actual ? 'true' : undefined}
                  className={cn(
                    'flex min-h-16 items-center gap-3 rounded-md border-2 p-4 transition-colors duration-150',
                    actual ? 'border-estructural bg-superficie-alterna' : 'border-linea hover:border-estructural/40',
                  )}
                >
                  <span
                    className={cn(
                      'inline-grid size-11 flex-none place-items-center rounded-full',
                      p.tipo === 'carrera' ? 'bg-estructural text-sobre-estructural' : 'bg-cursos text-sobre-cursos',
                    )}
                  >
                    <Icono nombre={aspectoDePrograma(p.codigo).icono} tamano={22} />
                  </span>
                  <span>
                    <span className="block font-bold text-tinta">{p.nombre}</span>
                    <span className="text-sm text-tinta-suave">
                      {ETIQUETA_DE_TIPO[p.tipo]} · {describirDuracion(p.duracion)}
                    </span>
                  </span>
                  {actual ? <Icono nombre="check" className="ms-auto text-estructural" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {elegido ? (
        <section id="paso-2" aria-labelledby="titulo-paso-2" className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:p-8">
          <h2 id="titulo-paso-2" className="flex items-center gap-3 text-lg font-bold text-tinta">
            <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sm text-sobre-estructural">2</span>
            {elegido.nombre}: horario y sede
          </h2>
          <div className="mt-6">
            <FormularioDeSolicitud key={`${tipo}-${elegido.codigo}`} opciones={opcionesDe(elegido, sedes, tipo)} />
          </div>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-tinta-suave">
          <Icono nombre="info" className="text-estructural" />
          Elige un programa para ver sus horarios y opciones.
        </p>
      )}
    </div>
  );
}
