/**
 * CAPA: Presentation / Patterns (organismo)
 *
 * Pie con la «cinta de contacto» del folleto: teléfonos grandes y las dos
 * direcciones. Los logotipos van en una banda BLANCA porque sus letras son
 * negras y no existe todavía versión invertida (docs/brand §14).
 */

import Link from 'next/link';
import { enlaceDeWhatsApp, type Sede } from '@core/domain/shared/sede';
import { NAVEGACION, RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '../icons/Icono';
import { Logos } from '../ui/Logos';
import { SeparadorOndulado } from '../ui/Marca';
import { RedesSociales } from './RedesSociales';

export function Pie({ sedes }: { readonly sedes: readonly Sede[] }) {
  return (
    <footer className="mt-auto">
      <SeparadorOndulado className="text-estructural" />
      <div className="bg-estructural text-sobre-estructural">
        <div className="shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.4fr]">
          <div>
            <p className="t-script text-3xl text-accion">{INSTITUTO.lemasSecundarios.futuro}</p>
            <p className="mt-4 max-w-sm text-sobre-estructural/85">
              {INSTITUTO.nombreComercial} es el área de gastronomía del {INSTITUTO.institucionMadre.nombre} ({INSTITUTO.institucionMadre.sigla}).
            </p>
            <RedesSociales className="mt-5 -ms-2" />
          </div>

          <nav aria-label="Pie de página">
            <h2 className="t-etiqueta text-accion">Explora</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 lg:grid-cols-1">
              {NAVEGACION.map((enlace) => (
                <li key={enlace.href}>
                  <Link href={enlace.href} className="inline-flex min-h-10 items-center hover:text-accion">
                    {enlace.etiqueta}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={RUTAS.acceso} className="inline-flex min-h-10 items-center hover:text-accion">
                  Portal de estudiantes
                </Link>
              </li>
            </ul>
          </nav>

          <div className="md:col-span-2 lg:col-span-1">
            <h2 className="t-etiqueta text-accion">Nuestras sedes</h2>
            <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {sedes.map((sede) => (
                <li key={sede.codigo} className="flex gap-3">
                  <span className="mt-1 inline-grid size-9 flex-none place-items-center rounded-full bg-accion text-sobre-accion">
                    <Icono nombre="pin" tamano={18} />
                  </span>
                  <div>
                    <p className="font-bold">
                      {sede.nombre} · {sede.zona}
                    </p>
                    <p className="text-sm text-sobre-estructural/85">{sede.direccion}</p>
                    <a
                      href={enlaceDeWhatsApp(sede.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-10 items-center gap-2 text-xl font-bold tracking-wide hover:text-accion"
                    >
                      <Icono nombre="telefono" tamano={18} />
                      {sede.telefono}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-superficie text-tinta">
          {/* El botón flotante de WhatsApp no debe tapar el copyright: en el móvil,
              sitio libre debajo; en pantallas medianas, a la derecha (en las anchas ya
              queda fuera del contenedor). */}
          <div className="shell flex flex-col items-center justify-between gap-4 pt-6 pb-20 md:flex-row md:pb-6 md:max-[84rem]:pe-24">
            <Logos tamano="pie" />
            <div className="text-center text-sm text-tinta-suave md:text-end">
              <p>
                © {new Date().getFullYear()} {INSTITUTO.nombreComercial} · {INSTITUTO.institucionMadre.sigla}
              </p>
              <p className="mt-1">
                <Link href={RUTAS.privacidad} className="enlace">
                  Aviso de privacidad
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
