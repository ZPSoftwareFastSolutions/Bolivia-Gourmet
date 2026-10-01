import type { Metadata } from 'next';
import Link from 'next/link';
import { destinoSeguro } from '@/lib/redirecciones';
import { RUTAS } from '@/lib/rutas';
import { FormularioDeAcceso } from '../_componentes/FormulariosDeAcceso';
import { MarcoDeAcceso } from '../_componentes/Marco';
import { salirSiHaySesion } from '../_sesion';

export const metadata: Metadata = { title: 'Iniciar sesión' };

const AVISOS: Record<string, string> = {
  enlace: 'El enlace del correo caducó o ya se usó. Inicia sesión, o pide uno nuevo desde «¿Olvidaste tu contraseña?».',
  confirmado: 'Tu correo quedó confirmado. Ya puedes iniciar sesión.',
};

export default async function Acceso({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await salirSiHaySesion();
  const parametros = await searchParams;
  const siguiente = destinoSeguro(typeof parametros.siguiente === 'string' ? parametros.siguiente : null);
  const aviso = typeof parametros.aviso === 'string' ? AVISOS[parametros.aviso] : undefined;

  return (
    <MarcoDeAcceso
      etiqueta="Portal de estudiantes"
      script="Bienvenido de"
      titulo="nuevo"
      descripcion={<p>Entra para ver tus solicitudes de inscripción y renovación.</p>}
      pie={
        <p>
          ¿Aún no tienes cuenta?{' '}
          <Link href={RUTAS.registro} className="enlace">
            Créala aquí
          </Link>
        </p>
      }
    >
      <FormularioDeAcceso siguiente={siguiente} aviso={aviso} />
    </MarcoDeAcceso>
  );
}
