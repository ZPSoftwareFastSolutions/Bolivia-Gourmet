/**
 * CAPA: Presentation / App — editar un grupo (administración).
 *
 * El programa y la sede no se cambian (si ya hay alumnos, la base lo impide);
 * para cerrar el grupo está su botón en la ficha.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Id } from '@core/domain/shared/tipos-base';
import { alumnosRepository, catalogoAcademico } from '@infra/config/composition-root';
import { rutaDeGrupo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../../_sesion';
import { editarGrupoAccion } from '../../../actions';
import { CamposDeGrupo } from '../../_campos';

export const metadata: Metadata = { title: 'Editar grupo' };

export default async function EditarGrupo({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await params;
  const lectura = await exigirPersonal(`${rutaDeGrupo(id)}/editar`);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'cohortes.gestionar');

  const leida = await (await alumnosRepository()).fichaDeGrupo(id as Id);
  if (!leida.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el grupo">
        <p>{leida.error}</p>
      </Aviso>
    );
  }
  if (!leida.valor) notFound();
  const g = leida.valor.grupo;
  const programa = await catalogoAcademico().programaPorCodigo(g.programaCodigo);

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={rutaDeGrupo(g.id)} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Volver al grupo
      </Link>
      <EncabezadoDePanel titulo="Editar" resaltado="grupo" descripcion={g.nombre} />
      {g.estado === 'cerrado' || !programa ? (
        <Aviso tono="info" titulo={g.estado === 'cerrado' ? 'El grupo está cerrado' : 'Programa fuera del catálogo'}>
          <p>Este grupo ya no se puede editar.</p>
        </Aviso>
      ) : (
        <FormularioDelPanel accion={editarGrupoAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="sede" value={g.sedeId} />
          <CamposDeGrupo
            programa={programa}
            sedes={ctx.sedes}
            conSede={false}
            gestionSugerida={g.gestion}
            valores={{
              gestion: g.gestion,
              anioDeCarrera: g.anioDeCarrera,
              turno: g.turno,
              dias: g.dias,
              duracion: g.duracion,
              modalidad: g.modalidad,
              fechaInicio: g.fechaInicio,
              fechaFin: g.fechaFin,
              horaInicio: g.horaInicio,
              horaFin: g.horaFin,
              inscripcionDesde: g.inscripcionDesde,
              inscripcionHasta: g.inscripcionHasta,
              capacidad: g.capacidad,
              estado: g.estado,
            }}
          />
          <BotonGuardar className="justify-self-start">Guardar cambios</BotonGuardar>
        </FormularioDelPanel>
      )}
    </div>
  );
}
