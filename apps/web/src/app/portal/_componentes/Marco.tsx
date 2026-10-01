/**
 * CAPA: Presentation / App — marcos del portal.
 *
 * `MarcoDeAcceso`: tarjeta centrada para registro, acceso y recuperación,
 * con una foto oficial al lado en pantallas anchas (la marca sigue presente
 * sin estorbar al formulario). `AvisoIndisponible`: cuando no se pudo
 * comprobar la sesión, se dice así en vez de echar al estudiante.
 */

import type { ReactNode } from 'react';
import type { NombreDeImagen } from '@contenido/imagenes.generadas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Foto } from '@ui/Foto';

export function MarcoDeAcceso({
  etiqueta,
  script,
  titulo,
  descripcion,
  foto = 'estudiantes-brazos-cruzados',
  pie,
  children,
}: {
  readonly etiqueta: string;
  readonly script?: string;
  readonly titulo: string;
  readonly descripcion?: ReactNode;
  readonly foto?: NombreDeImagen;
  readonly pie?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="shell grid items-stretch gap-8 py-10 lg:grid-cols-[1fr_0.85fr] lg:py-16">
      <section className="rounded-[var(--t-radio-xl)] bg-tarjeta p-6 shadow-[0_24px_60px_-40px_var(--t-estructural)] sm:p-10">
        <p className="t-etiqueta">{etiqueta}</p>
        <h1 className="mt-2 text-estructural">
          {script ? <span className="t-script block text-3xl">{script}</span> : null}
          <span className="t-display block text-5xl">{titulo}</span>
        </h1>
        {descripcion ? <div className="mt-3 text-tinta-suave">{descripcion}</div> : null}
        <div className="mt-8">{children}</div>
        {pie ? <div className="mt-8 border-t border-linea pt-6 text-center text-tinta-suave">{pie}</div> : null}
      </section>
      <div className="relative hidden overflow-hidden rounded-[var(--t-radio-xl)] lg:block">
        <Foto nombre={foto} sizes="480px" relleno alt="" />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-estructural-profundo/95 to-transparent p-8 text-sobre-estructural">
          <p className="t-script text-3xl">Descubre el chef</p>
          <p className="t-display text-5xl">que llevas dentro!</p>
        </div>
      </div>
    </div>
  );
}

export function AvisoIndisponible() {
  return (
    <div className="shell py-16">
      <Aviso tono="error" titulo="No pudimos comprobar tu sesión">
        <p>Es un problema temporal de conexión, tu sesión sigue abierta. Vuelve a cargar la página en unos segundos.</p>
      </Aviso>
    </div>
  );
}
