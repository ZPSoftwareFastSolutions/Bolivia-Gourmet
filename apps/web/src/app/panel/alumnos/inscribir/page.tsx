/**
 * CAPA: Presentation / App — «Inscribir alumno» en tres pasos (§6.9 y §6.10).
 *
 * 1. ¿Quién?  Buscar una ficha o «Es una persona nueva».
 * 2. ¿A qué grupo?  Pestañas Carrera / Capacitación con los grupos que
 *    reciben inscripciones en las sedes donde la persona puede operar: cupos y
 *    precio a la vista. Para renovar, solo el año siguiente del mismo programa.
 * 3. Revisa  Paquete (carrera), requisitos y «Inscribir».
 *
 * Cada paso es una URL (?alumno=, ?nuevo=1, ?grupo=, ?renueva=): se avanza y
 * se vuelve con enlaces, sin JavaScript, y nada se guarda hasta el último botón.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { describirPlan } from '@core/domain/academico/programa';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { FichaDeAlumno, GrupoEnLista } from '@core/application/ports/alumnos.port';
import type { Id } from '@core/domain/shared/tipos-base';
import { alumnosRepository, catalogoAcademico } from '@infra/config/composition-root';
import { formatearFecha } from '@/lib/fechas';
import { RUTAS_ALUMNOS, rutaDeAlumno } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { AreaDeTexto, Aviso, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { BarraDeCupos, EncabezadoDePanel, EstadoVacio, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { inscribirAccion } from '../actions';
import { CamposDeFicha, CasillasDeRequisitos, ChipDeGrupo, ETIQUETA_DE_PAQUETE, parametro, PrecioDelGrupo, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Inscribir alumno' };

function url(base: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${RUTAS_ALUMNOS.inscribir}?${s}` : RUTAS_ALUMNOS.inscribir;
}

function Pasos({ actual }: { readonly actual: 1 | 2 | 3 }) {
  const pasos = ['¿Quién?', '¿A qué grupo?', 'Revisa'];
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Pasos de la inscripción">
      {pasos.map((p, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        return (
          <li
            key={p}
            aria-current={n === actual ? 'step' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold',
              n === actual ? 'bg-estructural text-sobre-estructural' : n < actual ? 'bg-exito/12 text-exito' : 'bg-superficie-alterna text-tinta-suave',
            )}
          >
            {n < actual ? <Icono nombre="check" tamano={16} /> : <span aria-hidden="true">{n}</span>}
            <span>
              <span className="sr-only">Paso {n} de 3: </span>
              {p}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Persona({ ficha, cambiar }: { readonly ficha: FichaDeAlumno | null; readonly cambiar: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4">
      {ficha ? <Iniciales nombres={ficha.nombres} apellidos={ficha.apellidos} /> : <Icono nombre="usuario" tamano={28} className="text-estructural" />}
      <p className="min-w-0 flex-1">
        <span className="block font-bold text-estructural">{ficha ? `${ficha.nombres} ${ficha.apellidos}` : 'Persona nueva'}</span>
        <span className="text-sm text-tinta-suave">{ficha ? `${ficha.codigo} · ${ficha.sedeNombre}` : 'Sus datos se piden en el último paso.'}</span>
      </p>
      <Link href={cambiar} className="enlace inline-flex min-h-11 items-center text-sm">
        Cambiar
      </Link>
    </div>
  );
}

export default async function Inscribir({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_ALUMNOS.inscribir), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inscripciones.gestionar');

  const codigo = parametro(valores, 'alumno');
  const nuevo = parametro(valores, 'nuevo') === '1' && tienePermiso(ctx, 'estudiantes.gestionar');
  const grupoId = parametro(valores, 'grupo');
  const renueva = parametro(valores, 'renueva');
  const pestana = parametro(valores, 'tipo') === 'capacitacion' ? 'capacitacion' : 'carrera';
  const q = parametro(valores, 'q');
  const repo = await alumnosRepository();

  const ficha = codigo ? await repo.fichaDeAlumno(codigo) : null;
  if (ficha && !ficha.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir la ficha">
        <p>{ficha.error}</p>
      </Aviso>
    );
  }
  const alumno = ficha?.exito ? ficha.valor : null;
  const anterior = renueva && alumno ? (alumno.inscripciones.find((i) => i.id === renueva) ?? null) : null;
  const quien = alumno !== null || nuevo;

  // ------------------------------------------------------------ paso 1: ¿Quién?
  if (!quien) {
    const resultados = q ? await repo.buscarAlumnos({ texto: q }) : null;
    return (
      <div className="grid max-w-3xl gap-6">
        <EncabezadoDePanel titulo="Inscribir" resaltado="alumno" />
        <Pasos actual={1} />
        <form role="search" action={RUTAS_ALUMNOS.inscribir} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          {grupoId ? <input type="hidden" name="grupo" value={grupoId} /> : null}
          <label htmlFor="q" className="sr-only">
            Buscar alumno
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={60}
            autoFocus
            placeholder="Nombre, carnet o código de quien ya estudió aquí"
            className="min-h-14 w-full rounded-md border-2 border-linea bg-tarjeta px-4 text-lg focus:border-estructural focus:outline-none focus-visible:ring-4 focus-visible:ring-accion/50"
          />
          <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-estructural px-6 font-bold text-sobre-estructural">
            <Icono nombre="buscar" tamano={20} />
            Buscar
          </button>
        </form>

        {resultados && resultados.exito && resultados.valor.length > 0 ? (
          <ul className="grid gap-2">
            {resultados.valor.map((a) => (
              <li key={a.id}>
                <Link
                  href={url({ alumno: a.codigo, grupo: grupoId || undefined })}
                  className="mosaico flex items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 hover:border-estructural"
                >
                  <Iniciales nombres={a.nombres} apellidos={a.apellidos} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-estructural">
                      {a.nombres} {a.apellidos}
                    </span>
                    <span className="text-sm text-tinta-suave">
                      {a.codigo}
                      {a.documento ? ` · CI ${a.documento}` : ''} · {a.grupoNombre ?? 'Sin inscripción vigente'}
                    </span>
                  </span>
                  <span className="font-semibold text-estructural">Elegir</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : resultados ? (
          <p className="text-tinta-suave">{resultados.exito ? 'No encontramos a nadie con esos datos.' : resultados.error}</p>
        ) : null}

        {tienePermiso(ctx, 'estudiantes.gestionar') ? (
          <Link
            href={url({ nuevo: '1', grupo: grupoId || undefined })}
            className="mosaico flex min-h-24 items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-dashed border-estructural/40 bg-tarjeta p-4 hover:border-estructural"
          >
            <span className="inline-grid size-14 flex-none place-items-center rounded-full bg-accion text-sobre-accion">
              <Icono nombre="mas" tamano={26} />
            </span>
            <span>
              <span className="block text-lg font-bold text-estructural">Es una persona nueva</span>
              <span className="text-sm text-tinta-suave">Crearemos su ficha al inscribirla.</span>
            </span>
          </Link>
        ) : null}
      </div>
    );
  }

  const cambiarPersona = url({ grupo: grupoId || undefined });

  // ------------------------------------------------------------ paso 2: ¿A qué grupo?
  if (!grupoId) {
    const sedes = new Set(ctx.sedes.map((s) => s.id));
    const grupos = await repo.listarGrupos({ estados: ['abierto', 'en_curso'] });
    const enSusSedes = grupos.exito ? grupos.valor.filter((g) => sedes.has(g.sedeId)) : [];
    const candidatos: readonly GrupoEnLista[] = anterior
      ? enSusSedes.filter(
          (g) => g.programaCodigo === anterior.programaCodigo && g.anioDeCarrera === (anterior.anioDeCarrera ?? 0) + 1 && g.gestion === anterior.gestion + 1,
        )
      : enSusSedes.filter((g) => (pestana === 'carrera' ? g.programaTipo === 'carrera' : g.programaTipo !== 'carrera'));
    const base = { alumno: codigo || undefined, nuevo: nuevo ? '1' : undefined, renueva: renueva || undefined };

    return (
      <div className="grid gap-6">
        <EncabezadoDePanel titulo={anterior ? 'Renovar' : 'Inscribir'} resaltado={anterior ? 'al año siguiente' : 'alumno'} />
        <Pasos actual={2} />
        <Persona ficha={alumno} cambiar={cambiarPersona} />
        {anterior ? (
          <Aviso tono="info" titulo={`Viene de ${anterior.grupoNombre}`}>
            <p>Se muestran los grupos del año siguiente del mismo programa. La inscripción anterior sigue vigente hasta que se cierre su grupo.</p>
          </Aviso>
        ) : (
          <nav aria-label="Tipo de programa" className="flex gap-2">
            {(['carrera', 'capacitacion'] as const).map((t) => (
              <Link
                key={t}
                href={url({ ...base, tipo: t === 'capacitacion' ? t : undefined })}
                aria-current={pestana === t ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-5 font-semibold',
                  pestana === t
                    ? t === 'carrera'
                      ? 'border-estructural bg-estructural text-sobre-estructural'
                      : 'border-cursos bg-cursos text-sobre-cursos'
                    : 'border-linea bg-tarjeta text-tinta-suave',
                )}
              >
                <Icono nombre={t === 'carrera' ? 'graduacion' : 'gorro'} tamano={18} />
                {t === 'carrera' ? 'Carrera' : 'Capacitación'}
              </Link>
            ))}
          </nav>
        )}

        {!grupos.exito ? (
          <Aviso tono="error" titulo="No pudimos cargar los grupos">
            <p>{grupos.error}</p>
          </Aviso>
        ) : candidatos.length === 0 ? (
          <EstadoVacio
            frase="Aún no hay grupo"
            detalle={
              tienePermiso(ctx, 'cohortes.gestionar')
                ? 'No hay grupos abiertos para esto. Abre uno y vuelve a inscribir.'
                : 'No hay grupos abiertos para esto. Pide a administración que abra el grupo.'
            }
            accion={
              tienePermiso(ctx, 'cohortes.gestionar') ? (
                <Link href={RUTAS_ALUMNOS.grupoNuevo} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion">
                  <Icono nombre="mas" tamano={20} />
                  Abrir grupo
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {candidatos.map((g) => {
              const lleno = g.capacidad !== null && g.inscritos >= g.capacidad;
              return (
                <li key={g.id} className="grid gap-3 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg leading-tight font-bold text-estructural">{g.nombre}</p>
                    <ChipDeGrupo estado={g.estado} />
                  </div>
                  <p className="text-sm text-tinta-suave">
                    Empieza el {formatearFecha(`${g.fechaInicio}T12:00:00Z`)}
                    {g.duracion ? ` · ${g.duracion} ${g.programaTipo === 'carrera' ? 'años' : g.duracion === 1 ? 'mes' : 'meses'}` : ''}
                  </p>
                  <BarraDeCupos inscritos={g.inscritos} capacidad={g.capacidad} />
                  <PrecioDelGrupo precios={g.precios} />
                  {lleno ? (
                    <p className="font-semibold text-peligro">Sin cupos</p>
                  ) : (
                    <Link
                      href={url({ ...base, grupo: g.id })}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-estructural px-5 font-bold text-sobre-estructural hover:bg-estructural-profundo"
                    >
                      Elegir este grupo
                      <Icono nombre="flecha" tamano={18} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ paso 3: Revisa
  const ficha3 = await repo.fichaDeGrupo(grupoId as Id);
  if (!ficha3.exito || !ficha3.valor) {
    return (
      <Aviso tono="error" titulo="No encontramos ese grupo">
        <p>{ficha3.exito ? 'Vuelve a elegir el grupo.' : ficha3.error}</p>
        <Link href={url({ alumno: codigo || undefined, nuevo: nuevo ? '1' : undefined })} className="enlace mt-2 inline-flex min-h-11 items-center">
          Elegir otro grupo
        </Link>
      </Aviso>
    );
  }
  const g = ficha3.valor.grupo;
  const programa = await catalogoAcademico().programaPorCodigo(g.programaCodigo);
  const esCarrera = g.programaTipo === 'carrera';
  const yaInscrito = alumno?.inscripciones.some((i) => i.grupoId === g.id && i.estado === 'inscrito') ?? false;
  const precioDe = (paquete: 'economico' | 'ahorrador') => g.precios.find((p) => p.paquete === paquete);

  return (
    <div className="grid max-w-3xl gap-6">
      <EncabezadoDePanel titulo="Revisa y" resaltado="confirma" />
      <Pasos actual={3} />
      <Persona ficha={alumno} cambiar={cambiarPersona} />
      <div className="flex flex-wrap items-center gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4">
        <Icono nombre={esCarrera ? 'graduacion' : 'gorro'} tamano={28} className={esCarrera ? 'text-estructural' : 'text-cursos'} />
        <p className="min-w-0 flex-1">
          <span className="block font-bold text-estructural">{g.nombre}</span>
          <span className="text-sm text-tinta-suave">
            Empieza el {formatearFecha(`${g.fechaInicio}T12:00:00Z`)} · {g.capacidad === null ? 'sin límite de cupos' : `${Math.max(0, g.capacidad - g.inscritos)} cupos libres`}
          </span>
        </p>
        <Link href={url({ alumno: codigo || undefined, nuevo: nuevo ? '1' : undefined, renueva: renueva || undefined })} className="enlace inline-flex min-h-11 items-center text-sm">
          Cambiar
        </Link>
      </div>

      {yaInscrito ? (
        <Aviso tono="info" titulo="Ya está en este grupo">
          <p>
            Esta persona ya está inscrita aquí.{' '}
            <Link href={rutaDeAlumno(alumno?.codigo ?? '')} className="enlace">
              Ver su ficha
            </Link>
          </p>
        </Aviso>
      ) : (
        <FormularioDelPanel accion={inscribirAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="grupo" value={g.id} />
          <input type="hidden" name="esCarrera" value={esCarrera ? 'si' : 'no'} />
          {alumno ? <input type="hidden" name="alumno" value={alumno.id} /> : null}
          {anterior ? <input type="hidden" name="renueva" value={anterior.id} /> : null}

          {!alumno ? (
            <>
              <h2 className="t-etiqueta">Datos de la persona</h2>
              <CamposDeFicha completos={false} />
            </>
          ) : null}

          {esCarrera ? (
            <GrupoDeOpciones
              nombre="paquete"
              leyenda="Paquete"
              valor={anterior?.paquete ?? undefined}
              opciones={(['economico', 'ahorrador'] as const).map((p) => {
                const precio = precioDe(p);
                return { valor: p, etiqueta: ETIQUETA_DE_PAQUETE[p], detalle: precio ? describirPlan(precio) : 'Precio: Consultar' };
              })}
            />
          ) : (
            <p className="font-semibold text-estructural">
              <PrecioDelGrupo precios={g.precios} />
            </p>
          )}
          {g.precios.length === 0 ? <p className="text-sm text-tinta-suave">Este grupo aún no tiene precio: se inscribe sin cuotas y administración lo define después.</p> : null}

          <CasillasDeRequisitos requisitos={programa?.requisitos ?? []} />
          <AreaDeTexto id="observaciones" etiqueta="Observaciones" opcional maxLength={500} />

          <BotonGuardar icono="check" enviando="Inscribiendo…" className="justify-self-start">
            {anterior ? 'Renovar inscripción' : 'Inscribir'}
          </BotonGuardar>
        </FormularioDelPanel>
      )}
    </div>
  );
}
