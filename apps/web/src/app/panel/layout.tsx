/**
 * CAPA: Presentation / App — armazón del panel interno.
 *
 * Escritorio: columna azul fija con los logotipos (sobre su tarjeta blanca:
 * solo van sobre fondo claro), el menú con icono y texto, y abajo la persona,
 * su rol y «Cerrar sesión». Teléfono: barra superior blanca con los logotipos
 * y barra inferior fija con las secciones al alcance del pulgar.
 *
 * El contexto (quién, qué permisos, qué sedes) se lee UNA vez por petición
 * (`exigirPersonal`, con `cache`) y la página lo vuelve a usar sin otra ida a
 * la base. Un estudiante que llega aquí vuelve a su portal.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ETIQUETA_DE_ROL } from '@core/domain/identidad/rol';
import { sedeDeTrabajo } from '@core/domain/identidad/contexto-de-panel';
import { INSTITUTO } from '@contenido/instituto';
import { RUTAS, RUTAS_PANEL } from '@/lib/rutas';
import { Icono } from '@/presentation/icons/Icono';
import { BotonEnviar } from '@/presentation/formularios/Interactivos';
import { Aviso } from '@/presentation/formularios/Campos';
import { NavegacionDelPanel } from '@/presentation/panel/NavegacionDelPanel';
import { seccionesVisibles } from '@/presentation/panel/navegacion';
import { Logos } from '@ui/Logos';
import { cerrarSesion } from '../portal/actions';
import { exigirPersonal } from './_sesion';

export const metadata: Metadata = {
  title: { default: 'Panel', template: `%s · Panel · ${INSTITUTO.nombreCorto}` },
  robots: { index: false, follow: false },
};

function iniciales(nombres: string, apellidos: string): string {
  const letra = (t: string) => t.trim().charAt(0).toUpperCase();
  return `${letra(nombres)}${letra(apellidos)}` || '·';
}

export default async function LayoutDelPanel({ children }: { readonly children: ReactNode }) {
  const lectura = await exigirPersonal();

  if (lectura.estado === 'indisponible') {
    return (
      <main id="contenido" className="shell grid min-h-dvh place-items-center py-16">
        <Aviso tono="error" titulo="No pudimos abrir el panel">
          <p>No se pudo comprobar tu sesión. Revisa tu conexión y vuelve a intentarlo en un momento.</p>
        </Aviso>
      </main>
    );
  }

  const ctx = lectura.contexto;
  const secciones = seccionesVisibles(ctx.permisos);
  const sede = sedeDeTrabajo(ctx);
  const nombre = [ctx.nombres, ctx.apellidos].filter(Boolean).join(' ') || ctx.correo;

  return (
    <div className="min-h-dvh bg-superficie-alterna lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-accion focus:px-4 focus:py-3 focus:font-semibold focus:text-sobre-accion"
      >
        Saltar al contenido
      </a>

      {/* ---------------------------------------------------------- lateral (escritorio) */}
      <aside className="panel-sin-imprimir sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-estructural p-4 text-sobre-estructural lg:flex">
        <Link href={RUTAS_PANEL.inicio} aria-label="Inicio del panel" className="block rounded-[var(--t-radio-lg)] bg-tarjeta px-3 py-3">
          <Logos tamano="portal" className="justify-center" />
          <span className="franja-tricolor mx-auto mt-2" aria-hidden="true" />
        </Link>
        <NavegacionDelPanel secciones={secciones} variante="lateral" />
        <div className="mt-auto grid gap-3 border-t border-sobre-estructural/15 pt-4">
          <div className="flex items-center gap-3">
            <span className="inline-grid size-11 flex-none place-items-center rounded-full bg-accion font-bold text-sobre-accion">{iniciales(ctx.nombres, ctx.apellidos)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{nombre}</span>
              <span className="block text-sm text-sobre-estructural/75">
                {ETIQUETA_DE_ROL[ctx.rol]}
                {sede ? ` · ${sede.nombre}` : ''}
              </span>
            </span>
          </div>
          <form action={cerrarSesion}>
            <BotonEnviar variante="secundario" icono="salir" enviando="Cerrando…" className="w-full border border-sobre-estructural/25">
              Cerrar sesión
            </BotonEnviar>
          </form>
          <Link href={RUTAS.inicio} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold text-sobre-estructural/80 hover:text-sobre-estructural">
            <Icono nombre="externo" tamano={16} />
            Ver el sitio web
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* -------------------------------------------------------- barra superior (teléfono) */}
        <header className="panel-sin-imprimir sticky top-0 z-30 border-b border-linea bg-tarjeta lg:hidden">
          <span className="franja-tricolor w-full rounded-none" aria-hidden="true" />
          <div className="flex min-h-16 items-center justify-between gap-3 px-4">
            <Link href={RUTAS_PANEL.inicio} aria-label="Inicio del panel">
              <Logos tamano="portal" />
            </Link>
            <span
              className="inline-grid size-10 flex-none place-items-center rounded-full bg-estructural text-sm font-bold text-sobre-estructural"
              title={`${nombre} · ${ETIQUETA_DE_ROL[ctx.rol]}`}
            >
              {iniciales(ctx.nombres, ctx.apellidos)}
            </span>
          </div>
        </header>

        <main id="contenido" className="panel-contenido flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <div className="panel-sin-imprimir">
        <NavegacionDelPanel secciones={secciones} variante="inferior" />
      </div>
    </div>
  );
}
