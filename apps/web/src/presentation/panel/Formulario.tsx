'use client';

/**
 * CAPA: Presentation / Panel
 *
 * Formulario genérico del panel: recibe una Server Action y los campos ya
 * dibujados por el servidor (children). Dos decisiones pensadas para personas
 * de cualquier edad:
 *
 * - Si la base dice que algo falta, NADA de lo escrito se borra: el envío va
 *   por `onSubmit` + transición (React no reinicia el formulario) y el resumen
 *   de errores se enfoca y se sacude una vez (enmiendas B.14).
 * - El botón muestra «Guardando…» con un aro que gira y no deja enviar dos
 *   veces; la clave del formulario evita además el doble registro en la base.
 *
 * Sin JavaScript, `action` envía igual (mejora progresiva).
 */

import { createContext, startTransition, useActionState, useContext, useRef, type FormEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ESTADO_INICIAL, type EstadoDeFormulario } from '@/presentation/formularios/estado';
import { ResumenDeErrores } from '@/presentation/formularios/Interactivos';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';

export type AccionDelPanel = (previo: EstadoDeFormulario, datos: FormData) => Promise<EstadoDeFormulario>;

const Pendiente = createContext(false);

export function FormularioDelPanel({
  accion,
  children,
  className,
  etiqueta,
}: {
  readonly accion: AccionDelPanel;
  readonly children: ReactNode;
  readonly className?: string;
  /** Nombre accesible del formulario cuando hay varios en la página. */
  readonly etiqueta?: string;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const intentos = useRef(0);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    intentos.current += 1;
    const datos = new FormData(evento.currentTarget);
    startTransition(() => despachar(datos));
  }

  const hayError = estado.estado === 'error';
  return (
    <form action={despachar} onSubmit={enviar} noValidate aria-label={etiqueta} aria-busy={pendiente || undefined} className={cn('grid gap-6', className)}>
      {hayError ? (
        <div key={intentos.current} className="anim-sacudir">
          <ResumenDeErrores mensaje={estado.mensaje} errores={estado.errores} />
        </div>
      ) : null}
      <Pendiente.Provider value={pendiente}>{children}</Pendiente.Provider>
    </form>
  );
}

/** Botón de envío del formulario del panel: grande, con verbo y su icono. */
export function BotonGuardar({
  children,
  icono = 'check',
  enviando = 'Guardando…',
  variante = 'primario',
  className,
}: {
  readonly children: ReactNode;
  readonly icono?: NombreDeIcono;
  readonly enviando?: string;
  readonly variante?: 'primario' | 'secundario' | 'peligro';
  readonly className?: string;
}) {
  const pendiente = useContext(Pendiente);
  const estilo = {
    primario: 'bg-accion text-sobre-accion hover:bg-accion-fuerte',
    secundario: 'bg-estructural text-sobre-estructural hover:bg-estructural-profundo',
    peligro: 'border-2 border-peligro bg-tarjeta text-peligro hover:bg-peligro hover:text-sobre-estructural',
  }[variante];
  return (
    <button
      type="submit"
      disabled={pendiente}
      aria-disabled={pendiente || undefined}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-bold transition-colors disabled:cursor-wait disabled:opacity-80',
        estilo,
        className,
      )}
    >
      {pendiente ? (
        <>
          <span className="anim-girar inline-block size-5 rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          {enviando}
        </>
      ) : (
        <>
          <Icono nombre={icono} tamano={20} />
          {children}
        </>
      )}
    </button>
  );
}
