'use client';

/**
 * CAPA: Presentation / Patterns (organismo de cliente)
 *
 * Menú de pantallas estrechas sobre `<details>`: funciona antes de que cargue
 * el JavaScript y el navegador gestiona teclado y estado. Lo único que añade
 * este componente es CERRARSE al navegar: la cabecera vive en el layout y no
 * se vuelve a montar, así que sin esto el panel quedaría abierto sobre la
 * página nueva.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { NAVEGACION, RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { Icono } from '../icons/Icono';

export function MenuMovil() {
  const ruta = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [ruta]);

  return (
    <details ref={menu} className="sin-marcador group xl:hidden">
      <summary
        className="inline-grid size-11 place-items-center rounded-md text-estructural hover:bg-superficie-alterna"
        aria-label="Abrir el menú"
      >
        <Icono nombre="menu" className="group-open:hidden" />
        <Icono nombre="cerrar" className="hidden group-open:block" />
      </summary>
      <nav
        aria-label="Menú principal"
        className="absolute inset-x-0 top-full border-t border-linea bg-superficie shadow-[0_24px_40px_-24px_var(--t-estructural)]"
      >
        <ul className="shell flex flex-col py-3">
          <li>
            <Link href={RUTAS.inicio} className={cn('flex min-h-12 items-center font-semibold', ruta === '/' ? 'text-estructural' : 'text-tinta')}>
              Inicio
            </Link>
          </li>
          {NAVEGACION.map((enlace) => {
            const activo = ruta === enlace.href || ruta.startsWith(`${enlace.href}/`);
            return (
              <li key={enlace.href} className="border-t border-linea">
                <Link
                  href={enlace.href}
                  aria-current={activo ? 'page' : undefined}
                  className={cn('flex min-h-12 items-center justify-between font-semibold', activo ? 'text-estructural' : 'text-tinta')}
                >
                  {enlace.etiqueta}
                  {activo ? <span className="h-1 w-6 rounded bg-accion" aria-hidden="true" /> : null}
                </Link>
              </li>
            );
          })}
          <li className="mt-3 grid grid-cols-2 gap-3 border-t border-linea pt-4">
            <Link href={RUTAS.acceso} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-estructural font-semibold text-estructural">
              <Icono nombre="usuario" tamano={20} />
              Portal
            </Link>
            <Link href={RUTAS.registro} className="inline-flex min-h-11 items-center justify-center rounded-md bg-accion font-semibold text-sobre-accion">
              Inscríbete
            </Link>
          </li>
        </ul>
      </nav>
    </details>
  );
}
