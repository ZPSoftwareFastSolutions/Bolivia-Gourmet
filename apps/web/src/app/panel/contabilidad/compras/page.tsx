/**
 * CAPA: Presentation / App — Contabilidad · Compras del mes (especificación §5.7; administración).
 *
 * Las compras con fecha en el mes y las anuladas en el mes (la anulación
 * cuenta en el mes en que se hace). Por fila: fecha, proveedor, comprobante,
 * medio, total y lo que se compró; las anuladas van tachadas, con su chip y su
 * motivo, y se restan en el mes en que se anulan (como en el resumen). Una compra es dinero e inventario, nunca gasto: por
 * eso se registra desde el inventario («Registrar compra»), que crea los lotes.
 *
 * La lista llega cortada en `TOPE_DE_LISTA_DEL_MES` filas (el tope del puerto,
 * el mismo que aplica el adaptador). Si se corta, se avisa y los totales se
 * toman de `resumen_del_mes`: su dinero por medio suma `compras.total` con
 * los mismos filtros (fecha en el mes; anuladas en el mes; sede; RLS), sin
 * tope. No se usa su costo de compras, que sale de los movimientos y no de
 * las compras.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { TOPE_DE_LISTA_DEL_MES, type CompraEnLista, type TotalesDelMesEnBase } from '@core/application/ports/contabilidad.port';
import type { TipoDeComprobante } from '@core/application/ports/inventario.port';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { contabilidadRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_CONTABILIDAD, RUTAS_INVENTARIO, rutaDeCompra } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { Medio } from '../../caja/_componentes';
import { EnlaceDeAccion } from '../../inventario/_componentes';
import { mesDeParametro, nombreDelMes, parametro, PestanasDeContabilidad, sedeDeParametro, SelectorDeMes, SelectorDeSedeContable, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Compras' };

const ETIQUETA_DE_COMPROBANTE: Record<TipoDeComprobante, string> = {
  factura: 'Factura',
  recibo: 'Recibo',
  nota_de_venta: 'Nota de venta',
  sin_comprobante: 'Sin comprobante',
};

function comprobante(c: CompraEnLista): string {
  return `${ETIQUETA_DE_COMPROBANTE[c.comprobante]}${c.numeroComprobante ? ` n.º ${c.numeroComprobante}` : ''}`;
}

/** Lo comprado con fecha en el mes y lo anulado en el mes, sumado de la lista o tomado de la base. */
interface TotalesDeCompras {
  readonly comprado: Centavos;
  readonly anulado: Centavos;
  /** Cuántas tienen fecha en el mes; null si la cifra viene de la base, que no las cuenta. */
  readonly cuantas: number | null;
}

/**
 * Como en el resumen del mes (§5.7): suma lo comprado con fecha en el mes y
 * resta lo anulado en el mes (aunque la compra fuera de un mes anterior). Así
 * el total de un mes pasado no cambia cuando algo se anula después.
 */
function totalesDeLaLista(mes: string, compras: readonly CompraEnLista[]): TotalesDeCompras {
  const delMes = compras.filter((c) => c.fecha.startsWith(mes));
  return {
    comprado: delMes.reduce((t, c) => t + c.total, 0) as Centavos,
    anulado: compras.filter((c) => c.anuladoEl?.startsWith(mes) === true).reduce((t, c) => t + c.total, 0) as Centavos,
    cuantas: delMes.length,
  };
}

/** Las mismas cifras del dinero del mes de la base, sumadas en todos los medios (un medio sin movimiento no viene). */
function totalesDeLaBase(t: TotalesDelMesEnBase): TotalesDeCompras {
  const medios = Object.values(t.dinero);
  return {
    comprado: medios.reduce((s, m) => s + (m?.compras ?? 0), 0) as Centavos,
    anulado: medios.reduce((s, m) => s + (m?.comprasAnuladas ?? 0), 0) as Centavos,
    cuantas: null,
  };
}

export default async function Compras({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CONTABILIDAD.compras), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  const mes = mesDeParametro(parametro(valores, 'mes'), ctx.hoy);
  const sede = sedeDeParametro(ctx, parametro(valores, 'sede'));
  const nombreDeSede = sede ? ctx.sedes.find((s) => s.id === sede)?.nombre : undefined;
  // La columna «Sede» solo aporta si se miran todas y hay más de una.
  const conSede = !sede && ctx.sedes.length > 1;
  const puedeComprar = tienePermiso(ctx, 'inventario.comprar');
  const registrar = `${RUTAS_INVENTARIO.compra}${sede && ctx.sedes.length > 1 ? `?sede=${sede}` : ''}`;

  const repo = await contabilidadRepository();
  const leidas = await repo.compras(mes, sede);
  const compras = leidas.exito ? leidas.valor : [];
  // La lista se corta en `TOPE_DE_LISTA_DEL_MES` filas (las más nuevas). Si se cortó,
  // sumarla daría menos: las cifras salen de la base. Solo entonces se pide el
  // resumen, que es una consulta pesada.
  const cortada = compras.length >= TOPE_DE_LISTA_DEL_MES;
  const enBase = cortada ? await repo.totalesDelMes(mes, sede) : null;
  const { comprado, anulado, cuantas } = enBase?.exito ? totalesDeLaBase(enBase.valor) : totalesDeLaLista(mes, compras);
  const total = (comprado - anulado) as Centavos;

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Compras"
        descripcion={`${nombreDelMes(mes)}${nombreDeSede ? ` · Sede ${nombreDeSede}` : ctx.sedes.length > 1 ? ' · Todas las sedes' : ''}. Lo que se pagó por insumos, uniformes y utensilios: entra al inventario, no es gasto.`}
        acciones={
          puedeComprar ? (
            <EnlaceDeAccion href={registrar} icono="carrito">
              Registrar compra
            </EnlaceDeAccion>
          ) : null
        }
      />
      <PestanasDeContabilidad activa={RUTAS_CONTABILIDAD.compras} mes={mes} sede={sede} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectorDeMes base={RUTAS_CONTABILIDAD.compras} mes={mes} sede={sede} hoy={ctx.hoy} />
        <SelectorDeSedeContable ctx={ctx} base={RUTAS_CONTABILIDAD.compras} mes={mes} sede={sede} />
      </div>

      {!leidas.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar las compras">
          <p>{leidas.error}</p>
        </Aviso>
      ) : compras.length === 0 ? (
        <EstadoVacio
          frase={`Sin compras en ${nombreDelMes(mes).replace(/ de \d{4}$/, '')}`}
          detalle="Cuando registres una compra con su nota, aparecerá aquí con su total."
          accion={
            puedeComprar ? (
              <EnlaceDeAccion href={registrar} icono="carrito" variante="suave">
                Registrar compra
              </EnlaceDeAccion>
            ) : undefined
          }
        />
      ) : (
        <section aria-labelledby="lista-de-compras" className="grid gap-3">
          <h2 id="lista-de-compras" className="sr-only">
            Lista de compras
          </h2>
          {cortada ? (
            <Aviso tono="info" titulo={`La lista muestra las ${TOPE_DE_LISTA_DEL_MES} compras más nuevas`}>
              <p>
                {enBase?.exito
                  ? 'Puede haber más compras en el mes que no salen abajo. Los totales sí cuentan todas las compras del mes: los suma la base.'
                  : 'Puede haber más compras en el mes que no salen abajo, y los totales suman solo las de esta lista. El total completo está en el resumen del mes.'}
              </p>
            </Aviso>
          ) : null}
          <p className="text-tinta-suave">
            {cuantas === null ? 'Compras' : cuantas === 1 ? '1 compra' : `${cuantas} compras`} con fecha en el mes por{' '}
            <strong className="text-estructural">{formatearMontoExacto(comprado)}</strong>.
            {anulado > 0 ? ` Se anularon en el mes ${formatearMontoExacto(anulado)}: van tachadas y se restan.` : ''}
          </p>
          <div className="overflow-x-auto rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta">
            <table className="w-full min-w-[44rem] text-left">
              <caption className="sr-only">Compras de {nombreDelMes(mes)}</caption>
              <thead>
                <tr className="border-b-2 border-linea bg-superficie-alterna text-sm text-tinta-suave">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Fecha
                  </th>
                  {conSede ? (
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Sede
                    </th>
                  ) : null}
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Proveedor
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Comprobante
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Medio
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-b border-linea align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <time dateTime={c.fecha} className={cn('font-semibold', c.anulado ? 'text-tinta-suave line-through' : 'text-tinta')}>
                        {formatearDiaCorto(c.fecha)}
                      </time>
                      <span className="block text-sm text-tinta-suave">N.º {c.numero}</span>
                    </td>
                    {conSede ? <td className="px-3 py-3 text-tinta">{c.sedeNombre}</td> : null}
                    <td className="px-3 py-3">
                      <span className={cn('font-semibold', c.anulado ? 'text-tinta-suave line-through' : 'text-tinta')}>{c.proveedor ?? 'Sin proveedor anotado'}</span>
                      {c.articulos.length > 0 ? (
                        <span className="block text-sm text-tinta-suave">
                          {c.articulos.slice(0, 3).join(', ')}
                          {c.articulos.length > 3 ? ` y ${c.articulos.length - 3} más` : ''}
                        </span>
                      ) : null}
                      {c.anulado ? (
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tinta-suave">
                          <Chip tono="rojo" icono="cerrar">
                            Anulada
                          </Chip>
                          <span>
                            {c.anuladoEl ? `el ${formatearDiaCorto(c.anuladoEl)}` : ''}
                            {c.anulacionMotivo ? `${c.anuladoEl ? ': ' : ''}«${c.anulacionMotivo}»` : ''}
                          </span>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-tinta">{comprobante(c)}</td>
                    <td className="px-3 py-3">
                      <Medio medio={c.medio} />
                      {c.referencia ? <span className="block text-sm text-tinta-suave">Op. {c.referencia}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      <span className={cn('font-bold', c.anulado ? 'text-tinta-suave line-through' : 'text-estructural')}>{formatearMontoExacto(c.total)}</span>
                      {c.anulado ? <span className="sr-only"> (anulada)</span> : null}
                    </td>
                    <td className="px-4 py-1">
                      <Link href={rutaDeCompra(c.id)} className="enlace inline-flex min-h-11 items-center gap-1 font-semibold">
                        Ver
                        <span className="sr-only"> la compra n.º {c.numero}</span>
                        <Icono nombre="flecha" tamano={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {anulado > 0 ? (
                  <>
                    <tr>
                      <th scope="row" colSpan={conSede ? 5 : 4} className="px-4 pt-3 text-right font-semibold text-tinta-suave">
                        Comprado en el mes
                      </th>
                      <td className="px-3 pt-3 text-right whitespace-nowrap text-tinta tabular-nums">{formatearMontoExacto(comprado)}</td>
                      <td />
                    </tr>
                    <tr>
                      <th scope="row" colSpan={conSede ? 5 : 4} className="px-4 text-right font-semibold text-tinta-suave">
                        Anulado en el mes
                      </th>
                      <td className="px-3 text-right whitespace-nowrap text-tinta tabular-nums">− {formatearMontoExacto(anulado)}</td>
                      <td />
                    </tr>
                  </>
                ) : null}
                <tr>
                  <th scope="row" colSpan={conSede ? 5 : 4} className="px-4 py-3 text-right font-bold text-tinta">
                    Neto del mes
                  </th>
                  <td className="px-3 py-3 text-right text-lg font-black whitespace-nowrap text-estructural tabular-nums">{formatearMontoExacto(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
