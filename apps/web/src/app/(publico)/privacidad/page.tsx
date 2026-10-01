/**
 * CAPA: Presentation / App — Aviso de privacidad.
 *
 * El portal recoge datos personales (nombre, carnet, teléfono, correo); quien
 * los entrega tiene derecho a saber para qué y cómo pedir que se corrijan o
 * borren. BORRADOR: debe revisarlo el cliente (y, si lo desea, su asesoría
 * legal) antes de publicar con dominio propio.
 */

import type { Metadata } from 'next';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { EncabezadoDePagina } from '@sections/Hero';

export const metadata: Metadata = {
  title: 'Aviso de privacidad',
  description: `Qué datos recoge el portal de estudiantes de ${INSTITUTO.nombreCorto}, para qué y cómo ejercer tus derechos.`,
};

export default async function Privacidad() {
  const sedes = (await catalogoAcademico().listarSedes()).filter((s) => s.activa);
  return (
    <>
      <EncabezadoDePagina
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Aviso de privacidad' }]}
        etiqueta="Tus datos"
        display="Aviso de"
        resaltado="privacidad"
        descripcion={<p>Versión de demostración del 1 de octubre de 2026, pendiente de revisión por la institución.</p>}
      />
      <article className="section bg-superficie">
        <div className="shell max-w-3xl space-y-8 text-tinta [&_h2]:font-display [&_h2]:uppercase [&_h2]:text-3xl [&_h2]:text-estructural [&_p]:mt-3 [&_p]:text-tinta-suave [&_li]:text-tinta-suave">
          <section>
            <h2>Quién es responsable</h2>
            <p>
              {INSTITUTO.nombreComercial}, área de gastronomía del {INSTITUTO.institucionMadre.nombre} ({INSTITUTO.institucionMadre.sigla}),
              con sedes en {sedes.map((s) => `${s.nombre} (${s.direccion})`).join(' y ')}.
            </p>
          </section>
          <section>
            <h2>Qué datos recogemos</h2>
            <p>
              Solo cuando creas una cuenta en el portal de estudiantes: nombres, apellidos, correo electrónico, y de forma opcional tu
              teléfono y número de carnet de identidad. Cuando envías una solicitud, el programa, la sede, el horario elegido y el mensaje
              que escribas. El sitio público no usa cookies de seguimiento ni analítica de terceros.
            </p>
          </section>
          <section>
            <h2>Para qué los usamos</h2>
            <p>
              Para gestionar tu solicitud de inscripción o renovación, contactarte sobre ella y mantener tu cuenta. No vendemos ni cedemos
              tus datos a terceros ni los usamos para publicidad.
            </p>
          </section>
          <section>
            <h2>Cómo los protegemos</h2>
            <p>
              Tus datos se guardan en una base de datos con control de acceso por fila: cada estudiante solo puede ver los suyos, y solo
              el personal de recepción y administración puede ver las solicitudes para atenderlas. La sesión viaja cifrada y la cookie no
              es accesible desde el código de la página. Tu contraseña no la conoce nadie del instituto.
            </p>
          </section>
          <section>
            <h2>Cookies</h2>
            <p>
              Usamos únicamente las cookies necesarias para mantener tu sesión en el portal. El mapa de Google de la página de contacto solo
              se carga si pulsas «Ver mapa».
            </p>
          </section>
          <section>
            <h2>Tus derechos</h2>
            <p>
              Puedes pedir en cualquier momento acceder a tus datos, corregirlos o eliminar tu cuenta. Escríbenos por WhatsApp a{' '}
              {sedes.map((s) => `${s.telefono} (${s.nombre})`).join(' o ')} o acércate a cualquiera de nuestras sedes.
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
