import type { Metadata } from 'next';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { AvisoIndisponible } from '../_componentes/Marco';
import { PaginaDeSolicitud } from '../_componentes/PaginaDeSolicitud';
import { exigirSesion } from '../_sesion';

export const metadata: Metadata = { title: 'Renovar gestión' };

/**
 * Renovación de gestión para antiguos alumnos. Muchos no tendrán todavía su
 * historial en el sistema: la solicitud dice de qué gestión vienen y
 * recepción lo comprueba.
 */
export default async function Renovacion({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const codigo = typeof parametros.programa === 'string' ? parametros.programa : '';
  const usuario = await exigirSesion(codigo ? `${RUTAS.renovacion}?programa=${encodeURIComponent(codigo)}` : RUTAS.renovacion);
  if (!usuario) return <AvisoIndisponible />;

  const catalogo = catalogoAcademico();
  const [programas, sedes, elegido] = await Promise.all([
    catalogo.listarProgramas(),
    catalogo.listarSedes(),
    codigo ? catalogo.programaPorCodigo(codigo) : Promise.resolve(null),
  ]);
  return (
    <PaginaDeSolicitud
      tipo="renovacion"
      programas={programas}
      sedes={sedes.filter((s) => s.activa)}
      elegido={elegido && elegido.activo ? elegido : null}
    />
  );
}
