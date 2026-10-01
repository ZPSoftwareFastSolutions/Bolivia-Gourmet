/**
 * CAPA: Presentation / Formularios
 *
 * Piezas de formulario sin estado (sirven en servidor y en cliente).
 * Reglas (skill ui-ux-pro-max, categoría Forms): etiqueta visible siempre
 * (nunca solo placeholder), ayuda y error bajo el campo enlazados con
 * `aria-describedby`, `aria-invalid` en el campo con error, 16 px de texto
 * para que iOS no haga zoom al enfocar.
 */

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icono } from '../icons/Icono';

export const CLASE_DE_CAMPO =
  'block w-full rounded-md border-2 border-linea bg-tarjeta px-4 py-3 text-base text-tinta ' +
  'placeholder:text-tinta-suave/70 transition-colors duration-150 ' +
  'hover:border-estructural/40 focus:border-estructural focus:outline-none focus:ring-4 focus:ring-accion/60 ' +
  'aria-[invalid=true]:border-peligro';

export function idsDeAyuda(id: string, ayuda?: ReactNode, error?: string): string | undefined {
  const ids = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function Etiquetado({
  id,
  etiqueta,
  opcional,
  ayuda,
  error,
  children,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly opcional?: boolean;
  readonly ayuda?: ReactNode;
  readonly error?: string;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-3 font-semibold text-tinta">
        {etiqueta}
        {opcional ? <span className="text-sm font-normal text-tinta-suave">Opcional</span> : null}
      </label>
      {children}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1.5 text-sm text-tinta-suave">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-peligro">
          <Icono nombre="alerta" tamano={16} className="mt-0.5 flex-none" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

type CampoDeTextoProps = {
  readonly id: string;
  readonly etiqueta: string;
  readonly opcional?: boolean;
  readonly ayuda?: ReactNode;
  readonly error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'style'>;

export function CampoDeTexto({ id, etiqueta, opcional, ayuda, error, className, ...resto }: CampoDeTextoProps) {
  return (
    <Etiquetado id={id} etiqueta={etiqueta} opcional={opcional} ayuda={ayuda} error={error}>
      <input
        id={id}
        name={resto.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={idsDeAyuda(id, ayuda, error)}
        required={!opcional}
        className={cn(CLASE_DE_CAMPO, className)}
        {...resto}
      />
    </Etiquetado>
  );
}

type AreaDeTextoProps = {
  readonly id: string;
  readonly etiqueta: string;
  readonly opcional?: boolean;
  readonly ayuda?: ReactNode;
  readonly error?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'style'>;

export function AreaDeTexto({ id, etiqueta, opcional, ayuda, error, className, ...resto }: AreaDeTextoProps) {
  return (
    <Etiquetado id={id} etiqueta={etiqueta} opcional={opcional} ayuda={ayuda} error={error}>
      <textarea
        id={id}
        name={resto.name ?? id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={idsDeAyuda(id, ayuda, error)}
        required={!opcional}
        className={cn(CLASE_DE_CAMPO, 'resize-y', className)}
        {...resto}
      />
    </Etiquetado>
  );
}

export interface OpcionDeEleccion {
  readonly valor: string;
  readonly etiqueta: string;
  readonly detalle?: string;
}

/**
 * Grupo de opciones como tarjetas de radio: todas visibles de un vistazo
 * (mejor que un desplegable para 2–5 opciones) y con área táctil grande.
 */
export function GrupoDeOpciones({
  nombre,
  leyenda,
  opciones,
  valor,
  error,
  ayuda,
  columnas = 2,
}: {
  readonly nombre: string;
  readonly leyenda: string;
  readonly opciones: readonly OpcionDeEleccion[];
  readonly valor?: string;
  readonly error?: string;
  readonly ayuda?: ReactNode;
  readonly columnas?: 2 | 3;
}) {
  const idError = error ? `${nombre}-error` : undefined;
  const idAyuda = ayuda ? `${nombre}-ayuda` : undefined;
  return (
    // `id` = nombre del campo: el resumen de errores enlaza a `#<nombre>`.
    <fieldset id={nombre} aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}>
      <legend className="mb-2 font-semibold text-tinta">{leyenda}</legend>
      {ayuda ? (
        <p id={idAyuda} className="-mt-1 mb-2 text-sm text-tinta-suave">
          {ayuda}
        </p>
      ) : null}
      <div className={cn('grid gap-3', columnas === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {opciones.map((opcion, i) => (
          <label
            key={opcion.valor}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border-2 border-linea bg-tarjeta p-4 transition-colors duration-150 hover:border-estructural/40 has-[:checked]:border-estructural has-[:checked]:bg-superficie-alterna has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accion/60"
          >
            <input
              type="radio"
              name={nombre}
              value={opcion.valor}
              defaultChecked={valor === opcion.valor}
              required={i === 0}
              className="mt-1 size-4 flex-none accent-[var(--t-estructural)]"
            />
            <span>
              <span className="block font-semibold text-tinta">{opcion.etiqueta}</span>
              {opcion.detalle ? <span className="text-sm text-tinta-suave">{opcion.detalle}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={idError} className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-peligro">
          <Icono nombre="alerta" tamano={16} className="mt-0.5 flex-none" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type TonoDeAviso = 'exito' | 'error' | 'info';

export function Aviso({ tono, titulo, children, className }: { readonly tono: TonoDeAviso; readonly titulo?: string; readonly children?: ReactNode; readonly className?: string }) {
  const estilos = {
    exito: 'border-exito/40 bg-exito/8 text-tinta [&_svg]:text-exito',
    error: 'border-peligro/40 bg-peligro/8 text-tinta [&_svg]:text-peligro',
    info: 'border-estructural/30 bg-superficie-alterna text-tinta [&_svg]:text-estructural',
  }[tono];
  const icono = tono === 'exito' ? 'check' : tono === 'error' ? 'alerta' : 'info';
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border-2 p-4', estilos, className)}>
      <Icono nombre={icono} className="mt-0.5 flex-none" />
      <div>
        {titulo ? <p className="font-bold">{titulo}</p> : null}
        {children ? <div className={cn(titulo && 'mt-1', 'text-tinta-suave')}>{children}</div> : null}
      </div>
    </div>
  );
}
