/**
 * CAPA: Presentation / App — página compartida de inscripción y renovación (ADR 0009).
 *
 * El recorrido que pidió el usuario (2026-10-05), sin JavaScript:
 *   1. Lo que la persona ya cursa (si cursa algo), con su horario: los grupos
 *      que se cruzan con él aparecen desactivados más abajo.
 *   2. Solo los programas con inscripciones abiertas hoy (la institución abre
 *      un grupo con un plazo). Si no hay ninguno, lo dice y ofrece la oferta
 *      completa de la web y el contacto.
 *   3. Al elegir uno (`?programa=`): una ficha corta del programa y sus grupos
 *      abiertos, cada uno con horario, fechas, plazo, cupos y precio.
 * La renovación es de la carrera: muestra directamente los grupos de 2.º y
 * 3.er año.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { describirDuracion, ETIQUETA_DE_TIPO, formatearMonto, ordinal, type Programa } from '@core/domain/academico/programa';
import type { Convocatoria } from '@core/application/portal/solicitudes.usecase';
import {
  cursosVigentes,
  disponibilidadDeGrupo,
  gestionAnteriorSugerida,
  programasEnConvocatoria,
  type GrupoDelPortal,
} from '@core/domain/portal/convocatoria';
import { alcanzoElLimite, ETIQUETA_DE_ESTADO, ETIQUETA_DE_PAQUETE, PAQUETES, solicitudAbiertaDe } from '@core/domain/portal/solicitud';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { RUTAS, rutaDePrograma } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { aspectoDePrograma } from '@/presentation/programas';
import { EnlaceBoton } from '@ui/Boton';
import { FormularioDeSolicitud, type OpcionDeGrupo, type OpcionesDeSolicitud } from './FormularioDeSolicitud';
import { cierreMasLejano, lineasDeGrupo } from './grupos';
import { TarjetaDeCurso } from './MisCursos';

function Paso({ numero, children }: { readonly numero: number; readonly children: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <span className="inline-grid size-8 flex-none place-items-center rounded-full bg-estructural text-sm text-sobre-estructural">{numero}</span>
      {children}
    </span>
  );
}

/** Los precios del catálogo para el paquete (el del grupo se muestra en cada grupo). */
function opcionesDePaquete(programa: Programa, tipo: 'inscripcion' | 'renovacion') {
  if (programa.tipo !== 'carrera' || tipo !== 'inscripcion') return [];
  const precios = esPendiente(programa.costo) ? [] : programa.costo;
  return PAQUETES.map((p) => {
    const precio = precios.find((pr) => pr.etiqueta === ETIQUETA_DE_PAQUETE[p]);
    return { valor: p, etiqueta: ETIQUETA_DE_PAQUETE[p], detalle: precio ? formatearMonto(precio.monto) : 'Consultar' };
  });
}

function opcionesDeGrupos(grupos: readonly GrupoDelPortal[], convocatoria: Convocatoria): readonly OpcionDeGrupo[] {
  return grupos.map((g) => {
    const disponibilidad = disponibilidadDeGrupo(g, convocatoria.tipo, convocatoria.misGrupos, convocatoria.solicitudes);
    return {
      valor: g.id,
      titulo: g.nombre,
      lineas: lineasDeGrupo(g),
      bloqueo: disponibilidad.estado === 'bloqueado' ? disponibilidad.motivo : undefined,
      aviso: disponibilidad.estado === 'disponible' ? disponibilidad.aviso : undefined,
    };
  });
}

/** Una ficha corta del programa: lo que se aprende y lo que se necesita. */
function Ficha({ programa, anios }: { readonly programa: Programa; readonly anios: readonly number[] }) {
  const materias = (programa.planDeEstudios ?? []).filter((a) => anios.includes(a.anio));
  const bloques = (programa.contenido ?? []).slice(0, 4);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tinta-suave">
        <span className="font-semibold text-tinta">{ETIQUETA_DE_TIPO[programa.tipo]}</span>
        <span>Duración: {describirDuracion(programa.duracion)}</span>
        {programa.tituloOtorgado ? <span>Título: {programa.tituloOtorgado}</span> : null}
      </div>
      {programa.descripcion ? <p className="text-tinta">{programa.descripcion}</p> : null}
      {materias.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {materias.map((a) => (
            <div key={a.anio}>
              <h4 className="t-etiqueta">Materias de {ordinal(a.anio)} año</h4>
              <p className="mt-1 text-sm text-tinta-suave">{a.materias.join(' · ')}</p>
            </div>
          ))}
        </div>
      ) : null}
      {bloques.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {bloques.map((b) => (
            <div key={b.titulo}>
              <h4 className="t-etiqueta">{b.titulo}</h4>
              <p className="mt-1 text-sm text-tinta-suave">{b.temas.join(' · ')}</p>
            </div>
          ))}
        </div>
      ) : null}
      {programa.beneficios.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {programa.beneficios.map((b) => (
            <li key={b} className="flex items-center gap-1.5 rounded-full bg-superficie-alterna px-3 py-1 text-sm font-semibold text-tinta">
              <Icono nombre="check" tamano={14} className="text-estructural" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      {programa.requisitos.length > 0 ? (
        <p className="text-sm text-tinta-suave">
          <span className="font-semibold text-tinta">Requisitos: </span>
          {programa.requisitos.map((r) => r.descripcion).join(' · ')}
        </p>
      ) : null}
      <Link href={rutaDePrograma(programa.codigo)} className="enlace inline-flex items-center gap-1 text-sm font-semibold">
        Ver la ficha completa del programa
        <Icono nombre="flecha" tamano={16} />
      </Link>
    </div>
  );
}

function SinConvocatorias({ tipo }: { readonly tipo: 'inscripcion' | 'renovacion' }) {
  return (
    <div className="rounded-[var(--t-radio-lg)] border-2 border-dashed border-linea bg-tarjeta p-8 text-center">
      <span className="mx-auto inline-grid size-14 place-items-center rounded-full bg-accion text-sobre-accion">
        <Icono nombre="calendario" tamano={28} />
      </span>
      <p className="mt-4 text-lg font-bold text-tinta">
        {tipo === 'renovacion' ? 'Por ahora no hay grupos abiertos para renovar' : 'Por ahora no hay inscripciones abiertas'}
      </p>
      <p className="mx-auto mt-1 max-w-prose text-tinta-suave">
        La institución abre cada grupo con un plazo de inscripción. Mientras tanto, mira toda la oferta o escríbenos y te avisamos cuando abra.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <EnlaceBoton href={tipo === 'renovacion' ? RUTAS.carrera : RUTAS.cursos} variante="contorno" icono="libro">
          {tipo === 'renovacion' ? 'Ver la carrera' : 'Ver toda la oferta'}
        </EnlaceBoton>
        <EnlaceBoton href={RUTAS.contacto} icono="whatsapp">
          Escríbenos
        </EnlaceBoton>
      </div>
    </div>
  );
}

export function PaginaDeSolicitud({
  convocatoria,
  programas,
  elegido,
}: {
  readonly convocatoria: Convocatoria;
  /** El catálogo (activos): de aquí salen el nombre, el ícono y la ficha. */
  readonly programas: readonly Programa[];
  readonly elegido: Programa | null;
}) {
  const { tipo } = convocatoria;
  const renovacion = tipo === 'renovacion';
  const ruta = renovacion ? RUTAS.renovacion : RUTAS.solicitud;
  const vigentes = cursosVigentes(convocatoria.misGrupos);
  const enConvocatoria = programasEnConvocatoria(convocatoria.grupos).flatMap((p) => {
    const programa = programas.find((x) => x.codigo === p.codigo && x.activo);
    return programa ? [{ programa, grupos: p.grupos }] : [];
  });
  const gruposDelElegido = elegido ? convocatoria.grupos.filter((g) => g.programaCodigo === elegido.codigo) : [];
  const abierta = elegido ? solicitudAbiertaDe(convocatoria.solicitudes, elegido.codigo, tipo) : undefined;
  const opciones: OpcionesDeSolicitud | null =
    elegido && gruposDelElegido.length > 0
      ? {
          tipo,
          programaCodigo: elegido.codigo,
          grupos: opcionesDeGrupos(gruposDelElegido, convocatoria),
          paquetes: opcionesDePaquete(elegido, tipo),
          gestionSugerida: renovacion ? gestionAnteriorSugerida(convocatoria.misGrupos) : undefined,
        }
      : null;
  const todosBloqueados = opciones !== null && opciones.grupos.every((g) => g.bloqueo);
  const anios = [...new Set(gruposDelElegido.map((g) => g.anioDeCarrera).filter((a): a is number => a !== undefined))];
  let numero = 0;

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
            {renovacion ? 'Renovar gestión' : 'Nueva inscripción'}
          </li>
        </ol>
      </nav>

      <header>
        <p className="t-etiqueta">{renovacion ? 'Antiguos alumnos' : 'Solicitud de inscripción'}</p>
        <h1 className="mt-2 text-estructural">
          <span className="t-script block text-3xl">{renovacion ? 'Sigue cocinando' : 'Elige tu camino'}</span>
          <span className="t-display block text-5xl">{renovacion ? 'Renueva tu gestión' : '¿Qué quieres estudiar?'}</span>
        </h1>
        <p className="mt-3 max-w-prose text-tinta-suave">
          Solo ves los grupos con inscripciones abiertas: la institución abre cada grupo con su horario y un plazo para inscribirse.
        </p>
      </header>

      {vigentes.length > 0 ? (
        <section aria-labelledby="ya-cursas" className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:p-8">
          <h2 id="ya-cursas" className="text-lg font-bold text-tinta">
            <Paso numero={++numero}>Lo que ya cursas</Paso>
          </h2>
          <p className="mt-2 text-sm text-tinta-suave">
            {renovacion
              ? 'Al renovar no se compara con tu propia carrera: pasas de un año al siguiente.'
              : 'Los grupos que se cruzan con tu horario aparecen desactivados, con el motivo.'}
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {vigentes.map((i) => (
              <li key={i.inscripcionId}>
                <TarjetaDeCurso inscripcion={i} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {enConvocatoria.length === 0 ? (
        <SinConvocatorias tipo={tipo} />
      ) : (
        <>
          {!renovacion ? (
            <section aria-labelledby="paso-programa" className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:p-8">
              <h2 id="paso-programa" className="text-lg font-bold text-tinta">
                <Paso numero={++numero}>Programas con inscripciones abiertas</Paso>
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {enConvocatoria.map(({ programa: p, grupos }) => {
                  const actual = elegido?.codigo === p.codigo;
                  const cierre = cierreMasLejano(grupos);
                  return (
                    <li key={p.codigo}>
                      <Link
                        href={`${ruta}?programa=${p.codigo}#ficha`}
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
                          <span className="block text-sm text-tinta-suave">
                            {grupos.length === 1 ? '1 grupo abierto' : `${grupos.length} grupos abiertos`}
                            {cierre ? ` · hasta el ${cierre}` : ''}
                          </span>
                        </span>
                        {actual ? <Icono nombre="check" className="ms-auto text-estructural" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {elegido ? (
            <section id="ficha" aria-labelledby="titulo-ficha" className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:p-8">
              <h2 id="titulo-ficha" className="text-lg font-bold text-tinta">
                <Paso numero={++numero}>{elegido.nombre}: ficha y grupos abiertos</Paso>
              </h2>
              <div className="mt-6 grid gap-8">
                <Ficha programa={elegido} anios={anios} />
                {gruposDelElegido.length === 0 ? (
                  <Aviso tono="info" titulo={`Las inscripciones de ${elegido.nombre} no están abiertas ahora`}>
                    <p>Elige otro programa de la lista o escríbenos para saber cuándo abre el próximo grupo.</p>
                  </Aviso>
                ) : abierta ? (
                  <Aviso tono="info" titulo={`Ya enviaste una solicitud de ${elegido.nombre}`}>
                    <p>
                      Está {ETIQUETA_DE_ESTADO[abierta.estado].toLowerCase()}. Puedes seguirla o cancelarla desde{' '}
                      <Link href={RUTAS.portal} className="enlace">
                        tu panel
                      </Link>
                      ; si la cancelas, podrás elegir otro grupo.
                    </p>
                  </Aviso>
                ) : alcanzoElLimite(convocatoria.solicitudes) ? (
                  <Aviso tono="info" titulo="Tienes demasiadas solicitudes en curso">
                    <p>Espera la respuesta de la institución o cancela alguna desde tu panel.</p>
                  </Aviso>
                ) : todosBloqueados && opciones ? (
                  <>
                    <Aviso tono="info" titulo="Ningún grupo abierto encaja contigo ahora">
                      <p>Revisa el motivo de cada grupo. Si crees que es un error, escríbenos.</p>
                    </Aviso>
                    <ul className="grid gap-3 opacity-80">
                      {opciones.grupos.map((g) => (
                        <li key={g.valor} className="rounded-md border-2 border-dashed border-linea p-4 text-sm">
                          <span className="block font-semibold text-tinta">{g.titulo}</span>
                          <span className="mt-1 flex items-start gap-1.5 font-semibold text-peligro">
                            <Icono nombre="alerta" tamano={16} className="mt-0.5 flex-none" />
                            {g.bloqueo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : opciones ? (
                  <FormularioDeSolicitud key={`${tipo}-${elegido.codigo}`} opciones={opciones} />
                ) : null}
              </div>
            </section>
          ) : (
            <p className="flex items-center gap-2 text-tinta-suave">
              <Icono nombre="info" className="text-estructural" />
              Elige un programa para ver su ficha y sus grupos abiertos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
