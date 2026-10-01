import type { Metadata } from 'next';
import Link from 'next/link';
import { RUTAS } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { FormularioDeNuevaClave } from '../_componentes/FormulariosDeAcceso';
import { MarcoDeAcceso } from '../_componentes/Marco';
import { estadoDeSesion } from '../_sesion';

export const metadata: Metadata = { title: 'Nueva contraseña' };

/**
 * Se llega desde el enlace de recuperación: `/auth/confirmar` ya canjeó el
 * enlace por una sesión. Sin sesión, el enlace caducó.
 */
export default async function NuevaClave() {
  const sesion = await estadoDeSesion();
  return (
    <MarcoDeAcceso etiqueta="Portal de estudiantes" titulo="Nueva contraseña" foto="emplatado-con-pinzas">
      {sesion.estado === 'autenticado' ? (
        <FormularioDeNuevaClave />
      ) : (
        <Aviso tono="error" titulo="El enlace caducó o ya se usó">
          <p>
            Pide uno nuevo desde{' '}
            <Link href={RUTAS.recuperar} className="enlace">
              recuperar contraseña
            </Link>
            .
          </p>
        </Aviso>
      )}
    </MarcoDeAcceso>
  );
}
