'use client';

/**
 * CAPA: Presentation / Formularios (cliente)
 *
 * Las tres piezas que necesitan JavaScript:
 *   - BotonEnviar: se deshabilita y avisa mientras el formulario viaja (evita
 *     el doble envío y la duda de «¿se mandó?»).
 *   - CampoClave: botón para mostrar la contraseña (accessible authentication;
 *     permite pegar y no bloquea gestores de contraseñas).
 *   - ResumenDeErrores: tras un envío fallido, recibe el foco para que el
 *     lector de pantalla anuncie qué falló; cada error enlaza a su campo.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icono, type NombreDeIcono } from '../icons/Icono';
import { CLASE_DE_CAMPO, Etiquetado, idsDeAyuda } from './Campos';

export function BotonEnviar({
  children,
  enviando = 'Enviando…',
  icono,
  variante = 'primario',
  className,
}: {
  readonly children: ReactNode;
  readonly enviando?: string;
  readonly icono?: NombreDeIcono;
  readonly variante?: 'primario' | 'secundario' | 'peligro';
  readonly className?: string;
}) {
  const { pending } = useFormStatus();
  const estilo = {
    primario: 'bg-accion text-sobre-accion hover:bg-accion-fuerte',
    secundario: 'bg-estructural text-sobre-estructural hover:bg-estructural-profundo',
    peligro: 'border-2 border-peligro text-peligro hover:bg-peligro hover:text-sobre-estructural',
  }[variante];
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 font-semibold transition-colors duration-200 disabled:cursor-wait disabled:opacity-70',
        estilo,
        className,
      )}
    >
      {pending ? (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icono ? (
        <Icono nombre={icono} tamano={20} />
      ) : null}
      <span>{pending ? enviando : children}</span>
    </button>
  );
}

export function CampoClave({
  id,
  etiqueta,
  error,
  ayuda,
  autoComplete,
  nombre,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly error?: string;
  readonly ayuda?: ReactNode;
  readonly autoComplete: 'current-password' | 'new-password';
  readonly nombre?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Etiquetado id={id} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <div className="relative">
        <input
          id={id}
          name={nombre ?? id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          maxLength={72}
          aria-invalid={error ? true : undefined}
          aria-describedby={idsDeAyuda(id, ayuda, error)}
          className={cn(CLASE_DE_CAMPO, 'pe-14')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-controls={id}
          className="absolute inset-y-0 end-0 inline-grid w-12 place-items-center rounded-e-md text-tinta-suave hover:text-estructural"
        >
          <Icono nombre={visible ? 'ojoTachado' : 'ojo'} tamano={20} />
        </button>
      </div>
    </Etiquetado>
  );
}

export function ResumenDeErrores({ errores, mensaje }: { readonly errores?: Readonly<Record<string, string>>; readonly mensaje?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();
  const entradas = Object.entries(errores ?? {}).filter(([campo]) => campo !== 'general');
  const general = errores?.general ?? mensaje;
  const hayAlgo = entradas.length > 0 || Boolean(general);

  useEffect(() => {
    if (hayAlgo) caja.current?.focus();
  }, [hayAlgo, errores, mensaje]);

  if (!hayAlgo) return null;
  return (
    <div
      ref={caja}
      tabIndex={-1}
      role="alert"
      aria-labelledby={id}
      className="rounded-md border-2 border-peligro/50 bg-peligro/8 p-4 text-tinta focus:outline-none focus-visible:ring-4 focus-visible:ring-peligro/30"
    >
      <p id={id} className="flex items-center gap-2 font-bold text-peligro">
        <Icono nombre="alerta" tamano={20} />
        {entradas.length > 0 ? 'Revisa estos datos' : 'No pudimos continuar'}
      </p>
      {general ? <p className="mt-2 text-tinta-suave">{general}</p> : null}
      {entradas.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 ps-5 text-tinta-suave">
          {entradas.map(([campo, texto]) => (
            <li key={campo}>
              <a href={`#${campo}`} className="enlace">
                {texto}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
