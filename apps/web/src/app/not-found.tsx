/**
 * CAPA: Presentation / App — 404 genérica.
 *
 * No distingue «no existe» de «no está disponible»: un mensaje distinto por
 * causa filtraría qué rutas hay. Queda fuera de los layouts del sitio, así
 * que lleva sus propios logotipos y salidas.
 */

import Link from 'next/link';
import { RUTAS } from '@/lib/rutas';
import { EnlaceBoton } from '@ui/Boton';
import { Logos } from '@ui/Logos';

export default function NoEncontrado() {
  return (
    <main id="contenido" className="flex flex-1 flex-col">
      <header className="border-b border-linea">
        <div className="shell flex min-h-18 items-center py-3">
          <Link href={RUTAS.inicio} aria-label="Ir al inicio">
            <Logos tamano="portal" />
          </Link>
        </div>
      </header>
      <section className="shell section flex flex-1 flex-col justify-center">
        <p className="t-etiqueta">Error 404</p>
        <h1 className="mt-3 text-estructural">
          <span className="t-script block text-4xl">¡Ups!</span>
          <span className="t-display t-h1 block">
            Esta receta <span className="marca-resaltado">no existe</span>
          </span>
        </h1>
        <p className="t-lead mt-5 max-w-xl">La dirección no existe o ya no está disponible. Vuelve al inicio o mira nuestra oferta.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <EnlaceBoton href={RUTAS.inicio} icono="flechaIzquierda">
            Volver al inicio
          </EnlaceBoton>
          <EnlaceBoton href={RUTAS.cursos} variante="contorno">
            Ver cursos
          </EnlaceBoton>
        </div>
      </section>
    </main>
  );
}
