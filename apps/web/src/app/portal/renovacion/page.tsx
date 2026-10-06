import type { Metadata } from 'next';
import { obtenerConvocatoria } from '@core/application/portal/solicitudes.usecase';
import { catalogoAcademico, portalRepository } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { AvisoIndisponible } from '../_componentes/Marco';
import { PaginaDeSolicitud } from '../_componentes/PaginaDeSolicitud';
import { exigirSesion } from '../_sesion';

export const metadata: Metadata = { title: 'Renovar gestión' };

/**
 * Renovación de gestión: pasar al 2.º o al 3.er año de la carrera en un grupo
 * en convocatoria (ADR 0009). La gestión anterior se propone desde su
 * inscripción en la carrera; quien aún no tiene historial en el sistema la
 * escribe y recepción la comprueba.
 */
export default async function Renovacion() {
  const usuario = await exigirSesion(RUTAS.renovacion);
  if (!usuario) return <AvisoIndisponible />;

  const [convocatoria, programas] = await Promise.all([
    obtenerConvocatoria(await portalRepository(usuario.id), 'renovacion'),
    catalogoAcademico().listarProgramas(),
  ]);
  if (!convocatoria.exito) {
    return (
      <div className="shell py-16">
        <Aviso tono="error" titulo="No pudimos cargar los grupos para renovar">
          <p>{convocatoria.error}</p>
        </Aviso>
      </div>
    );
  }
  const activos = programas.filter((p) => p.activo);
  return <PaginaDeSolicitud convocatoria={convocatoria.valor} programas={activos} elegido={activos.find((p) => p.tipo === 'carrera') ?? null} />;
}
