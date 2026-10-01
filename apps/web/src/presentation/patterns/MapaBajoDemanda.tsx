'use client';

/**
 * CAPA: Presentation / Patterns (cliente)
 *
 * Mapa de Google que se carga SOLO al pulsar. Hasta entonces no se pide nada
 * a Google: ni cookies de terceros ni rastreo para quien solo quería leer la
 * dirección, y la página no paga el peso del iframe. La CSP permite
 * `frame-src https://www.google.com` y nada más.
 *
 * Si la sede tiene ubicación confirmada (el lugar de Google Maps que publica
 * el instituto), el mapa se centra en sus coordenadas y «Abrir en Google
 * Maps» usa su enlace. Si no, se busca por la dirección escrita: nunca una
 * coordenada inventada, que pondría el pin en otro edificio.
 */

import { useState } from 'react';
import type { UbicacionDeSede } from '@core/domain/shared/sede';
import { direccionesDeMapa } from '@/lib/mapas';
import { Icono } from '../icons/Icono';

export function MapaBajoDemanda({
  direccion,
  nombre,
  ubicacion,
}: {
  readonly direccion: string;
  readonly nombre: string;
  readonly ubicacion?: UbicacionDeSede;
}) {
  const [visible, setVisible] = useState(false);
  const { incrustado, externo: enlaceExterno } = direccionesDeMapa(direccion, ubicacion);
  // Sigue a mano después de cargar el mapa: el enlace del iframe abre unas
  // coordenadas sueltas, este abre el lugar del instituto.
  const abrirEnGoogleMaps = (
    <a
      href={enlaceExterno}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-estructural px-4 font-semibold text-estructural hover:bg-estructural hover:text-sobre-estructural"
    >
      Abrir en Google Maps
      <Icono nombre="externo" tamano={16} />
    </a>
  );

  if (visible) {
    return (
      <div>
        <iframe
          title={`Mapa de la sede ${nombre}`}
          src={incrustado}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="aspect-[4/3] w-full rounded-[var(--t-radio-md)] border-0"
        />
        <div className="mt-3 flex justify-center">{abrirEnGoogleMaps}</div>
      </div>
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
          {abrirEnGoogleMaps}
        </div>
      </div>
    </div>
  );
}
