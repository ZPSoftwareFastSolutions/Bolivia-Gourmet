/**
 * CAPA: Presentation / App
 *
 * PÁGINA PROVISIONAL DE LA FASE 0. No es el sitio público (eso es la rama
 * `feat/pagina-web`): es una comprobación de que el catálogo académico se
 * resuelve por el composition root y de que los tokens de marca cargan. Lista
 * la oferta con «Consultar» donde el dato está pendiente, sin inventar nada.
 */

import { describirDuracion, ETIQUETA_DE_TIPO } from '@core/domain/academico/programa';
import { INSTITUTO } from '@contenido/instituto';
import { catalogoAcademico } from '@infra/config/composition-root';

export default async function PaginaProvisional() {
  const catalogo = catalogoAcademico();
  const [programas, sedes] = await Promise.all([catalogo.listarProgramas(), catalogo.listarSedes()]);

  return (
    <main className="shell section">
      <p className="t-etiqueta">Fase 0 · estructura base</p>
      <h1 className="mt-3">
        <span className="t-script t-h2 block text-estructural">Descubre</span>
        <span className="t-display t-h1 block text-estructural">el chef que llevas dentro</span>
      </h1>
      <p className="t-lead mt-4 max-w-2xl">{INSTITUTO.descripcion}</p>

      <section className="mt-12" aria-labelledby="oferta">
        <h2 id="oferta" className="t-h3">
          Oferta académica
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {programas
            .filter((p) => p.activo)
            .map((p) => (
              <li key={p.codigo} className="rounded-lg border border-linea bg-tarjeta p-4">
                <p className="t-etiqueta">{ETIQUETA_DE_TIPO[p.tipo]}</p>
                <p className="mt-1 text-lg font-bold">{p.nombre}</p>
                <p className="mt-1 text-tinta-suave">Duración: {describirDuracion(p.duracion)}</p>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="sedes">
        <h2 id="sedes" className="t-h3">
          Sedes
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {sedes.map((s) => (
            <li key={s.codigo} className="rounded-lg bg-estructural p-4 text-sobre-estructural">
              <p className="text-lg font-bold">
                {s.nombre} · {s.zona}
              </p>
              <p className="mt-1 opacity-90">{s.direccion}</p>
              <p className="mt-1 font-semibold">{s.telefono}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 inline-flex rounded-md bg-accion px-5 py-3 font-semibold text-sobre-accion">
        Sitio en construcción
      </p>
    </main>
  );
}
