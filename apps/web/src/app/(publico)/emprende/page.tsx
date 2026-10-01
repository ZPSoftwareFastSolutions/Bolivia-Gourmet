/**
 * CAPA: Presentation / App — ¿Sueñas emprender? (folleto B).
 */

import type { Metadata } from 'next';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { EnlaceBoton } from '@ui/Boton';
import { BandaEmprende } from '@sections/Llamadas';
import { EncabezadoDePagina } from '@sections/Hero';
import { RejillaDeCursos } from '@sections/Oferta';

export const metadata: Metadata = {
  title: '¿Sueñas emprender?',
  description: INSTITUTO.emprende.texto,
};

export default async function Emprende() {
  const programas = await catalogoAcademico().listarProgramas();
  return (
    <>
      <EncabezadoDePagina
        tono="cursos"
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Emprende' }]}
        etiqueta="Capacitación para emprender"
        script="Aprende y"
        display="emprende"
        foto="cocina-en-equipo"
        descripcion={<p>{INSTITUTO.emprende.texto}</p>}
      >
        <EnlaceBoton href={RUTAS.registro} icono="flecha" iconoAlFinal>
          Empieza hoy
        </EnlaceBoton>
      </EncabezadoDePagina>
      <BandaEmprende conEnlace={false} />
      <RejillaDeCursos programas={programas} />
    </>
  );
}
