/**
 * CAPA: Presentation / App
 *
 * 404 genérica. No distingue «no existe» de «no está disponible»: un error
 * distinto por causa filtraría información sobre qué rutas hay.
 */

import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="shell section">
      <p className="t-etiqueta">Error 404</p>
      <h1 className="t-display t-h1 mt-3 text-estructural">Página no encontrada</h1>
      <p className="t-lead mt-4">La dirección no existe o ya no está disponible.</p>
      <Link href="/" className="mt-8 inline-flex rounded-md bg-accion px-5 py-3 font-semibold text-sobre-accion">
        Volver al inicio
      </Link>
    </main>
  );
}
