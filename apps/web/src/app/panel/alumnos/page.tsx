/**
 * CAPA: Presentation / App — Alumnos (panel interno).
 *
 * Lo primero que se ve (especificación §7.5): buscador grande, filtros
 * Todos / Carrera / Capacitación / Sin inscripción, y por cada alumno sus
 * iniciales, nombre, código, programa actual y sede. Acción principal:
 * «Inscribir alumno». Búsqueda por formulario GET: funciona sin JavaScript y
 * la URL se puede compartir.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { FiltroDePrograma } from '@core/application/ports/alumnos.port';
import { alumnosRepository } from '@infra/config/composition-root';
import { RUTAS_ALUMNOS, RUTAS_PANEL, rutaDeAlumno } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, EncabezadoDePanel, EstadoVacio, Iniciales } from '@/presentation/panel/Piezas';
import { cn } from '@/lib/cn';
import { exigirPermiso, exigirPersonal } from '../_sesion';
import { ChipDePrograma, parametro, PestanasDeAlumnos, type Parametros } from './_componentes';

export const metadata: Metadata = { title: 'Alumnos' };

const FILTROS: readonly { readonly valor: FiltroDePrograma; readonly etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'carrera', etiqueta: 'Carrera' },
  { valor: 'capacitacion', etiqueta: 'Capacitación' },
  { valor: 'sin_inscripcion', etiqueta: 'Sin inscripción' },
];

function hrefConFiltro(q: string, programa: FiltroDePrograma): string {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (programa !== 'todos') p.set('programa', programa);
  const s = p.toString();
  return s ? `${RUTAS_ALUMNOS.lista}?${s}` : RUTAS_ALUMNOS.lista;
}

export default async function Alumnos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_PANEL.alumnos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'estudiantes.leer');

  const q = parametro(valores, 'q');
  const pedido = parametro(valores, 'programa') as FiltroDePrograma;
  const programa: FiltroDePrograma = FILTROS.some((f) => f.valor === pedido) ? pedido : 'todos';
  const repo = await alumnosRepository();
  const [lista, abiertas] = await Promise.all([repo.buscarAlumnos({ texto: q, programa }), repo.contarSolicitudesAbiertas()]);
  const puedeInscribir = tienePermiso(ctx, 'inscripciones.gestionar');

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Alumnos"
        descripcion="Busca una ficha, inscribe a alguien nuevo o renueva a quien ya estudia aquí."
        acciones={
          puedeInscribir ? (
            <Link href={RUTAS_ALUMNOS.inscribir} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion hover:bg-accion-fuerte">
              <Icono nombre="mas" tamano={20} />
              Inscribir alumno
            </Link>
          ) : null
        }
      />
      <PestanasDeAlumnos activa={RUTAS_ALUMNOS.lista} solicitudes={abiertas.exito ? abiertas.valor : 0} />

      <form role="search" action={RUTAS_ALUMNOS.lista} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        {programa !== 'todos' ? <input type="hidden" name="programa" value={programa} /> : null}
        <label htmlFor="q" className="sr-only">
          Buscar alumno
        </label>
        <span className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-tinta-suave">
            <Icono nombre="buscar" tamano={22} />
          </span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={60}
            placeholder="Busca por nombre, carnet o código"
            className="min-h-14 w-full rounded-md border-2 border-linea bg-tarjeta ps-12 pe-4 text-lg text-tinta focus:border-estructural focus:outline-none focus-visible:ring-4 focus-visible:ring-accion/50"
          />
        </span>
        <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-estructural px-6 font-bold text-sobre-estructural hover:bg-estructural-profundo">
          Buscar
        </button>
      </form>

      <nav aria-label="Filtrar alumnos" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={hrefConFiltro(q, f.valor)}
            aria-current={programa === f.valor ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border-2 px-4 font-semibold',
              programa === f.valor ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar la lista">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio
          frase={q ? 'Nadie con ese nombre' : '¡Todo listo para empezar!'}
          detalle={q ? 'Revisa cómo se escribe o busca por carnet. Si es alguien nuevo, inscríbelo.' : 'Cuando inscribas al primer alumno, aparecerá aquí.'}
          accion={
            puedeInscribir ? (
              <Link href={RUTAS_ALUMNOS.inscribir} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion">
                <Icono nombre="mas" tamano={20} />
                Inscribir alumno
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section aria-labelledby="resultado">
          <h2 id="resultado" className="sr-only">
            Resultado
          </h2>
          <p className="mb-3 text-sm text-tinta-suave">
            {lista.valor.length === 1 ? '1 alumno' : `${lista.valor.length} alumnos`}
            {lista.valor.length === 100 ? ' (se muestran los primeros 100; afina la búsqueda)' : ''}
          </p>
          <ul className="grid gap-3">
            {lista.valor.map((a) => (
              <li key={a.id}>
                <Link
                  href={rutaDeAlumno(a.codigo)}
                  className="mosaico flex flex-wrap items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 hover:border-estructural"
                >
                  <Iniciales nombres={a.nombres} apellidos={a.apellidos} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg leading-tight font-bold text-estructural">
                      {a.nombres} {a.apellidos}
                    </span>
                    <span className="mt-0.5 block text-sm text-tinta-suave">
                      {a.codigo}
                      {a.documento ? ` · CI ${a.documento}` : ''} · {a.sedeNombre}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <ChipDePrograma tipo={a.programaTipo} nombre={a.programaNombre} anio={a.anioDeCarrera} />
                    {a.inscripcionesVigentes > 1 ? <Chip tono="gris">+{a.inscripcionesVigentes - 1}</Chip> : null}
                    {a.conCuenta ? (
                      <Chip tono="gris" icono="usuario">
                        Portal
                      </Chip>
                    ) : null}
                  </span>
                  <Icono nombre="flecha" tamano={20} className="text-tinta-suave" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
