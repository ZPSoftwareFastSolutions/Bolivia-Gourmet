/**
 * CAPA: Presentation / Sections
 *
 * Portada. Traduce la tapa del folleto: el lema con la mezcla script +
 * display y brochazos («Descubre el CHEF que llevas DENTRO!»), estudiantes
 * reales uniformados, y la franja azul inferior con el título otorgado y los
 * cuatro iconos de áreas (gorro, cubiertos, campana, copa).
 *
 * Patrón de la skill ui-ux-pro-max «Trust & Authority + Conversion»: la
 * credibilidad (16 años, título en Provisión Nacional) y la acción principal
 * están a la vista sin desplazarse.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono, type NombreDeIcono } from '../icons/Icono';
import { EnlaceBoton } from '../ui/Boton';
import { Foto } from '../ui/Foto';
import type { NombreDeImagen } from '@contenido/imagenes.generadas';
import { Etiqueta } from '../ui/Marca';

const AREAS: readonly { icono: NombreDeIcono; nombre: string }[] = [
  { icono: 'gorro', nombre: 'Cocina' },
  { icono: 'cubiertos', nombre: 'Gastronomía' },
  { icono: 'campana', nombre: 'Servicio y eventos' },
  { icono: 'copa', nombre: 'Bar y coctelería' },
];

export function HeroInicio({ inicioDeClases }: { readonly inicioDeClases: string | null }) {
  return (
    <section aria-labelledby="titulo-portada" className="relative overflow-hidden bg-superficie">
      <div className="shell grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-24">
        <div>
          <p className="t-etiqueta flex items-center gap-2">
            <span className="franja-tricolor w-10" aria-hidden="true" />
            {INSTITUTO.nombreDelInstituto}
          </p>

          <h1 id="titulo-portada" className="mt-5 text-estructural">
            <span className="t-script block text-[clamp(2.8rem,1.8rem+4.4vw,5.2rem)] leading-[0.95]">Descubre</span>
            <span className="t-display block text-[clamp(3.2rem,2rem+5.6vw,6.4rem)]">
              el <span className="text-[1.08em]">chef</span>
            </span>
            <span className="t-display mt-1 block text-[clamp(2.4rem,1.6rem+3.6vw,4.4rem)]">
              <span className="marca-resaltado">que llevas</span>
            </span>
            <span className="t-display mt-2 block text-[clamp(3.2rem,2rem+5.6vw,6.4rem)]">
              <span className="marca-resaltado marca-resaltado--azul">dentro!</span>
            </span>
          </h1>

          <p className="t-lead mt-7 max-w-xl">
            Fórmate como <strong className="text-tinta">{INSTITUTO.tituloOtorgado}</strong> con más de {INSTITUTO.aniosDeExperiencia} años de
            experiencia, clases {INSTITUTO.porcentajePractica} % prácticas y prácticas laborales en hoteles y restaurantes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <EnlaceBoton href={RUTAS.registro} tamano="lg" icono="flecha" iconoAlFinal>
              Inscríbete ahora
            </EnlaceBoton>
            <EnlaceBoton href={RUTAS.carrera} variante="contorno" tamano="lg">
              Conoce la carrera
            </EnlaceBoton>
          </div>

          {inicioDeClases ? (
            <p className="mt-7 flex items-center gap-3 text-sm font-semibold text-tinta">
              <span className="inline-grid size-10 place-items-center rounded-full bg-estructural text-sobre-estructural">
                <Icono nombre="calendario" tamano={20} />
              </span>
              <span>
                Inicio de clases de la carrera: <span className="text-estructural">{inicioDeClases}</span>
              </span>
            </p>
          ) : null}
        </div>

        <div className="relative">
          <div className="bloque-desplazado">
            <Foto
              nombre="estudiantes-brazos-cruzados"
              prioritaria
              sizes="(min-width: 1200px) 560px, (min-width: 1024px) 46vw, 92vw"
              className="aspect-[3/2] rounded-[var(--t-radio-xl)]"
            />
          </div>
          <span className="marca-rayas absolute -top-6 -left-4 size-14" aria-hidden="true" />
          <div className="absolute -bottom-6 left-4 sm:left-6">
            <Etiqueta tono="azul" className="px-4 py-2 text-[0.8rem] shadow-[0_10px_24px_-10px_var(--t-estructural)]">
              <Icono nombre="medalla" tamano={16} />
              Título en Provisión Nacional
            </Etiqueta>
          </div>
        </div>
      </div>

      <div className="bg-estructural text-sobre-estructural">
        <div className="shell flex flex-col items-center justify-between gap-5 py-6 md:flex-row">
          <p className="t-espaciado text-center text-sm font-semibold md:text-base">{INSTITUTO.tituloOtorgado}</p>
          <ul className="flex items-center gap-3" aria-label="Áreas de formación">
            {AREAS.map((area) => (
              <li key={area.nombre} className="inline-grid size-12 place-items-center rounded-full ring-2 ring-sobre-estructural/30" title={area.nombre}>
                <Icono nombre={area.icono} tamano={22} titulo={area.nombre} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Encabezado de las páginas interiores: migas, título de marca y, si hay, una
 * fotografía. `tono="cursos"` pinta la línea de cursos en rojo vino, como el
 * folleto B.
 */
export function EncabezadoDePagina({
  migas,
  etiqueta,
  script,
  display,
  resaltado,
  descripcion,
  foto,
  tono = 'marca',
  children,
}: {
  readonly migas: readonly { etiqueta: string; href?: string }[];
  readonly etiqueta?: string;
  readonly script?: string;
  readonly display: string;
  readonly resaltado?: string;
  readonly descripcion?: ReactNode;
  readonly foto?: NombreDeImagen;
  readonly tono?: 'marca' | 'cursos';
  readonly children?: ReactNode;
}) {
  const fondo = tono === 'cursos' ? 'bg-cursos text-sobre-cursos' : 'bg-estructural text-sobre-estructural';
  return (
    <section className={fondo}>
      <div className={`shell grid items-center gap-10 py-12 lg:py-16 ${foto ? 'lg:grid-cols-[1.15fr_1fr]' : ''}`}>
        <div>
          <nav aria-label="Migas de pan">
            <ol className="flex flex-wrap items-center gap-2 text-sm opacity-90">
              {migas.map((miga, i) => (
                <li key={miga.etiqueta} className="flex items-center gap-2">
                  {i > 0 ? <span aria-hidden="true">/</span> : null}
                  {miga.href ? (
                    <Link href={miga.href} className="underline-offset-4 hover:underline">
                      {miga.etiqueta}
                    </Link>
                  ) : (
                    <span aria-current="page" className="font-semibold">
                      {miga.etiqueta}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          {etiqueta ? <p className="t-etiqueta mt-6 text-accion">{etiqueta}</p> : null}
          <h1 className="t-h1 mt-3">
            {script ? <span className="t-script mb-1 block text-[0.85em] normal-case">{script}</span> : null}
            <span className="t-display block">
              {display}
              {resaltado ? (
                <>
                  {' '}
                  <span className="marca-resaltado text-sobre-accion">{resaltado}</span>
                </>
              ) : null}
            </span>
          </h1>
          {descripcion ? <div className="t-lead mt-5 max-w-2xl text-current opacity-90">{descripcion}</div> : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        {foto ? (
          <div className="bloque-desplazado">
            <Foto nombre={foto} prioritaria sizes="(min-width: 1024px) 480px, 92vw" className="aspect-[4/3] rounded-[var(--t-radio-xl)]" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
