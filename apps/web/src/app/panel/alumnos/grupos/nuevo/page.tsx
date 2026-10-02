/**
 * CAPA: Presentation / App — abrir un grupo (administración).
 *
 * Paso 1: elegir el programa (tarjetas, con la carrera aparte). Paso 2: el
 * formulario con SOLO las opciones de ese programa. El dominio valida contra
 * el catálogo y la base repite lo esencial.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { catalogoAcademico } from '@infra/config/composition-root';
import { anioDe } from '@core/domain/shared/calendario';
import { RUTAS_ALUMNOS } from '@/lib/rutas';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, Mosaico } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { abrirGrupoAccion } from '../../actions';
import { parametro, type Parametros } from '../../_componentes';
import { CamposDeGrupo } from '../_campos';

export const metadata: Metadata = { title: 'Abrir grupo' };

export default async function AbrirGrupo({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_ALUMNOS.grupoNuevo), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'cohortes.gestionar');

  const programas = (await catalogoAcademico().listarProgramas()).filter((p) => p.activo);
  const elegido = programas.find((p) => p.codigo === parametro(valores, 'programa')) ?? null;

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={RUTAS_ALUMNOS.grupos} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Grupos y cupos
      </Link>
      <EncabezadoDePanel titulo="Abrir" resaltado="grupo" descripcion={elegido ? elegido.nombre : '¿De qué programa es el grupo?'} />

      {!elegido ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {programas.map((p) => (
            <Mosaico
              key={p.codigo}
              href={`${RUTAS_ALUMNOS.grupoNuevo}?programa=${p.codigo}`}
              icono={p.tipo === 'carrera' ? 'graduacion' : 'gorro'}
              titulo={p.nombre}
              detalle={p.tipo === 'carrera' ? 'Carrera' : 'Capacitación'}
              tono={p.tipo === 'carrera' ? 'azul' : 'vino'}
            />
          ))}
        </div>
      ) : (
        <FormularioDelPanel accion={abrirGrupoAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
          <CamposDeGrupo programa={elegido} sedes={ctx.sedes} conSede gestionSugerida={anioDe(ctx.hoy)} />
          <div className="flex flex-wrap items-center gap-3">
            <BotonGuardar icono="mas" enviando="Abriendo…">
              Abrir grupo
            </BotonGuardar>
            <Link href={RUTAS_ALUMNOS.grupoNuevo} className="inline-flex min-h-12 items-center px-4 font-semibold text-tinta-suave hover:text-estructural">
              Elegir otro programa
            </Link>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}
