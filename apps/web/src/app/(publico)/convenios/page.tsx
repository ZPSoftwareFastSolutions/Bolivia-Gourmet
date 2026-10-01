/**
 * CAPA: Presentation / App — Convenios y alianzas.
 */

import type { Metadata } from 'next';
import { RUTAS } from '@/lib/rutas';
import { ALIADOS, UNIVERSIDADES } from '@contenido/convenios';
import { INSTITUTO } from '@contenido/instituto';
import { EnlaceBoton } from '@ui/Boton';
import { TituloDeSeccion } from '@ui/Marca';
import { MuroDeAliados, Universidades } from '@sections/Convenios';
import { EncabezadoDePagina } from '@sections/Hero';

export const metadata: Metadata = {
  title: 'Convenios y alianzas',
  description: `${ALIADOS.length} hoteles, restaurantes y escuelas aliadas para tus prácticas y ${UNIVERSIDADES.length} universidades para continuar a la licenciatura.`,
};

export default function Convenios() {
  return (
    <>
      <EncabezadoDePagina
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Convenios' }]}
        etiqueta={`Durante ${INSTITUTO.aniosDeExperiencia} años trabajando con`}
        script="Convenios"
        display="nacionales e"
        resaltado="internacionales"
        foto="estudiantes-con-platos"
        descripcion={<p>Tus prácticas laborales en los mejores hoteles y restaurantes, y el camino abierto a la licenciatura.</p>}
      />

      <section aria-labelledby="aliados" className="section bg-superficie">
        <div className="shell">
          <TituloDeSeccion
            id="aliados"
            etiqueta="Prácticas laborales"
            display="Hoteles, restaurantes"
            resaltado="y escuelas"
            descripcion={<p>Empresas con las que el instituto trabaja para que practiques donde se cocina en serio.</p>}
          />
          <div className="mt-12">
            <MuroDeAliados />
          </div>
        </div>
      </section>

      <section aria-labelledby="universidades" className="section bg-superficie-alterna">
        <div className="shell">
          <TituloDeSeccion
            id="universidades"
            etiqueta="Convalidación"
            script="Convenios a nivel"
            display="licenciatura"
            descripcion={<p>Al concluir la carrera de {INSTITUTO.tituloOtorgado.toLowerCase()} puedes convalidar materias y sacar tu licenciatura en Gastronomía.</p>}
          />
          <div className="mt-12">
            <Universidades />
          </div>
          <div className="mt-12">
            <EnlaceBoton href={RUTAS.carrera} icono="flecha" iconoAlFinal>
              Conoce la carrera
            </EnlaceBoton>
          </div>
        </div>
      </section>
    </>
  );
}
