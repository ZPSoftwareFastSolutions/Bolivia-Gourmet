/**
 * CAPA: Presentation / Panel
 *
 * Piezas visuales del panel interno (especificación §7.1–7.2 y §8): la esencia
 * de la marca sin saturar. Server Components, sin estado.
 *
 * - EncabezadoDePanel: título de cada página (Bebas) con un gancho en script
 *   opcional y el brochazo amarillo bajo una palabra.
 * - Mosaico: botón grande de acción con insignia circular azul e icono blanco
 *   (pensado para personas mayores: 64 px, icono + verbo concreto).
 * - Indicador: una cifra en Bebas, su etiqueta y la acción que dispara.
 * - EstadoVacio: frase en script, una línea y una acción.
 * - Confirmacion: el bloque que confirma lo que se guardó, con sello animado
 *   (enmiendas B.14). No se esconde solo; «Cerrar» quita los parámetros.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icono, type NombreDeIcono } from '../icons/Icono';

// ---------------------------------------------------------------- Encabezado

export function EncabezadoDePanel({
  gancho,
  titulo,
  resaltado,
  descripcion,
  acciones,
  className,
}: {
  readonly gancho?: string;
  readonly titulo: string;
  readonly resaltado?: string;
  readonly descripcion?: ReactNode;
  readonly acciones?: ReactNode;
  readonly className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <h1 className="text-estructural">
          {gancho ? <span className="t-script block text-2xl sm:text-3xl">{gancho}</span> : null}
          <span className="t-display block text-4xl sm:text-5xl">
            {titulo}
            {resaltado ? (
              <>
                {' '}
                <span className="marca-resaltado">{resaltado}</span>
              </>
            ) : null}
          </span>
        </h1>
        {descripcion ? <div className="mt-2 max-w-2xl text-tinta-suave">{descripcion}</div> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}

// ---------------------------------------------------------------- Mosaico de acción

export function Mosaico({
  href,
  icono,
  titulo,
  detalle,
  tono = 'azul',
}: {
  readonly href: string;
  readonly icono: NombreDeIcono;
  readonly titulo: string;
  readonly detalle?: string;
  readonly tono?: 'azul' | 'vino' | 'amarillo';
}) {
  const insignia = {
    azul: 'bg-estructural text-sobre-estructural',
    vino: 'bg-cursos text-sobre-cursos',
    amarillo: 'bg-accion text-sobre-accion',
  }[tono];
  return (
    <Link
      href={href}
      className="mosaico flex min-h-24 items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 text-tinta shadow-[0_10px_24px_-22px_var(--t-estructural)] hover:border-estructural"
    >
      <span className={cn('inline-grid size-14 flex-none place-items-center rounded-full', insignia)}>
        <Icono nombre={icono} tamano={26} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg leading-tight font-bold text-estructural">{titulo}</span>
        {detalle ? <span className="mt-0.5 block text-sm text-tinta-suave">{detalle}</span> : null}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------- Indicador

export function Indicador({
  icono,
  cifra,
  etiqueta,
  detalle,
  accion,
  tono = 'normal',
}: {
  readonly icono: NombreDeIcono;
  readonly cifra: string;
  readonly etiqueta: string;
  readonly detalle?: ReactNode;
  readonly accion?: { readonly href: string; readonly texto: string };
  readonly tono?: 'normal' | 'alerta' | 'bien';
}) {
  const colorIcono = { normal: 'bg-superficie-alterna text-estructural', alerta: 'bg-peligro/10 text-peligro', bien: 'bg-exito/10 text-exito' }[tono];
  return (
    <article className="flex flex-col rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="t-etiqueta">{etiqueta}</p>
        <span className={cn('inline-grid size-10 flex-none place-items-center rounded-full', colorIcono)}>
          <Icono nombre={icono} tamano={20} />
        </span>
      </div>
      <p className="t-display mt-1 text-5xl leading-none text-estructural">{cifra}</p>
      {detalle ? <div className="mt-2 text-sm text-tinta-suave">{detalle}</div> : null}
      {accion ? (
        <Link href={accion.href} className="enlace mt-auto inline-flex min-h-11 items-center gap-1 pt-3">
          {accion.texto}
          <Icono nombre="flecha" tamano={16} />
        </Link>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------- Estado vacío

export function EstadoVacio({ frase, detalle, accion }: { readonly frase: string; readonly detalle?: string; readonly accion?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-[var(--t-radio-lg)] border-2 border-dashed border-linea bg-tarjeta px-6 py-12 text-center">
      <span className="marca-rayas size-10 bg-accion" aria-hidden="true" />
      <p className="t-script mt-3 text-3xl text-estructural">{frase}</p>
      {detalle ? <p className="mt-2 max-w-md text-tinta-suave">{detalle}</p> : null}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Confirmación

export interface CambioConfirmado {
  readonly etiqueta: string;
  readonly antes: string;
  readonly despues: string;
}

export function Confirmacion({
  palabra,
  titulo,
  children,
  cambios = [],
  acciones,
  cerrarHref,
}: {
  /** Palabra del sello en script: «¡Listo!», «¡Cobrado!», «¡Inscrito!». */
  readonly palabra: string;
  readonly titulo: string;
  readonly children?: ReactNode;
  readonly cambios?: readonly CambioConfirmado[];
  readonly acciones?: ReactNode;
  /** A dónde lleva «Cerrar» (la misma página sin los parámetros). */
  readonly cerrarHref: string;
}) {
  return (
    <section role="status" aria-labelledby="confirmacion-titulo" className="anim-entrar rounded-[var(--t-radio-xl)] border-2 border-exito/40 bg-tarjeta p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <SelloDeConfirmacion />
        <div className="min-w-0 flex-1">
          <p className="t-script text-3xl text-estructural">{palabra}</p>
          <h2 id="confirmacion-titulo" className="mt-1 text-lg font-bold text-tinta">
            {titulo}
          </h2>
          {children ? <div className="mt-1 text-tinta-suave">{children}</div> : null}
          {cambios.length > 0 ? (
            <ul className="mt-3 grid gap-1.5">
              {cambios.map((c) => (
                <li key={c.etiqueta} className="anim-cambio flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-tinta">{c.etiqueta}:</span>
                  <span className="anim-cambio__antes text-tinta-suave">{c.antes}</span>
                  <span aria-hidden="true" className="text-tinta-suave">
                    →
                  </span>
                  <span className="sr-only">ahora</span>
                  <span className="anim-cambio__despues font-bold text-estructural">{c.despues}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {acciones}
            <Link href={cerrarHref} className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold text-tinta-suave hover:bg-superficie-alterna">
              <Icono nombre="cerrar" tamano={18} />
              Cerrar
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Insignia azul con check blanco que «se estampa» y un check que se dibuja. */
export function SelloDeConfirmacion() {
  return (
    <span className="anim-sello relative inline-grid size-18 flex-none place-items-center rounded-full bg-estructural text-sobre-estructural">
      <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path className="anim-check" pathLength={1} d="M20 6 9 17l-5-5" />
      </svg>
      <span className="marca-rayas absolute -top-2 -right-3 size-7 bg-accion" aria-hidden="true" />
    </span>
  );
}

// ---------------------------------------------------------------- En preparación

export function SeccionEnPreparacion({ titulo, icono, texto }: { readonly titulo: string; readonly icono: NombreDeIcono; readonly texto: string }) {
  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo={titulo} />
      <div className="flex items-start gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-6">
        <span className="inline-grid size-14 flex-none place-items-center rounded-full bg-superficie-alterna text-estructural">
          <Icono nombre={icono} tamano={26} />
        </span>
        <p className="text-tinta-suave">{texto}</p>
      </div>
    </div>
  );
}
