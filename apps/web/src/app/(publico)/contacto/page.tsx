/**
 * CAPA: Presentation / App — Contacto y sedes.
 *
 * Sin formulario de contacto anónimo a propósito: sin captcha ni base para
 * gestionarlo, sería una puerta abierta al spam. El canal es WhatsApp (el que
 * ya usa el instituto) y, para inscribirse, el portal con cuenta.
 */

import type { Metadata } from 'next';
import { enlaceDeWhatsApp } from '@core/domain/shared/sede';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '@/presentation/icons/Icono';
import { MapaBajoDemanda } from '@patterns/MapaBajoDemanda';
import { RedesSociales } from '@patterns/RedesSociales';
import { EnlaceBoton } from '@ui/Boton';
import { TituloDeSeccion } from '@ui/Marca';
import { EncabezadoDePagina } from '@sections/Hero';

export const metadata: Metadata = {
  title: 'Contacto y sedes',
  description: 'Sedes en La Paz (Miraflores) y El Alto (La Ceja). Escríbenos por WhatsApp o visítanos.',
};

export default async function Contacto() {
  const sedes = (await catalogoAcademico().listarSedes()).filter((s) => s.activa);
  return (
    <>
      <EncabezadoDePagina
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Contacto' }]}
        etiqueta="Contacto"
        script="Visítanos o"
        display="escríbenos"
        descripcion={<p>Dos sedes para atenderte. Escríbenos por WhatsApp y te respondemos con fechas, horarios y costos.</p>}
      />

      <section aria-labelledby="sedes" className="section bg-superficie">
        <div className="shell">
          <h2 id="sedes" className="sr-only">
            Nuestras sedes
          </h2>
          <ul className="grid gap-8 lg:grid-cols-2">
            {sedes.map((sede) => (
              <li key={sede.codigo} className="overflow-hidden rounded-[var(--t-radio-xl)] border-2 border-linea bg-tarjeta">
                <div className="bg-estructural p-6 text-sobre-estructural">
                  <p className="t-etiqueta text-accion">Central {sede.nombre}</p>
                  <h3 className="t-display mt-1 text-4xl">
                    {sede.nombre} · {sede.zona}
                  </h3>
                </div>
                <div className="grid gap-6 p-6">
                  <p className="flex items-start gap-3 text-tinta">
                    <Icono nombre="pin" className="mt-0.5 flex-none text-estructural" />
                    <span>{sede.direccion}</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <EnlaceBoton
                      href={enlaceDeWhatsApp(sede.telefono, `Hola, quiero información de ${INSTITUTO.nombreCorto} (sede ${sede.nombre}).`)}
                      externo
                      icono="whatsapp"
                    >
                      WhatsApp {sede.telefono}
                    </EnlaceBoton>
                    <EnlaceBoton href={`tel:+591${sede.telefono}`} variante="contorno" icono="telefono">
                      Llamar
                    </EnlaceBoton>
                  </div>
                  <MapaBajoDemanda direccion={`${sede.direccion}, ${sede.nombre}`} nombre={sede.nombre} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="redes" className="section bg-superficie-alterna">
        <div className="shell grid gap-10 lg:grid-cols-2 lg:items-center">
          <TituloDeSeccion
            id="redes"
            etiqueta="Síguenos"
            display="En nuestras"
            resaltado="redes"
            descripcion={<p>Recetas, clases y novedades de {INSTITUTO.nombreCorto}.</p>}
          />
          <RedesSociales conNombre className="text-lg font-semibold text-estructural" />
        </div>
      </section>

      <section aria-labelledby="portal" className="section bg-superficie">
        <div className="shell flex flex-col items-start gap-6 rounded-[var(--t-radio-xl)] bg-accion p-8 text-sobre-accion sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="portal" className="t-display t-h2">
              ¿Listo para inscribirte?
            </h2>
            <p className="mt-2 max-w-xl text-lg">Crea tu cuenta, envía tu solicitud y sigue su estado desde el portal de estudiantes.</p>
          </div>
          <EnlaceBoton href={RUTAS.registro} variante="secundario" tamano="lg" icono="flecha" iconoAlFinal>
            Crear mi cuenta
          </EnlaceBoton>
        </div>
      </section>
    </>
  );
}
