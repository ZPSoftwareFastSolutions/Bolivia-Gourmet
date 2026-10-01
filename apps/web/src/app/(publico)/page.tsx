/**
 * CAPA: Presentation / App — Inicio.
 *
 * Orden de secciones (skill ui-ux-pro-max, «Trust & Authority + Conversion»):
 * portada con la acción principal → cifras de credibilidad → quiénes somos →
 * carrera → cursos → galería → convenios (prueba social) → emprende →
 * llamada final. La acción «Inscríbete» aparece arriba, a media página y al
 * final.
 */

import { redirect } from 'next/navigation';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { RUTAS } from '@/lib/rutas';
import { catalogoAcademico } from '@infra/config/composition-root';
import { ConveniosResumen } from '@sections/Convenios';
import { HeroInicio } from '@sections/Hero';
import { CifrasClave, Pilares } from '@sections/Institucion';
import { BandaEmprende, GaleriaCocinaConPasion, LlamadaInscripcion } from '@sections/Llamadas';
import { CarreraDestacada, RejillaDeCursos } from '@sections/Oferta';

export default async function Inicio({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Si la URL de retorno de Supabase Auth no está autorizada, el enlace del
  // correo vuelve a la RAÍZ del sitio con `?code=`. Se reenvía al canje para
  // que la confirmación funcione aunque falte esa configuración (E2.D1).
  const { code } = await searchParams;
  if (typeof code === 'string' && code.length > 0) {
    redirect(`${RUTAS.confirmar}?code=${encodeURIComponent(code)}&siguiente=${encodeURIComponent(RUTAS.portal)}`);
  }

  const catalogo = catalogoAcademico();
  const [programas, sedes] = await Promise.all([catalogo.listarProgramas(), catalogo.listarSedes()]);
  const carrera = programas.find((p) => p.tipo === 'carrera' && p.activo) ?? null;
  const inicio = carrera && !esPendiente(carrera.inicioPublicado) ? carrera.inicioPublicado : null;

  return (
    <>
      <HeroInicio inicioDeClases={inicio} />
      <CifrasClave />
      <Pilares />
      {carrera ? <CarreraDestacada carrera={carrera} /> : null}
      <RejillaDeCursos programas={programas} />
      <GaleriaCocinaConPasion />
      <ConveniosResumen />
      <BandaEmprende />
      <LlamadaInscripcion carrera={carrera} sedes={sedes.filter((s) => s.activa)} />
    </>
  );
}
