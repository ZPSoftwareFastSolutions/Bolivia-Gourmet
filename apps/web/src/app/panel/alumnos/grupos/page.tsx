/**
 * CAPA: Presentation / App — grupos y cupos.
 *
 * Para informar a quien llega en persona: cada grupo con su inicio, turno y
 * días, la barra de cupos y el precio (o «Consultar»). Recepción ve los de
 * las dos sedes («en El Alto sí hay cupo») aunque solo inscriba en la suya.
 * Administración abre grupos.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { describirHorario } from '@core/domain/academico/horario';
import type { EstadoDeCohorte } from '@core/domain/academico/programa';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { alumnosRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { diaEnBolivia, formatearFecha } from '@/lib/fechas';
import { RUTAS_ALUMNOS, rutaDeGrupo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BarraDeCupos, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { ChipDeConvocatoria, ChipDeGrupo, parametro, PestanasDeAlumnos, PrecioDelGrupo, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Grupos y cupos' };

const VISTAS: readonly { readonly valor: string; readonly etiqueta: string; readonly estados: readonly EstadoDeCohorte[] }[] = [
  { valor: 'activos', etiqueta: 'Abiertos y en curso', estados: ['abierto', 'en_curso'] },
  { valor: 'planificados', etiqueta: 'Planificados', estados: ['planificado'] },
  { valor: 'cerrados', etiqueta: 'Cerrados', estados: ['cerrado'] },
];

export default async function Grupos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_ALUMNOS.grupos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'cohortes.leer');

  const vista = VISTAS.find((v) => v.valor === parametro(valores, 'ver')) ?? VISTAS[0]!;
  const repo = await alumnosRepository();
  const [lista, abiertas] = await Promise.all([repo.listarGrupos({ estados: vista.estados }), repo.contarSolicitudesAbiertas()]);
  const puedeAbrir = tienePermiso(ctx, 'cohortes.gestionar');
  const sedesPropias = new Set(ctx.sedes.map((s) => s.id));
  const hoy = diaEnBolivia(new Date());

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Grupos"
        resaltado="y cupos"
        descripcion="Cuántos lugares quedan y cuánto cuesta, para informar a quien pregunta."
        acciones={
          puedeAbrir ? (
            <Link href={RUTAS_ALUMNOS.grupoNuevo} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion hover:bg-accion-fuerte">
              <Icono nombre="mas" tamano={20} />
              Abrir grupo
            </Link>
          ) : null
        }
      />
      <PestanasDeAlumnos activa={RUTAS_ALUMNOS.grupos} solicitudes={abiertas.exito ? abiertas.valor : 0} />

      <nav aria-label="Filtrar grupos" className="flex flex-wrap gap-2">
        {VISTAS.map((v) => (
          <Link
            key={v.valor}
            href={v.valor === 'activos' ? RUTAS_ALUMNOS.grupos : `${RUTAS_ALUMNOS.grupos}?ver=${v.valor}`}
            aria-current={vista.valor === v.valor ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border-2 px-4 font-semibold',
              vista.valor === v.valor ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            {v.etiqueta}
          </Link>
        ))}
      </nav>

      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los grupos">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio
          frase="Sin grupos por ahora"
          detalle={puedeAbrir ? 'Abre el primer grupo para empezar a inscribir.' : 'Cuando administración abra grupos, aparecerán aquí.'}
          accion={
            puedeAbrir ? (
              <Link href={RUTAS_ALUMNOS.grupoNuevo} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion">
                <Icono nombre="mas" tamano={20} />
                Abrir grupo
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.valor.map((g) => (
            <li key={g.id}>
              <Link href={rutaDeGrupo(g.id)} className="mosaico grid h-full gap-3 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-5 hover:border-estructural">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Icono nombre={g.programaTipo === 'carrera' ? 'graduacion' : 'gorro'} tamano={22} className={g.programaTipo === 'carrera' ? 'text-estructural' : 'text-cursos'} />
                    <span className="text-lg leading-tight font-bold text-estructural">{g.nombre}</span>
                  </span>
                  <ChipDeGrupo estado={g.estado} />
                </span>
                <span className="text-sm text-tinta-suave">
                  Empieza el {formatearFecha(`${g.fechaInicio}T12:00:00Z`)}
                  {g.horaInicio && g.horaFin ? ` · ${describirHorario({ dias: g.dias ?? undefined, horaInicio: g.horaInicio, horaFin: g.horaFin })}` : ''}
                  {sedesPropias.has(g.sedeId) ? '' : ' · otra sede'}
                </span>
                <ChipDeConvocatoria grupo={g} hoy={hoy} />
                <BarraDeCupos inscritos={g.inscritos} capacidad={g.capacidad} />
                <PrecioDelGrupo precios={g.precios} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
