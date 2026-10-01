/**
 * CAPA: Presentation / UI (átomos de marca)
 *
 * Los motivos gráficos del folleto como componentes (docs/brand §7):
 * insignia circular, lista con check, etiqueta de promoción, título de
 * sección con script + display y separador ondulado. Ninguno conoce el
 * dominio: reciben textos y se pintan.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icono, type NombreDeIcono } from '../icons/Icono';

// ---------------------------------------------------------------- Insignia

type TonoDeInsignia = 'azul' | 'amarillo' | 'vino' | 'claro';

const TONO_DE_INSIGNIA: Record<TonoDeInsignia, string> = {
  azul: 'bg-estructural text-sobre-estructural',
  amarillo: 'bg-accion text-sobre-accion',
  vino: 'bg-cursos text-sobre-cursos',
  claro: 'bg-tarjeta text-estructural ring-2 ring-estructural/15',
};

export function Insignia({
  icono,
  tono = 'azul',
  tamano = 'md',
  className,
}: {
  readonly icono: NombreDeIcono;
  readonly tono?: TonoDeInsignia;
  readonly tamano?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}) {
  const medida = { sm: 'size-10', md: 'size-14', lg: 'size-18' }[tamano];
  const icon = { sm: 20, md: 26, lg: 32 }[tamano];
  return (
    <span className={cn('inline-grid flex-none place-items-center rounded-full', medida, TONO_DE_INSIGNIA[tono], className)}>
      <Icono nombre={icono} tamano={icon} />
    </span>
  );
}

// ---------------------------------------------------------------- Lista con check

export function ListaConCheck({
  elementos,
  variante = 'marca',
  columnas = 1,
  className,
}: {
  readonly elementos: readonly ReactNode[];
  readonly variante?: 'marca' | 'cursos' | 'claro';
  readonly columnas?: 1 | 2 | 3;
  readonly className?: string;
}) {
  const vineta = {
    marca: 'bg-accion text-sobre-accion',
    cursos: 'bg-cursos text-sobre-cursos',
    claro: 'bg-sobre-estructural text-estructural',
  }[variante];
  const rejilla = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columnas];
  return (
    <ul className={cn('grid gap-x-8 gap-y-3', rejilla, className)}>
      {elementos.map((elemento, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className={cn('mt-0.5 inline-grid size-6 flex-none place-items-center rounded-full', vineta)}>
            <Icono nombre="check" tamano={15} />
          </span>
          <span>{elemento}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Etiqueta

type TonoDeEtiqueta = 'promo' | 'azul' | 'amarillo' | 'suave' | 'exito' | 'peligro' | 'neutro';

const TONO_DE_ETIQUETA: Record<TonoDeEtiqueta, string> = {
  promo: 'bg-promo text-sobre-estructural',
  azul: 'bg-estructural text-sobre-estructural',
  amarillo: 'bg-accion text-sobre-accion',
  suave: 'bg-suave text-cursos-profundo',
  exito: 'bg-exito/12 text-exito ring-1 ring-exito/30',
  peligro: 'bg-peligro/10 text-peligro ring-1 ring-peligro/30',
  neutro: 'bg-superficie-alterna text-tinta-suave ring-1 ring-linea',
};

export function Etiqueta({ children, tono = 'azul', className }: { readonly children: ReactNode; readonly tono?: TonoDeEtiqueta; readonly className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase', TONO_DE_ETIQUETA[tono], className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Título de sección

/**
 * Título con la combinación del folleto: una parte en script (el gancho) y
 * otra en display (la palabra clave). Es el rasgo más reconocible de la marca
 * (docs/brand §4.3). Se lee como UNA frase: el `h2` envuelve ambas partes.
 */
export function TituloDeSeccion({
  etiqueta,
  script,
  display,
  resaltado,
  descripcion,
  alineacion = 'izquierda',
  tono = 'claro',
  nivel = 2,
  id,
  className,
}: {
  readonly etiqueta?: string;
  readonly script?: string;
  readonly display: string;
  /** Palabras finales del display sobre brochazo. */
  readonly resaltado?: string;
  readonly descripcion?: ReactNode;
  readonly alineacion?: 'izquierda' | 'centro';
  readonly tono?: 'claro' | 'oscuro' | 'cursos';
  readonly nivel?: 1 | 2;
  readonly id?: string;
  readonly className?: string;
}) {
  const Encabezado = nivel === 1 ? 'h1' : 'h2';
  const colorTitulo = tono === 'claro' ? 'text-estructural' : 'text-sobre-estructural';
  const colorEtiqueta = tono === 'claro' ? 'text-estructural' : 'text-accion';
  const colorTexto = tono === 'claro' ? 'text-tinta-suave' : 'text-sobre-estructural/85';
  const centrado = alineacion === 'centro';
  return (
    <div className={cn(centrado && 'mx-auto text-center', 'max-w-3xl', className)}>
      {etiqueta ? (
        <p className={cn('t-etiqueta flex items-center gap-2', colorEtiqueta, centrado && 'justify-center')}>
          <span className="marca-rayas size-6" aria-hidden="true" />
          {etiqueta}
        </p>
      ) : null}
      <Encabezado id={id} className={cn('mt-3', colorTitulo, nivel === 1 ? 't-h1' : 't-h2')}>
        {/* El subrayado acompaña solo a la palabra (inline-block dentro de un bloque), como en el folleto. */}
        {script ? (
          <span className="mb-1 block">
            <span className="t-script marca-subrayado text-[0.9em] normal-case">{script}</span>
          </span>
        ) : null}
        <span className="t-display block">
          {display}
          {resaltado ? (
            <>
              {' '}
              <span className={cn('marca-resaltado', tono !== 'claro' && 'text-sobre-accion')}>{resaltado}</span>
            </>
          ) : null}
        </span>
      </Encabezado>
      {descripcion ? <div className={cn('t-lead mt-5', colorTexto)}>{descripcion}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Separador ondulado

/**
 * La banda ondulada que separa secciones en el folleto. El color sale del
 * `className` (`text-estructural`, `text-superficie-alterna`…) vía
 * `currentColor`: el SVG no lleva ningún color propio.
 */
export function SeparadorOndulado({ className, invertido = false }: { readonly className?: string; readonly invertido?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={cn('block h-10 w-full sm:h-16', invertido && 'rotate-180', className)}
    >
      <path fill="currentColor" d="M0 48C180 8 360 0 540 22s360 58 540 50 270-40 360-52v112H0Z" />
    </svg>
  );
}
