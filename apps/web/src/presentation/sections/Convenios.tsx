/**
 * CAPA: Presentation / Sections
 *
 * Convenios y alianzas. El folleto los muestra en una retícula hexagonal de
 * logotipos; aquí van como tarjetas de TEXTO porque los logotipos de terceros
 * son marcas ajenas sin archivo ni autorización (docs/brand §2.3). Cuando el
 * cliente los envíe, se sustituye el contenido de cada tarjeta.
 */

import { ALIADOS, UNIVERSIDADES, type RubroDeAliado } from '@contenido/convenios';
import { INSTITUTO } from '@contenido/instituto';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { Icono, type NombreDeIcono } from '../icons/Icono';
import { EnlaceBoton } from '../ui/Boton';
import { TituloDeSeccion } from '../ui/Marca';

const ICONO_DE_RUBRO: Record<RubroDeAliado, NombreDeIcono> = {
  restaurante: 'cubiertos',
  hotel: 'hotel',
  pasteleria: 'torta',
  escuela: 'gorro',
  panaderia: 'trigo',
  industria: 'tienda',
};

export function MuroDeAliados({ compacto = false }: { readonly compacto?: boolean }) {
  return (
    <ul className={cn('grid gap-3', compacto ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-2 lg:grid-cols-3')}>
      {ALIADOS.map((aliado, i) => (
        <li
          key={aliado.nombre}
          className={cn(
            'flex items-center gap-3 rounded-[var(--t-radio-md)] border px-4',
            compacto ? 'min-h-16 justify-center text-center' : 'min-h-20',
            // Alterna blanco y azul como la retícula del folleto, sin volverla ilegible.
            i % 5 === 2 ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta',
          )}
        >
          {compacto ? null : (
            <span className={cn('inline-grid size-10 flex-none place-items-center rounded-full', i % 5 === 2 ? 'bg-accion text-sobre-accion' : 'bg-superficie-alterna text-estructural')}>
              <Icono nombre={ICONO_DE_RUBRO[aliado.rubro]} tamano={20} />
            </span>
          )}
          <span>
            <span className="block font-bold leading-tight">{aliado.nombre}</span>
            {compacto ? null : <span className={cn('text-sm', i % 5 === 2 ? 'text-sobre-estructural/80' : 'text-tinta-suave')}>{aliado.descripcion}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Universidades() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {UNIVERSIDADES.map((u) => (
        <li key={u.sigla} className="flex flex-col items-start gap-3 rounded-[var(--t-radio-lg)] border-2 border-estructural bg-tarjeta p-6">
          <span className="inline-grid size-12 place-items-center rounded-full bg-estructural text-sobre-estructural">
            <Icono nombre="graduacion" />
          </span>
          <span className="t-display text-3xl leading-none text-estructural">{u.sigla}</span>
          <span className="text-sm font-semibold text-tinta-suave">{u.nombre}</span>
        </li>
      ))}
    </ul>
  );
}

export function ConveniosResumen() {
  return (
    <section aria-labelledby="convenios" className="section bg-superficie-alterna">
      <div className="shell">
        <TituloDeSeccion
          id="convenios"
          etiqueta={`Durante ${INSTITUTO.aniosDeExperiencia} años trabajando con`}
          script="Convenios"
          display="nacionales e internacionales"
          alineacion="centro"
          descripcion={<p>Realiza tus prácticas en hoteles, restaurantes y escuelas de primer nivel, y continúa a la licenciatura.</p>}
        />
        <div className="mt-12">
          <MuroDeAliados compacto />
        </div>
        <h3 className="t-etiqueta mt-14 text-center">Convenios a nivel licenciatura</h3>
        <div className="mt-6">
          <Universidades />
        </div>
        <div className="mt-10 text-center">
          <EnlaceBoton href={RUTAS.convenios} variante="contorno" icono="flecha" iconoAlFinal>
            Ver todos los convenios
          </EnlaceBoton>
        </div>
      </div>
    </section>
  );
}
