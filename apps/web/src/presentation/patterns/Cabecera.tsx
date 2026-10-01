/**
 * CAPA: Presentation / Patterns (organismo)
 *
 * Cabecera del sitio: franja azul con teléfonos y redes (el folleto siempre
 * da los dos números), y cabecera blanca con los dos logotipos oficiales
 * (solo sobre fondo claro), la navegación y la llamada a inscribirse.
 */

import Link from 'next/link';
import { enlaceDeWhatsApp } from '@core/domain/shared/sede';
import type { Sede } from '@core/domain/shared/sede';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '../icons/Icono';
import { EnlaceBoton } from '../ui/Boton';
import { Logos } from '../ui/Logos';
import { MenuMovil } from './MenuMovil';
import { NavegacionPrincipal } from './NavegacionPrincipal';
import { RedesSociales } from './RedesSociales';

export function Cabecera({ sedes }: { readonly sedes: readonly Sede[] }) {
  return (
    // `sticky` con desplazamiento negativo igual a la franja azul (h-10): la
    // franja se va al hacer scroll y la barra blanca se queda arriba.
    <header className="sticky -top-10 z-40">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accion focus:px-4 focus:py-3 focus:font-semibold focus:text-sobre-accion"
      >
        Saltar al contenido
      </a>

      <div className="bg-estructural text-sobre-estructural">
        <div className="shell flex h-10 items-center justify-between gap-4 overflow-hidden text-sm">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {sedes.map((sede) => (
              <li key={sede.codigo}>
                <a
                  href={enlaceDeWhatsApp(sede.telefono, `Hola, quiero información de ${INSTITUTO.nombreCorto} (sede ${sede.nombre}).`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 hover:text-accion"
                >
                  <Icono nombre="whatsapp" tamano={16} />
                  <span>
                    <span className="hidden sm:inline">{sede.nombre}: </span>
                    {sede.telefono}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden items-center gap-4 md:flex">
            <RedesSociales tamano="sm" />
            <Link href={RUTAS.acceso} className="inline-flex min-h-10 items-center gap-2 font-semibold hover:text-accion">
              <Icono nombre="usuario" tamano={16} />
              Portal de estudiantes
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-linea bg-superficie/95 backdrop-blur supports-[backdrop-filter]:bg-superficie/85">
        <div className="shell relative flex h-[var(--header-height)] items-center justify-between gap-4">
          <Link href={RUTAS.inicio} aria-label={`${INSTITUTO.nombreComercial}: ir al inicio`} className="flex-none">
            <Logos tamano="cabecera" />
          </Link>
          <NavegacionPrincipal />
          <div className="flex items-center gap-2">
            {/* La visibilidad la controla el contenedor: `hidden` sobre el botón compite con su
                propio `inline-flex` y gana el que Tailwind emite después (ver lib/cn.ts). */}
            <span className="hidden sm:contents">
              <EnlaceBoton href={RUTAS.registro} variante="primario" tamano="sm">
                Inscríbete
              </EnlaceBoton>
            </span>
            <MenuMovil />
          </div>
        </div>
      </div>
    </header>
  );
}
