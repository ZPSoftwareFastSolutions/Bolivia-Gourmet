/**
 * CAPA: Presentation / App — Nosotros.
 *
 * La jerarquía aclarada el 2026-10-01: TEC-NIB (madre) → Corporación Bolivia
 * Gourmet (área de gastronomía) → Bolivia Gastronómica (instituto). El
 * fundador aparece sin foto: no se ha recibido ninguna (aclaraciones §8).
 */

import type { Metadata } from 'next';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { EnlaceBoton } from '@ui/Boton';
import { Insignia } from '@ui/Marca';
import { EncabezadoDePagina } from '@sections/Hero';
import { CifrasClave, JerarquiaInstitucional, Pilares } from '@sections/Institucion';
import { GaleriaCocinaConPasion, LlamadaInscripcion } from '@sections/Llamadas';
import { catalogoAcademico } from '@infra/config/composition-root';

export const metadata: Metadata = {
  title: 'Nosotros',
  description: `${INSTITUTO.descripcion} Área de gastronomía del ${INSTITUTO.institucionMadre.nombre}.`,
};

export default async function Nosotros() {
  const catalogo = catalogoAcademico();
  const [programas, sedes] = await Promise.all([catalogo.listarProgramas(), catalogo.listarSedes()]);
  const carrera = programas.find((p) => p.tipo === 'carrera') ?? null;

  return (
    <>
      <EncabezadoDePagina
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Nosotros' }]}
        etiqueta={INSTITUTO.nombreComercial}
        script="Descubre el chef"
        display="que llevas"
        resaltado="dentro!"
        foto="kit-de-cuchillos"
        descripcion={<p>{INSTITUTO.descripcion}</p>}
      />
      <CifrasClave />
      <section aria-labelledby="fundador" className="section bg-superficie">
        <div className="shell grid items-center gap-10 rounded-[var(--t-radio-xl)] border-2 border-linea p-8 sm:p-12 lg:grid-cols-[auto_1fr]">
          <Insignia icono="gorro" tamano="lg" tono="amarillo" />
          <div>
            <p className="t-etiqueta">Fundador</p>
            <h2 id="fundador" className="t-display t-h2 mt-2 text-estructural">
              {INSTITUTO.fundador}
            </h2>
            <p className="t-lead mt-4 max-w-3xl">
              Fundó el instituto hace más de {INSTITUTO.aniosDeExperiencia} años con una idea sencilla: que la gastronomía se aprende
              cocinando. Por eso las clases son {INSTITUTO.porcentajePractica} % prácticas y {INSTITUTO.porcentajeTeoria} % teóricas.
            </p>
            <EnlaceBoton href={RUTAS.carrera} variante="contorno" className="mt-7" icono="flecha" iconoAlFinal>
              Conoce la carrera
            </EnlaceBoton>
          </div>
        </div>
      </section>
      <JerarquiaInstitucional />
      <Pilares conEnlace={false} />
      <GaleriaCocinaConPasion />
      <LlamadaInscripcion carrera={carrera} sedes={sedes.filter((s) => s.activa)} />
    </>
  );
}
