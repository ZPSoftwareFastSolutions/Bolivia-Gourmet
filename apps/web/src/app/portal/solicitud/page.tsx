import type { Metadata } from 'next';
import { obtenerConvocatoria } from '@core/application/portal/solicitudes.usecase';
import { catalogoAcademico, portalRepository } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { AvisoIndisponible } from '../_componentes/Marco';
import { PaginaDeSolicitud } from '../_componentes/PaginaDeSolicitud';
import { exigirSesion } from '../_sesion';

export const metadata: Metadata = { title: 'Nueva inscripción' };

/**
 * Nueva inscripción por convocatoria (ADR 0009): primero lo que la persona ya
 * cursa, después solo los programas con inscripciones abiertas y, al elegir
 * uno, su ficha y sus grupos.
 */
export default async function NuevaSolicitud({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const codigo = typeof parametros.programa === 'string' ? parametros.programa : '';
  const usuario = await exigirSesion(codigo ? `${RUTAS.solicitud}?programa=${encodeURIComponent(codigo)}` : RUTAS.solicitud);
  if (!usuario) return <AvisoIndisponible />;

  const catalogo = catalogoAcademico();
  const [convocatoria, programas, elegido] = await Promise.all([
    obtenerConvocatoria(await portalRepository(usuario.id), 'inscripcion'),
    catalogo.listarProgramas(),
    codigo ? catalogo.programaPorCodigo(codigo) : Promise.resolve(null),
  ]);
  if (!convocatoria.exito) {
    return (
      <div className="shell py-16">
        <Aviso tono="error" titulo="No pudimos cargar las inscripciones abiertas">
          <p>{convocatoria.error}</p>
        </Aviso>
      </div>
    );
  }
  return (
    <PaginaDeSolicitud
      convocatoria={convocatoria.valor}
      programas={programas.filter((p) => p.activo)}
      elegido={elegido && elegido.activo ? elegido : null}
    />
  );
}
