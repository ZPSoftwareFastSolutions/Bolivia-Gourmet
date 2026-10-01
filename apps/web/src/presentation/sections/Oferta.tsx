/**
 * CAPA: Presentation / Sections
 *
 * Oferta académica: la carrera destacada (bloque azul, folleto A) y las
 * tarjetas de cursos (rojo vino, folleto B). Reciben programas ya resueltos
 * del catálogo; no deciden nada. Lo pendiente se muestra como «Consultar»,
 * nunca con un valor inventado.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  describirDuracion,
  ETIQUETA_DE_TIPO,
  ETIQUETA_DE_TURNO,
  formatearMonto,
  type Programa,
} from '@core/domain/academico/programa';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { RUTAS, rutaDePrograma } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { Icono, type NombreDeIcono } from '../icons/Icono';
import { aspectoDePrograma } from '../programas';
import { EnlaceBoton } from '../ui/Boton';
import { Foto } from '../ui/Foto';
import { Etiqueta, Insignia, ListaConCheck, TituloDeSeccion } from '../ui/Marca';

export function textoDeDias(programa: Programa): string {
  return programa.diasDeClase.length > 0 ? programa.diasDeClase.map((d) => d.etiqueta).join(' · ') : 'Consultar';
}

export function textoDeTurnos(programa: Programa): string | null {
  if (programa.turnos.length === 0) return null;
  return programa.turnos
    .map((t) => {
      const hora = programa.horaPorTurno?.[t];
      return hora && /^\d{2}:\d{2}$/.test(hora) ? `${ETIQUETA_DE_TURNO[t]} ${hora}` : ETIQUETA_DE_TURNO[t];
    })
    .join(' · ');
}

// ---------------------------------------------------------------- Ficha (cajas del folleto)

export interface DatoDeFicha {
  readonly icono: NombreDeIcono;
  readonly titulo: string;
  readonly valor: ReactNode;
}

/**
 * Las cajas de la ficha de inscripción del folleto: insignia circular,
 * rótulo y valor. `tono="cursos"` para la línea de cursos.
 */
export function Ficha({ datos, tono = 'marca' }: { readonly datos: readonly DatoDeFicha[]; readonly tono?: 'marca' | 'cursos' }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {datos.map((dato) => (
        <div key={dato.titulo} className="flex gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-5">
          <Insignia icono={dato.icono} tono={tono === 'cursos' ? 'vino' : 'azul'} tamano="sm" />
          <div>
            <dt className="t-etiqueta">{dato.titulo}</dt>
            <dd className="mt-1 font-semibold text-tinta">{dato.valor}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- Carrera destacada

export function CarreraDestacada({ carrera }: { readonly carrera: Programa }) {
  const turnos = textoDeTurnos(carrera);
  const precios = esPendiente(carrera.costo) ? [] : carrera.costo;
  return (
    <section aria-labelledby="carrera-destacada" className="relative bg-estructural text-sobre-estructural">
      <div className="shell section grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <TituloDeSeccion
            id="carrera-destacada"
            tono="oscuro"
            etiqueta={ETIQUETA_DE_TIPO[carrera.tipo]}
            script="Cocina con pasión"
            display={carrera.nombre}
            resaltado={describirDuracion(carrera.duracion)}
            descripcion={
              <p>
                {carrera.tituloOtorgado} con plan de estudios de {carrera.planDeEstudios?.length ?? 0} años, prácticas en hoteles y
                restaurantes, y convalidación a licenciatura.
              </p>
            }
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            <li className="flex items-start gap-3">
              <Icono nombre="calendario" className="mt-0.5 flex-none text-accion" />
              <span>
                <strong className="block">Inicio</strong>
                {esPendiente(carrera.inicioPublicado) ? 'Consultar' : carrera.inicioPublicado}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Icono nombre="reloj" className="mt-0.5 flex-none text-accion" />
              <span>
                <strong className="block">Horarios · {textoDeDias(carrera)}</strong>
                {turnos}
              </span>
            </li>
            {precios.map((precio) => (
              <li key={precio.etiqueta} className="flex items-start gap-3">
                <Icono nombre="monedas" className="mt-0.5 flex-none text-accion" />
                <span>
                  <strong className="block">{precio.etiqueta}</strong>
                  {formatearMonto(precio.monto)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <EnlaceBoton href={RUTAS.carrera} icono="flecha" iconoAlFinal>
              Ver plan de estudios
            </EnlaceBoton>
            <EnlaceBoton href={`${RUTAS.solicitud}?programa=${carrera.codigo}`} variante="claro">
              Solicitar inscripción
            </EnlaceBoton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="polaroid -rotate-2">
            <Foto nombre="emplatado-con-pinzas" sizes="(min-width: 1024px) 260px, 45vw" className="aspect-[3/4]" />
          </div>
          <div className="polaroid mt-10 rotate-2">
            <Foto nombre="estudiantes-con-platos" sizes="(min-width: 1024px) 260px, 45vw" className="aspect-[3/4]" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Tarjetas de programa

export function TarjetaDePrograma({ programa, nivelDeTitulo = 3 }: { readonly programa: Programa; readonly nivelDeTitulo?: 2 | 3 }) {
  const aspecto = aspectoDePrograma(programa.codigo);
  const Titulo = nivelDeTitulo === 2 ? 'h2' : 'h3';
  const esCarrera = programa.tipo === 'carrera';
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta transition-shadow duration-300 hover:shadow-[0_22px_44px_-26px_var(--t-estructural)]">
      <div className="relative overflow-hidden">
        <Foto
          nombre={aspecto.foto}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 46vw, 92vw"
          className="aspect-[16/10] transition-transform duration-500 group-hover:scale-105"
          alt=""
        />
        <span className={cn('absolute bottom-0 left-5 translate-y-1/2', 'inline-grid size-14 place-items-center rounded-full ring-4 ring-tarjeta', esCarrera ? 'bg-estructural text-sobre-estructural' : 'bg-cursos text-sobre-cursos')}>
          <Icono nombre={aspecto.icono} tamano={26} />
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pt-10 pb-6">
        <p className="t-etiqueta">{ETIQUETA_DE_TIPO[programa.tipo]}</p>
        <Titulo className={cn('t-display mt-1 text-4xl', esCarrera ? 'text-estructural' : 'text-cursos')}>
          {/* El enlace cubre toda la tarjeta (::after) sin anidar elementos interactivos. */}
          <Link href={rutaDePrograma(programa.codigo)} className="after:absolute after:inset-0 after:content-['']">
            {programa.nombre}
          </Link>
        </Titulo>
        <ul className="mt-3 space-y-1 text-sm text-tinta-suave">
          <li className="flex items-center gap-2">
            <Icono nombre="calendario" tamano={16} /> {describirDuracion(programa.duracion)}
          </li>
          <li className="flex items-center gap-2">
            <Icono nombre="reloj" tamano={16} /> {textoDeDias(programa)}
          </li>
        </ul>
        {/* Sin insignias que mostrar, el contenedor no se dibuja: dejaba un hueco al pie de la tarjeta. */}
        {esCarrera || programa.beneficios.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            {programa.beneficios.slice(0, 2).map((b) =>
              esCarrera ? null : (
                <Etiqueta key={b} tono={b.toLowerCase().includes('gratis') ? 'promo' : 'suave'}>
                  {b}
                </Etiqueta>
              ),
            )}
            {esCarrera ? <Etiqueta tono="amarillo">Título en Provisión Nacional</Etiqueta> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function RejillaDeCursos({ programas, titulo = true }: { readonly programas: readonly Programa[]; readonly titulo?: boolean }) {
  const cursos = programas.filter((p) => p.activo && p.tipo !== 'carrera');
  return (
    <section aria-labelledby={titulo ? 'cursos' : undefined} aria-label={titulo ? undefined : 'Cursos de capacitación'} className="section bg-superficie">
      <div className="shell">
        {titulo ? (
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <TituloDeSeccion
              id="cursos"
              etiqueta="Cursos de capacitación"
              script="Aprende y"
              display="emprende"
              descripcion={<p>Cursos cortos de capacitación, aparte de la carrera: prácticos y con matrícula gratis. Elige la duración y el horario que se ajusten a ti.</p>}
            />
            <EnlaceBoton href={RUTAS.cursos} variante="cursos" icono="flecha" iconoAlFinal className="self-start lg:self-end">
              Ver todos los cursos
            </EnlaceBoton>
          </div>
        ) : null}
        <ul className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', titulo && 'mt-12')}>
          {cursos.map((programa) => (
            <li key={programa.codigo} className="flex">
              <TarjetaDePrograma programa={programa} nivelDeTitulo={titulo ? 3 : 2} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Contenido de un curso por bloques (folleto: «CONTENIDO» con checks rojos). */
export function ContenidoPorBloques({ programa }: { readonly programa: Programa }) {
  const bloques = programa.contenido ?? [];
  if (bloques.length === 0) return null;
  const [unico] = bloques;
  if (bloques.length === 1 && unico) {
    // Un solo bloque en la rejilla de 3 columnas dejaba dos tercios de la sección vacíos.
    return (
      <section aria-label={unico.titulo} className="mx-auto max-w-4xl rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-6 sm:p-8">
        <h3 className="flex items-center gap-2 text-lg font-bold text-cursos">
          <Icono nombre="check" tamano={18} />
          {unico.titulo}
        </h3>
        <ListaConCheck variante="cursos" columnas={2} elementos={unico.temas} className="mt-4 text-tinta-suave" />
      </section>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {bloques.map((bloque) => (
        <section key={bloque.titulo} aria-label={bloque.titulo} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-cursos">
            <Icono nombre="check" tamano={18} />
            {bloque.titulo}
          </h3>
          <ListaConCheck variante="cursos" elementos={bloque.temas} className="mt-4 text-tinta-suave" />
        </section>
      ))}
    </div>
  );
}
