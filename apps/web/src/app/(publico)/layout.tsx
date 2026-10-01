/**
 * CAPA: Presentation / App — layout del sitio público.
 *
 * Las sedes salen del catálogo por el composition root: la cabecera, el pie y
 * el botón de WhatsApp muestran los dos números sin escribirlos a mano.
 */

import type { ReactNode } from 'react';
import { catalogoAcademico } from '@infra/config/composition-root';
import { Cabecera } from '@patterns/Cabecera';
import { Pie } from '@patterns/Pie';
import { WhatsAppFlotante } from '@patterns/WhatsAppFlotante';

export default async function LayoutPublico({ children }: { readonly children: ReactNode }) {
  const sedes = (await catalogoAcademico().listarSedes()).filter((s) => s.activa);
  return (
    <>
      <Cabecera sedes={sedes} />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Pie sedes={sedes} />
      <WhatsAppFlotante sedes={sedes} />
    </>
  );
}
