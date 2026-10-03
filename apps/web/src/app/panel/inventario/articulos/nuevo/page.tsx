/**
 * CAPA: Presentation / App — Artículo nuevo (administración).
 *
 * Primero el tipo (cuatro tarjetas-enlace: cada tipo se comporta distinto) y
 * luego solo los campos de ese tipo. El código (INS-0001, UNI-0001…) lo pone
 * la base.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { cn } from '@/lib/cn';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel } from '@/presentation/panel/Piezas';
import { COMPORTAMIENTO_POR_TIPO, type TipoDeArticulo } from '@core/domain/inventario/articulo';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { parametro, type Parametros } from '../../../caja/_componentes';
import { crearArticuloAccion } from '../../actions';
import { CamposDeArticulo } from '../../_campos';
import { ICONO_DE_TIPO, TIPOS_EN_ORDEN, tipoDeParametro } from '../../_componentes';

export const metadata: Metadata = { title: 'Artículo nuevo' };

const QUE_ES: Record<TipoDeArticulo, string> = {
  insumo: 'Se usa en clase y se acaba. Puede vencer.',
  uniforme: 'Se entrega al alumno y se cobra. Lleva tallas.',
  utensilio: 'Se presta y vuelve: cuchillos, bols, moldes.',
  otro: 'Limpieza, descartables y lo demás.',
};

export default async function ArticuloNuevo({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.articuloNuevo), searchParams]);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'inventario.catalogo');
  const tipo = tipoDeParametro(parametro(valores, 'tipo'));

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Artículo" resaltado="nuevo" descripcion="¿Qué tipo de artículo es? Cada tipo se comporta distinto." />
      <nav aria-label="Tipo de artículo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TIPOS_EN_ORDEN.map((t) => (
          <Link
            key={t}
            href={`${RUTAS_INVENTARIO.articuloNuevo}?tipo=${t}`}
            aria-current={t === tipo ? 'true' : undefined}
            className={cn(
              'flex min-h-20 items-center gap-3 rounded-[var(--t-radio-lg)] border-2 p-4',
              t === tipo ? 'border-estructural bg-superficie-alterna' : 'border-linea bg-tarjeta hover:border-estructural/40',
            )}
          >
            <span className={cn('inline-grid size-12 flex-none place-items-center rounded-full', t === tipo ? 'bg-estructural text-sobre-estructural' : 'bg-superficie-alterna text-estructural')}>
              <Icono nombre={ICONO_DE_TIPO[t]} tamano={24} />
            </span>
            <span>
              <span className="block font-bold text-estructural">{COMPORTAMIENTO_POR_TIPO[t].etiqueta}</span>
              <span className="text-sm text-tinta-suave">{QUE_ES[t]}</span>
            </span>
          </Link>
        ))}
      </nav>
      <FormularioDelPanel accion={crearArticuloAccion} etiqueta="Agregar el artículo" className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
        <input type="hidden" name="clave" value={randomUUID()} />
        <input type="hidden" name="tipo" value={tipo} />
        <CamposDeArticulo tipo={tipo} />
        <div>
          <BotonGuardar icono="mas" enviando="Agregando…">
            Agregar al catálogo
          </BotonGuardar>
        </div>
      </FormularioDelPanel>
    </div>
  );
}
