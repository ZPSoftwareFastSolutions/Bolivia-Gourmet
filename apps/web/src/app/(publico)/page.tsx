/**
 * CAPA: Presentation / App — Inicio.
 *
 * Solo lo que engancha (pedido del usuario, 2026-10-05), en el orden de la
 * skill ui-ux-pro-max («Trust & Authority + Conversion»): portada con la
 * acción principal → cifras de credibilidad → la carrera → cursos de
 * capacitación con «¿Sueñas emprender?» (UNA sección: antes eran dos que
 * llevaban al mismo lugar) → convenios (prueba social) → llamada final.
 * «¿Quiénes somos?» y la galería siguen completas en /nosotros; las tarjetas
 * de cada curso, en /cursos.
 */

import { redirect } from 'next/navigation';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { RUTAS } from '@/lib/rutas';
import { catalogoAcademico } from '@infra/config/composition-root';
import { ConveniosResumen } from '@sections/Convenios';
import { HeroInicio } from '@sections/Hero';
import { CifrasClave } from '@sections/Institucion';
import { LlamadaInscripcion } from '@sections/Llamadas';
import { CarreraDestacada, CursosParaEmprender } from '@sections/Oferta';

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
      {carrera ? <CarreraDestacada carrera={carrera} /> : null}
      <CursosParaEmprender programas={programas} />
      <ConveniosResumen />
      <LlamadaInscripcion carrera={carrera} sedes={sedes.filter((s) => s.activa)} />
    </>
  );
}
