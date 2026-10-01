'use client';

/**
 * CAPA: Presentation / Patterns (cliente)
 *
 * Mapa de Google que se carga SOLO al pulsar. Hasta entonces no se pide nada
 * a Google: ni cookies de terceros ni rastreo para quien solo quería leer la
 * dirección, y la página no paga el peso del iframe. La CSP permite
 * `frame-src https://www.google.com` y nada más.
 *
 * La búsqueda es por dirección escrita: no hay coordenadas confirmadas de las
 * sedes y una coordenada inventada pondría el pin en otro edificio.
 */

import { useState } from 'react';
import { Icono } from '../icons/Icono';

export function MapaBajoDemanda({ direccion, nombre }: { readonly direccion: string; readonly nombre: string }) {
  const [visible, setVisible] = useState(false);
  const consulta = encodeURIComponent(`${direccion}, Bolivia`);

  if (visible) {
    return (
      <iframe
        title={`Mapa de la sede ${nombre}`}
        src={`https://www.google.com/maps?q=${consulta}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-[4/3] w-full rounded-[var(--t-radio-md)] border-0"
      />
    );
  }

  return (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-[var(--t-radio-md)] bg-superficie-alterna p-6 text-center">
      <div>
        <span className="mx-auto inline-grid size-12 place-items-center rounded-full bg-estructural text-sobre-estructural">
          <Icono nombre="pin" />
        </span>
        <p className="mt-3 text-sm text-tinta-suave">El mapa se carga desde Google solo si lo pides.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-estructural px-4 font-semibold text-sobre-estructural hover:bg-estructural-profundo"
          >
            Ver mapa
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${consulta}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-estructural px-4 font-semibold text-estructural hover:bg-estructural hover:text-sobre-estructural"
          >
            Abrir en Google Maps
            <Icono nombre="externo" tamano={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
