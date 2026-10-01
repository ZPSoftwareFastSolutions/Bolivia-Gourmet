/**
 * CAPA: Presentation / Sections
 *
 * Quiénes somos: cifras de credibilidad, los cuatro pilares del folleto
 * (Titúlate · Convalida · Practica · Aprende) y la jerarquía institucional
 * aclarada el 2026-10-01 (TEC-NIB → Bolivia Gourmet → Bolivia Gastronómica).
 * Solo cifras que están en las fuentes: «800 profesionales formados» aparece
 * en el folleto pero no en el documento, y no se publica sin confirmar.
 */

import { RUTAS } from '@/lib/rutas';
import { UNIVERSIDADES, ALIADOS } from '@contenido/convenios';
import { INSTITUTO } from '@contenido/instituto';
import type { NombreDeIcono } from '../icons/Icono';
import { EnlaceBoton } from '../ui/Boton';
import { Foto } from '../ui/Foto';
import { Insignia, TituloDeSeccion } from '../ui/Marca';

export function CifrasClave() {
  const cifras: readonly { valor: string; texto: string; icono: NombreDeIcono }[] = [
    { valor: `+${INSTITUTO.aniosDeExperiencia}`, texto: 'años formando profesionales', icono: 'gorro' },
    { valor: `${INSTITUTO.porcentajePractica} %`, texto: 'de clases prácticas', icono: 'cubiertos' },
    { valor: String(UNIVERSIDADES.length), texto: 'universidades para tu licenciatura', icono: 'graduacion' },
    { valor: String(ALIADOS.length), texto: 'hoteles, restaurantes y escuelas aliadas', icono: 'apreton' },
  ];
  return (
    <section aria-label="Cifras del instituto" className="bg-superficie-alterna">
      <ul className="shell grid grid-cols-2 gap-6 py-12 lg:grid-cols-4">
        {cifras.map((cifra) => (
          <li key={cifra.texto} className="flex items-center gap-4">
            <Insignia icono={cifra.icono} />
            <p>
              <span className="t-display block text-5xl leading-none text-estructural">{cifra.valor}</span>
              <span className="mt-1 block text-sm font-semibold text-tinta-suave">{cifra.texto}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Pilares({ conEnlace = true }: { readonly conEnlace?: boolean }) {
  return (
    <section aria-labelledby="quienes-somos" className="section bg-superficie">
      <div className="shell grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative order-2 lg:order-1">
          <div className="bloque-desplazado bloque-desplazado--azul">
            <Foto nombre="cocina-en-equipo" sizes="(min-width: 1024px) 520px, 92vw" className="aspect-[4/3] rounded-[var(--t-radio-xl)]" />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <TituloDeSeccion
            id="quienes-somos"
            etiqueta={INSTITUTO.nombreDelInstituto}
            script="¿Quiénes"
            display="somos?"
            descripcion={
              <p>
                {INSTITUTO.descripcion} Somos el área de gastronomía del{' '}
                <strong className="text-tinta">{INSTITUTO.institucionMadre.nombre}</strong> ({INSTITUTO.institucionMadre.sigla}).
              </p>
            }
          />
          {conEnlace ? (
            <EnlaceBoton href={RUTAS.nosotros} variante="contorno" className="mt-8" icono="flecha" iconoAlFinal>
              Conoce nuestra historia
            </EnlaceBoton>
          ) : null}
        </div>
      </div>

      <ul className="shell mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {INSTITUTO.pilares.map((pilar) => (
          <li key={pilar.titulo} className="relative rounded-[var(--t-radio-lg)] bg-suave px-6 pt-12 pb-7 text-center">
            <Insignia icono={pilar.icono} tamano="lg" className="absolute -top-9 left-1/2 -translate-x-1/2 ring-6 ring-superficie" />
            <h3 className="t-display text-3xl text-estructural">{pilar.titulo}</h3>
            <p className="mt-3 text-tinta-suave">{pilar.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function JerarquiaInstitucional() {
  const niveles = [
    {
      sigla: INSTITUTO.institucionMadre.sigla,
      nombre: INSTITUTO.institucionMadre.nombre,
      texto: 'La institución madre. Su escudo va bordado en la manga de cada chaqueta.',
      icono: 'escudo' as const,
    },
    {
      sigla: 'Gastronomía',
      nombre: INSTITUTO.nombreComercial,
      texto: 'El área de gastronomía del TEC-NIB: carrera técnica, cursos y capacitación para emprender.',
      icono: 'gorro' as const,
    },
    {
      sigla: 'Instituto',
      nombre: INSTITUTO.marcaSecundaria,
      texto: `${INSTITUTO.nombreDelInstituto}: forma ${INSTITUTO.tituloOtorgado.toLowerCase()} con título en Provisión Nacional.`,
      icono: 'graduacion' as const,
    },
  ];
  return (
    <section aria-labelledby="quienes-forman" className="section bg-superficie-alterna">
      <div className="shell">
        <TituloDeSeccion id="quienes-forman" etiqueta="Una sola familia" script="Tu talento," display="nuestra formación" alineacion="centro" />
        <ol className="mt-12 grid gap-6 lg:grid-cols-3">
          {niveles.map((nivel, i) => (
            <li key={nivel.nombre} className="relative rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-7">
              <div className="flex items-center gap-4">
                <Insignia icono={nivel.icono} tono={i === 0 ? 'azul' : i === 1 ? 'amarillo' : 'claro'} />
                <p className="t-etiqueta">{nivel.sigla}</p>
              </div>
              <h3 className="mt-5 text-xl font-bold text-estructural">{nivel.nombre}</h3>
              <p className="mt-2 text-tinta-suave">{nivel.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
