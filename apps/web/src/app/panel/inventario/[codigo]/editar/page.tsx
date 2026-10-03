/**
 * CAPA: Presentation / App — Editar artículo (administración).
 *
 * Nombre, categoría, dibujo, aviso de mínimo, vencimiento, precio del
 * uniforme y si sigue activo. El tipo y la unidad no se cambian aquí: una vez
 * que hay movimientos, la base no lo permite.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COMPORTAMIENTO_POR_TIPO } from '@core/domain/inventario/articulo';
import { inventarioRepository } from '@infra/config/composition-root';
import { rutaDeArticulo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { editarArticuloAccion } from '../../actions';
import { CamposDeArticulo } from '../../_campos';

export const metadata: Metadata = { title: 'Editar artículo' };

export default async function EditarArticulo({ params }: { readonly params: Promise<{ readonly codigo: string }> }) {
  const { codigo } = await params;
  const lectura = await exigirPersonal(`${rutaDeArticulo(codigo)}/editar`);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'inventario.catalogo');
  if (!/^(INS|UNI|UTE|OTR)-\d{4,}$/.test(codigo)) notFound();
  const ficha = await (await inventarioRepository()).fichaDeArticulo(codigo, false);
  if (!ficha.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el artículo">
        <p>{ficha.error}</p>
      </Aviso>
    );
  }
  const a = ficha.valor;
  if (!a) notFound();

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel gancho={COMPORTAMIENTO_POR_TIPO[a.tipo].etiqueta} titulo="Editar" resaltado={a.nombre} descripcion={a.codigo} />
      <FormularioDelPanel accion={editarArticuloAccion} etiqueta="Guardar los cambios del artículo" className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="codigo" value={a.codigo} />
        <input type="hidden" name="tipo" value={a.tipo} />
        <input type="hidden" name="unidad" value={a.unidad} />
        <CamposDeArticulo tipo={a.tipo} articulo={a} />
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-2 border-linea bg-tarjeta p-3 has-[:checked]:border-estructural">
          <input type="checkbox" name="activo" value="si" defaultChecked={a.activo} className="size-5 accent-[var(--t-estructural)]" />
          <span>
            <span className="block font-semibold text-tinta">Activo</span>
            <span className="text-sm text-tinta-suave">Si lo desactivas, deja de aparecer para usar, comprar o entregar. Su historial se conserva.</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <BotonGuardar icono="check">Guardar cambios</BotonGuardar>
          <Link href={rutaDeArticulo(a.codigo)} className="inline-flex min-h-12 items-center rounded-md px-4 font-semibold text-tinta-suave hover:bg-superficie-alterna">
            Cancelar
          </Link>
        </div>
      </FormularioDelPanel>
    </div>
  );
}
