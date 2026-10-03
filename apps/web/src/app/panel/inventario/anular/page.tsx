/**
 * CAPA: Presentation / App — Anular en inventario (administración, §6.16).
 *
 * Muestra el documento completo (todas las líneas de una compra o de un uso),
 * dice en una frase lo que va a pasar y pide el motivo. Nada se borra: la
 * anulación es un movimiento inverso que queda en el historial.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import type { DocumentoAnulable } from '@core/application/ports/inventario.port';
import type { Id } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { AreaDeTexto, Aviso } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, type Parametros } from '../../caja/_componentes';
import { anularAccion } from '../actions';
import { FilaDeKardex } from '../_componentes';

export const metadata: Metadata = { title: 'Anular' };

const QUE_PASA: Record<DocumentoAnulable, { titulo: string; frase: string }> = {
  uso: { titulo: 'un uso en clase', frase: 'Lo usado vuelve al inventario, a las mismas compras de las que salió.' },
  compra: {
    titulo: 'una compra',
    frase: 'Lo comprado sale del inventario. Si se pagó en efectivo, el dinero vuelve a la caja y entra en el próximo cierre. Solo se puede si nada de esa compra se usó todavía.',
  },
  baja: { titulo: 'una baja', frase: 'Lo que se dio de baja vuelve al inventario.' },
  saldo_inicial: { titulo: 'un saldo inicial', frase: 'Se quita lo registrado al empezar. Solo se puede si después no hubo otros movimientos.' },
};

function documento(valor: string): DocumentoAnulable | null {
  return valor === 'uso' || valor === 'compra' || valor === 'baja' || valor === 'saldo_inicial' ? valor : null;
}

export default async function Anular({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.anular), searchParams]);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'inventario.anular');
  const tipo = documento(parametro(valores, 'tipo'));
  const id = parametro(valores, 'id');
  if (!tipo || !/^[0-9a-f-]{36}$/i.test(id)) {
    return <EstadoVacio frase="¿Qué quieres anular?" detalle="Abre el historial y pulsa «Anular» en la fila." accion={<Link href={RUTAS_INVENTARIO.historial} className="enlace font-semibold">Ir al historial</Link>} />;
  }
  const repo = await inventarioRepository();
  const lineas = await repo.kardex(
    tipo === 'uso' ? { operacionId: id as Id, conValor: true } : tipo === 'compra' ? { compraId: id as Id, conValor: true } : { movimientoId: id as Id, conValor: true },
  );
  const originales = lineas.exito ? lineas.valor.filter((m) => m.tipo !== 'anulacion') : [];
  const que = QUE_PASA[tipo];

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Anular" resaltado={que.titulo} descripcion="Nada se borra: queda registrado quién anuló, cuándo y por qué." />
      {!lineas.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar lo que quieres anular">
          <p>{lineas.error}</p>
        </Aviso>
      ) : originales.length === 0 ? (
        <EstadoVacio frase="No lo encontramos" detalle="Puede que ya se haya anulado. Revisa el historial." />
      ) : (
        <>
          <ul className="grid gap-2">
            {originales.map((m) => (
              <FilaDeKardex key={m.id} m={m} conArticulo puedeAnular={false} />
            ))}
          </ul>
          {originales.every((m) => m.anulado) ? (
            <Aviso tono="info" titulo="Ya está anulado">
              <p>Esto ya se anuló antes. No hace falta hacer nada más.</p>
            </Aviso>
          ) : (
            <FormularioDelPanel accion={anularAccion} etiqueta="Anular" className="rounded-[var(--t-radio-lg)] border-2 border-peligro/40 bg-tarjeta p-4 sm:p-5">
              <input type="hidden" name="clave" value={randomUUID()} />
              <input type="hidden" name="tipo" value={tipo} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="volver" value={RUTAS_INVENTARIO.historial} />
              <Aviso tono="info" titulo="Lo que va a pasar">
                <p>{que.frase}</p>
              </Aviso>
              <AreaDeTexto id="motivo" etiqueta="¿Por qué se anula?" rows={2} maxLength={300} placeholder="Se registró en el grupo equivocado" />
              <div className="flex flex-wrap gap-3">
                <BotonGuardar icono="cerrar" variante="peligro" enviando="Anulando…">
                  Sí, anular
                </BotonGuardar>
                <Link href={RUTAS_INVENTARIO.historial} className="inline-flex min-h-12 items-center rounded-md px-4 font-semibold text-tinta-suave hover:bg-superficie-alterna">
                  Cancelar
                </Link>
              </div>
            </FormularioDelPanel>
          )}
        </>
      )}
    </div>
  );
}
