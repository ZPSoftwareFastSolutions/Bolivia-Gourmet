'use client';

/**
 * CAPA: Presentation / Panel (cliente)
 *
 * Menú del panel. Es de cliente solo para marcar la sección activa con
 * `aria-current="page"`. Recibe las secciones ya filtradas por permisos (las
 * decide el servidor con el contexto de la sesión).
 *
 * - `lateral`: escritorio, columna azul con icono y texto.
 * - `inferior`: teléfono, barra fija abajo al alcance del pulgar; lo que no
 *   cabe va en «Más».
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { RUTAS_PANEL } from '@/lib/rutas';
import { Icono } from '../icons/Icono';
import { seccionActiva, type SeccionDelPanel } from './navegacion';

export function NavegacionDelPanel({ secciones, variante }: { readonly secciones: readonly SeccionDelPanel[]; readonly variante: 'lateral' | 'inferior' }) {
  const ruta = usePathname();

  if (variante === 'lateral') {
    const activa = seccionActiva(ruta, secciones);
    return (
      <nav aria-label="Panel">
        <ul className="grid gap-1.5">
          {secciones.map((s) => {
            const es = s.href === activa;
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={es ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-13 items-center gap-3 rounded-[var(--t-radio-md)] px-3 font-semibold transition-colors duration-200',
                    es ? 'bg-accion text-sobre-accion' : 'text-sobre-estructural/90 hover:bg-sobre-estructural/10 hover:text-sobre-estructural',
                  )}
                >
                  <span
                    className={cn(
                      'inline-grid size-9 flex-none place-items-center rounded-full transition-colors',
                      es ? 'bg-estructural text-accion' : 'bg-sobre-estructural/10 text-sobre-estructural',
                    )}
                  >
                    <Icono nombre={s.icono} tamano={19} />
                  </span>
                  {s.etiqueta}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const principales = secciones.filter((s) => s.enBarraInferior);
  const hayMas = secciones.some((s) => !s.enBarraInferior);
  const enlaces = hayMas
    ? [...principales, { href: RUTAS_PANEL.mas, etiqueta: 'Más', icono: 'menu' as const, permiso: 'panel.entrar' as const, enBarraInferior: true }]
    : principales;
  const activa = seccionActiva(ruta, enlaces);
  return (
    <nav aria-label="Panel" className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-tarjeta pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className={cn('grid', enlaces.length === 5 ? 'grid-cols-5' : enlaces.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
        {enlaces.map((s) => {
          const es = s.href === activa;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={es ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors',
                  es ? 'text-estructural' : 'text-tinta-suave hover:text-estructural',
                )}
              >
                <span className={cn('inline-grid h-8 w-12 place-items-center rounded-full transition-colors', es ? 'bg-accion text-sobre-accion' : '')}>
                  <Icono nombre={s.icono} tamano={21} />
                </span>
                {s.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
