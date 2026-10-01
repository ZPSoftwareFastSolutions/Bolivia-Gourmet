/**
 * CAPA: Presentation / Patterns
 *
 * Botón flotante de WhatsApp. Hay DOS sedes con número propio, así que abre
 * un pequeño menú para elegir (sobre `<details>`: sin JavaScript). Mandar a
 * todos al número de La Paz haría que quien vive en El Alto escriba a la sede
 * equivocada.
 */

import { enlaceDeWhatsApp, type Sede } from '@core/domain/shared/sede';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '../icons/Icono';

export function WhatsAppFlotante({ sedes }: { readonly sedes: readonly Sede[] }) {
  return (
    <details className="sin-marcador group fixed end-4 bottom-4 z-30 sm:end-6 sm:bottom-6">
      <summary
        aria-label="Escríbenos por WhatsApp"
        className="ms-auto inline-grid size-14 place-items-center rounded-full bg-exito text-sobre-estructural shadow-[0_10px_24px_-8px_var(--t-estructural)] transition-transform duration-200 hover:scale-105"
      >
        <Icono nombre="whatsapp" tamano={28} className="group-open:hidden" />
        <Icono nombre="cerrar" tamano={26} className="hidden group-open:block" />
      </summary>
      <div className="absolute end-0 bottom-16 w-64 rounded-lg bg-tarjeta p-2 shadow-[0_18px_40px_-16px_var(--t-estructural)] ring-1 ring-linea">
        <p className="px-3 pt-2 pb-1 text-sm font-semibold text-tinta">¿A qué sede escribes?</p>
        <ul>
          {sedes.map((sede) => (
            <li key={sede.codigo}>
              <a
                href={enlaceDeWhatsApp(sede.telefono, `Hola, quiero información de ${INSTITUTO.nombreCorto} (sede ${sede.nombre}).`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-between gap-3 rounded-md px-3 text-tinta hover:bg-superficie-alterna"
              >
                <span>
                  <span className="block font-bold text-estructural">{sede.nombre}</span>
                  <span className="text-sm text-tinta-suave">{sede.telefono}</span>
                </span>
                <Icono nombre="externo" tamano={18} className="text-tinta-suave" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
