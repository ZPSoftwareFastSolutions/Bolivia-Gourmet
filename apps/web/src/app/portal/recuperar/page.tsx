import type { Metadata } from 'next';
import Link from 'next/link';
import { RUTAS } from '@/lib/rutas';
import { FormularioDeRecuperacion } from '../_componentes/FormulariosDeAcceso';
import { MarcoDeAcceso } from '../_componentes/Marco';
import { salirSiHaySesion } from '../_sesion';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default async function Recuperar() {
  await salirSiHaySesion();
  return (
    <MarcoDeAcceso
      etiqueta="Portal de estudiantes"
      titulo="Recupera tu acceso"
      foto="cocteleria-preparacion"
      descripcion={<p>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>}
      pie={
        <Link href={RUTAS.acceso} className="enlace">
          Volver a iniciar sesión
        </Link>
      }
    >
      <FormularioDeRecuperacion />
    </MarcoDeAcceso>
  );
}
