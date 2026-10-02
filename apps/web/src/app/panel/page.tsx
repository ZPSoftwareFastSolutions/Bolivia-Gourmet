/**
 * CAPA: Presentation / App — inicio del panel interno.
 *
 * Saludo, fecha de negocio, sede y las acciones del día en mosaicos grandes
 * (especificación §7.3, enmiendas B.12: como máximo cuatro). Las acciones
 * salen de los permisos del contexto: nadie ve un botón que no puede usar.
 * Los indicadores y alertas del tablero llegan con la rebanada R7.
 */

import type { Metadata } from 'next';
import { saludoSegunHora, sedeDeTrabajo, tienePermiso, type ContextoDePanel, type Permiso } from '@core/domain/identidad/contexto-de-panel';
import { ETIQUETA_DE_ROL } from '@core/domain/identidad/rol';
import { formatearDiaLargo, horaEnBolivia } from '@/lib/fechas';
import { RUTAS_PANEL } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';
import { EncabezadoDePanel, Mosaico } from '@/presentation/panel/Piezas';
import { exigirPersonal } from './_sesion';

export const metadata: Metadata = { title: 'Inicio' };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

interface Accion {
  readonly href: string;
  readonly icono: NombreDeIcono;
  readonly titulo: string;
  readonly detalle: string;
  readonly permiso: Permiso;
  readonly tono?: 'azul' | 'vino' | 'amarillo';
}

/** En orden de frecuencia en recepción; se muestran las cuatro primeras permitidas. */
const ACCIONES: readonly Accion[] = [
  { href: RUTAS_PANEL.caja, icono: 'monedas', titulo: 'Cobrar', detalle: 'Cuotas, uniformes y ventas', permiso: 'caja.cobrar', tono: 'amarillo' },
  { href: RUTAS_PANEL.alumnos, icono: 'graduacion', titulo: 'Inscribir', detalle: 'Nuevos alumnos y renovaciones', permiso: 'inscripciones.gestionar' },
  { href: RUTAS_PANEL.inventario, icono: 'paquete', titulo: 'Entregar o usar', detalle: 'Uniformes, utensilios e insumos', permiso: 'inventario.operar' },
  { href: RUTAS_PANEL.contabilidad, icono: 'libro', titulo: 'Ver el mes', detalle: 'Ingresos, gastos y resultado', permiso: 'contabilidad.leer', tono: 'vino' },
  { href: RUTAS_PANEL.alumnos, icono: 'buscar', titulo: 'Buscar alumno', detalle: 'Por nombre o carnet', permiso: 'estudiantes.leer' },
];

function accionesDe(ctx: ContextoDePanel): readonly Accion[] {
  return ACCIONES.filter((a) => tienePermiso(ctx, a.permiso)).slice(0, 4);
}

export default async function InicioDelPanel({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, parametros] = await Promise.all([exigirPersonal(), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  const sede = sedeDeTrabajo(ctx);
  const acciones = accionesDe(ctx);

  return (
    <div className="grid gap-8">
      {parametros.aviso === 'sin_permiso' ? (
        <Aviso tono="error" titulo="Esa sección no está disponible para tu cuenta">
          <p>Si la necesitas, pide a administración que revise tus permisos.</p>
        </Aviso>
      ) : null}

      <EncabezadoDePanel
        gancho={`${saludoSegunHora(horaEnBolivia())},`}
        titulo={ctx.nombres || ETIQUETA_DE_ROL[ctx.rol]}
        descripcion={
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="first-letter:uppercase">{formatearDiaLargo(ctx.hoy)}</span>
            {sede ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tarjeta px-3 py-1 text-sm font-semibold text-estructural ring-1 ring-linea">
                <Icono nombre="pin" tamano={16} />
                {sede.nombre}
              </span>
            ) : null}
          </p>
        }
      />

      <section aria-labelledby="que-hacer" className="grid gap-4">
        <h2 id="que-hacer" className="t-etiqueta">
          ¿Qué quieres hacer?
        </h2>
        {acciones.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {acciones.map((a) => (
              <Mosaico key={a.titulo} href={a.href} icono={a.icono} titulo={a.titulo} detalle={a.detalle} tono={a.tono} />
            ))}
          </div>
        ) : (
          <p className="text-tinta-suave">Tu cuenta todavía no tiene tareas asignadas en el panel.</p>
        )}
      </section>
    </div>
  );
}
