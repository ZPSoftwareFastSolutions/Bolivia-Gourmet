/**
 * CAPA: Presentation / App — Cursos de capacitación («Aprende y emprende»,
 * línea rojo vino del folleto B).
 *
 * Los cursos son capacitación, aparte de la carrera de 3 años: por eso los
 * cursos y «¿Sueñas emprender?» viven juntos en esta página (pedido del
 * usuario). La antigua /emprende redirige aquí (next.config.ts).
 */

import type { Metadata } from 'next';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { EnlaceBoton } from '@ui/Boton';
import { BandaEmprende } from '@sections/Llamadas';
import { EncabezadoDePagina } from '@sections/Hero';
import { RejillaDeCursos } from '@sections/Oferta';

export const metadata: Metadata = {
  title: 'Cursos de capacitación',
  description:
    'Cursos cortos de capacitación, aparte de la carrera: 100 % prácticos y con matrícula gratis para aprender un oficio o emprender tu negocio. Cocina, Coctelería, Repostería y Panadería, Tortas y cursos de temporada.',
};

export default async function Cursos() {
  const programas = await catalogoAcademico().listarProgramas();
  return (
    <>
      <EncabezadoDePagina
        tono="cursos"
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Cursos' }]}
        etiqueta="Cursos de capacitación"
        script="Aprende y"
        display="emprende"
        foto="reposteria-batidora"
        descripcion={
          <p>
            Cursos cortos de capacitación, aparte de la carrera de 3 años: prácticos y con matrícula gratis, para aprender un oficio o empezar tu
            propio negocio. Sin límite de edad.
          </p>
        }
      >
        <EnlaceBoton href={RUTAS.registro} icono="flecha" iconoAlFinal>
          Inscríbete
        </EnlaceBoton>
      </EncabezadoDePagina>
      <RejillaDeCursos programas={programas} titulo={false} />
      <BandaEmprende conEnlace={false} final />
    </>
  );
}
