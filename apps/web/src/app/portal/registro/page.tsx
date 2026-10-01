import type { Metadata } from 'next';
import Link from 'next/link';
import { RUTAS } from '@/lib/rutas';
import { FormularioDeRegistro } from '../_componentes/FormulariosDeAcceso';
import { MarcoDeAcceso } from '../_componentes/Marco';
import { salirSiHaySesion } from '../_sesion';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function Registro() {
  await salirSiHaySesion();
  return (
    <MarcoDeAcceso
      etiqueta="Portal de estudiantes"
      script="Empieza"
      titulo="tu inscripción"
      foto="cocina-en-equipo"
      descripcion={<p>Crea tu cuenta para solicitar tu inscripción a la carrera o a un curso, y seguir su estado desde aquí.</p>}
      pie={
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link href={RUTAS.acceso} className="enlace">
            Inicia sesión
          </Link>
        </p>
      }
    >
      <FormularioDeRegistro />
    </MarcoDeAcceso>
  );
}
