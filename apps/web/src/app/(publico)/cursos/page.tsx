/**
 * CAPA: Presentation / App — Cursos y especialidades (línea rojo vino del
 * folleto B: «Aprende y emprende»).
 */

import type { Metadata } from 'next';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { EnlaceBoton } from '@ui/Boton';
import { BandaEmprende } from '@sections/Llamadas';
import { EncabezadoDePagina } from '@sections/Hero';
import { RejillaDeCursos } from '@sections/Oferta';

export const metadata: Metadata = {
  title: 'Cursos y especialidades',
  description: 'Cursos cortos 100 % prácticos con matrícula gratis: Cocina, Coctelería, Repostería y Panadería, Tortas y cursos de temporada.',
};

export default async function Cursos() {
  const programas = await catalogoAcademico().listarProgramas();
  return (
    <>
      <EncabezadoDePagina
        tono="cursos"
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Cursos' }]}
        etiqueta="Cursos y especialidades"
        script="Aprende y"
        display="emprende"
        foto="reposteria-batidora"
        descripcion={<p>Cursos cortos y prácticos, con matrícula gratis, para aprender un oficio o empezar tu propio negocio. Sin límite de edad.</p>}
      >
        <EnlaceBoton href={RUTAS.registro} icono="flecha" iconoAlFinal>
          Inscríbete
        </EnlaceBoton>
      </EncabezadoDePagina>
      <RejillaDeCursos programas={programas} titulo={false} />
      <BandaEmprende />
    </>
  );
}
