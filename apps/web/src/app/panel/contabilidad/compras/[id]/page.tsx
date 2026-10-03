/**
 * CAPA: Presentation / App — Contabilidad · Una compra (especificación §5.7; administración).
 *
 * La cabecera de la nota (número, fechas, proveedor, comprobante, medio,
 * total y quién la registró) y lo que llegó, leído del libro de inventario:
 * por línea, la cantidad, lo que se pagó por esa línea y lo que costó cada
 * unidad. Si está anulada lo dice arriba, con su motivo. Si no, administración
 * puede anularla desde el inventario (solo si nada de lo comprado se usó).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TipoDeComprobante } from '@core/application/ports/inventario.port';
import { costoUnitario } from '@core/domain/contabilidad/tarjeta-peps';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearCantidad } from '@core/domain/shared/cantidad';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Id } from '@core/domain/shared/tipos-base';
import { contabilidadRepository, inventarioRepository } from '@infra/config/composition-root';
import { formatearDia } from '@/lib/fechas';
import { RUTAS_CONTABILIDAD, RUTAS_INVENTARIO, rutaDeCompra } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Dato, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { Medio } from '../../../caja/_componentes';
import { cantidad, EnlaceDeAccion, nombreConVariante } from '../../../inventario/_componentes';
import { enlaceContable } from '../../_componentes';

export const metadata: Metadata = { title: 'Compra' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ETIQUETA_DE_COMPROBANTE: Record<TipoDeComprobante, string> = {
  factura: 'Factura',
  recibo: 'Recibo',
  nota_de_venta: 'Nota de venta',
  sin_comprobante: 'Sin comprobante',
};

export default async function CompraPagina({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await params;
  const lectura = await exigirPersonal(rutaDeCompra(id));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  if (!UUID.test(id)) notFound();

  const [contabilidad, inventario] = await Promise.all([contabilidadRepository(), inventarioRepository()]);
  const [leida, libro] = await Promise.all([contabilidad.compra(id as Id), inventario.kardex({ compraId: id as Id, conValor: true, limite: 100 })]);
  if (!leida.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir la compra">
        <p>{leida.error}</p>
      </Aviso>
    );
  }
  const c = leida.valor;
  if (!c) notFound();
  // El libro trae también los asientos de anulación de esta compra: las líneas
  // son solo las entradas originales, en el orden en que se registraron.
  const lineas = libro.exito ? [...libro.valor].filter((m) => m.tipo === 'compra').sort((a, b) => a.numero - b.numero) : [];
  const volver = enlaceContable(RUTAS_CONTABILIDAD.compras, c.fecha.slice(0, 7));

  return (
    <div className="grid gap-6">
      <Link href={volver} className="panel-sin-imprimir enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Compras
      </Link>

      <EncabezadoDePanel titulo="Compra" resaltado={`n.º ${c.numero}`} descripcion={`Sede ${c.sedeNombre} · ${formatearDia(c.fecha)}`} />

      {c.anulado ? (
        <Aviso tono="error" titulo="Esta compra está anulada">
          <p>
            {c.anuladoEl ? `Se anuló el ${formatearDia(c.anuladoEl)}` : 'Se anuló'}
            {c.anulacionMotivo ? `: «${c.anulacionMotivo}».` : '.'} Lo comprado salió del inventario y el total no cuenta en las compras del mes.
          </p>
        </Aviso>
      ) : null}

      <section aria-label="Datos de la nota" className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Número">N.º {c.numero}</Dato>
          <Dato etiqueta="Fecha">{formatearDia(c.fecha)}</Dato>
          <Dato etiqueta="Fecha de la nota">{c.fechaDocumento ? formatearDia(c.fechaDocumento) : 'No se anotó'}</Dato>
          <Dato etiqueta="Proveedor">{c.proveedor ?? 'No se anotó'}</Dato>
          <Dato etiqueta="Comprobante">
            {ETIQUETA_DE_COMPROBANTE[c.comprobante]}
            {c.numeroComprobante ? ` n.º ${c.numeroComprobante}` : ''}
          </Dato>
          <Dato etiqueta="Medio">
            <Medio medio={c.medio} />
            {c.referencia ? <span className="block text-sm font-normal text-tinta-suave">N.º de operación {c.referencia}</span> : null}
          </Dato>
          <Dato etiqueta="Total">
            <span className={c.anulado ? 'text-xl text-tinta-suave line-through' : 'text-xl font-black text-estructural'}>{formatearMontoExacto(c.total)}</span>
            {c.anulado ? <span className="sr-only"> (anulada)</span> : null}
          </Dato>
          <Dato etiqueta="Registró">{c.quien || '—'}</Dato>
        </dl>
      </section>

      <section aria-labelledby="lineas" className="grid gap-3">
        <h2 id="lineas" className="t-display text-3xl text-estructural">
          Lo que llegó
        </h2>
        {!libro.exito ? (
          <Aviso tono="error" titulo="No pudimos cargar las líneas de la compra">
            <p>{libro.error}</p>
          </Aviso>
        ) : lineas.length === 0 ? (
          <EstadoVacio frase="Sin líneas" detalle="No encontramos en el inventario lo que entró con esta compra." />
        ) : (
          <div className="overflow-x-auto rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta">
            <table className="w-full min-w-[36rem] text-left">
              <caption className="sr-only">Líneas de la compra n.º {c.numero}</caption>
              <thead>
                <tr className="border-b-2 border-linea bg-superficie-alterna text-sm text-tinta-suave">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Artículo
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Cantidad
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Pagado por la línea
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Costo por unidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((m) => {
                  const pagado = m.deltaValor;
                  // Costo de una unidad entera (1 kg, 1 unidad…) de lo que entró por esa línea.
                  const unitario = pagado === null ? null : costoUnitario(m.entra, pagado);
                  return (
                    <tr key={m.id} className="border-b border-linea">
                      <th scope="row" className="px-4 py-3 font-semibold text-tinta">
                        {nombreConVariante(m.articuloNombre, m.etiqueta)}
                      </th>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatearCantidad(m.entra, m.unidad)}</td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{pagado === null ? '—' : formatearMontoExacto(pagado)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-tinta-suave tabular-nums">
                        {unitario === null ? '—' : `${formatearMontoExacto(unitario)} por ${cantidad(1000n, m.unidad).replace(/^1 /, '')}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className="px-4 py-3 text-right font-bold text-tinta">
                    Total de la compra
                  </th>
                  <td className="px-3 py-3 text-right text-lg font-black whitespace-nowrap text-estructural tabular-nums">{formatearMontoExacto(c.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {!c.anulado && tienePermiso(ctx, 'inventario.anular') ? (
        <section aria-label="Anular" className="panel-sin-imprimir grid gap-2 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4">
          <p className="text-tinta-suave">¿Se registró por error? Solo se puede anular si nada de lo comprado se usó todavía. La compra no se borra: queda anulada con su motivo.</p>
          <div>
            <EnlaceDeAccion href={`${RUTAS_INVENTARIO.anular}?tipo=compra&id=${c.id}`} icono="papelera" variante="suave">
              Anular esta compra
            </EnlaceDeAccion>
          </div>
        </section>
      ) : null}
    </div>
  );
}
