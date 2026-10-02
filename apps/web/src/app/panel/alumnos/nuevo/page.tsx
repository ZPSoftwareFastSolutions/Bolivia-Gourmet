/**
 * CAPA: Presentation / App — nueva ficha de alumno (sin inscribir todavía).
 *
 * Para quien viene a preguntar y deja sus datos. Lo habitual es «Inscribir
 * alumno», que crea la ficha en el mismo paso; esta página existe para cuando
 * la inscripción será otro día.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { sedeDeTrabajo } from '@core/domain/identidad/contexto-de-panel';
import { RUTAS_ALUMNOS } from '@/lib/rutas';
import { GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { crearAlumnoAccion } from '../actions';
import { CamposDeFicha } from '../_componentes';

export const metadata: Metadata = { title: 'Nuevo alumno' };

export default async function NuevoAlumno() {
  const lectura = await exigirPersonal(RUTAS_ALUMNOS.nuevo);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'estudiantes.gestionar');
  const sede = sedeDeTrabajo(ctx);

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={RUTAS_ALUMNOS.lista} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Alumnos
      </Link>
      <EncabezadoDePanel gancho="Bienvenida," titulo="Nuevo" resaltado="alumno" descripcion="Solo nombres y apellidos son obligatorios. El código se asigna solo." />
      <FormularioDelPanel accion={crearAlumnoAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
        <input type="hidden" name="clave" value={randomUUID()} />
        {ctx.sedes.length > 1 ? (
          <GrupoDeOpciones nombre="sede" leyenda="Sede habitual" opciones={ctx.sedes.map((s) => ({ valor: s.id, etiqueta: s.nombre, detalle: s.zona }))} valor={sede?.id} />
        ) : (
          <input type="hidden" name="sede" value={sede?.id ?? ''} />
        )}
        <CamposDeFicha />
        <BotonGuardar className="justify-self-start">Crear ficha</BotonGuardar>
      </FormularioDelPanel>
    </div>
  );
}
