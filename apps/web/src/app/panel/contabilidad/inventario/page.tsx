/**
 * CAPA: Presentation / App — Contabilidad · Inventario valorizado (especificación §5.7; administración).
 *
 * Lo que vale HOY lo que hay en el estante, según el libro de inventario (al
 * costo de compra: lote por lote en los insumos, costo promedio en lo demás).
 * Arriba, por tipo y sede con su parte del total; debajo, artículo por
 * artículo con su valor en cada sede y el costo promedio por unidad. En los
 * insumos, el enlace a su tarjeta PEPS en cada sede. Imprimible.
 *
 * No depende del mes: el mes elegido solo se conserva en los enlaces para que
 * volver a otra pestaña no lo pierda.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ArticuloConExistencias } from '@core/application/ports/inventario.port';
import { costoUnitario } from '@core/domain/contabilidad/tarjeta-peps';
import type { SedeOperable } from '@core/domain/identidad/contexto-de-panel';
import type { TipoDeArticulo } from '@core/domain/inventario/articulo';
import { sumar, type Milesimas } from '@core/domain/shared/cantidad';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { RUTAS_CONTABILIDAD, RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { BotonImprimir } from '@/presentation/panel/Caja';
import { EncabezadoDePanel, EstadoVacio, Indicador } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { cantidad, EnlaceDeAccion, PLURAL_DE_TIPO, TIPOS_EN_ORDEN } from '../../inventario/_componentes';
import { mesDeParametro, parametro, PestanasDeContabilidad, sedeDeParametro, SelectorDeSedeContable, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Inventario valorizado' };

/** Un artículo con su valor en cada sede mirada (centavos) y la cantidad total. */
interface ArticuloValorizado {
  readonly articulo: ArticuloConExistencias;
  readonly porSede: ReadonlyMap<string, number>;
  readonly valor: number;
  /** Disponible + prestado: el valor del libro incluye lo prestado. */
  readonly cantidad: Milesimas;
}

function valorizar(a: ArticuloConExistencias, sedes: readonly SedeOperable[]): ArticuloValorizado {
  const ids = new Set<string>(sedes.map((s) => s.id));
  const porSede = new Map<string, number>();
  const cantidades: bigint[] = [];
  for (const v of a.variantes) {
    for (const s of v.sedes) {
      if (!ids.has(s.sedeId)) continue;
      // Sin valores del libro, la base devuelve `null`: cuenta como cero.
      porSede.set(s.sedeId, (porSede.get(s.sedeId) ?? 0) + (s.valor ?? 0));
      cantidades.push(s.total);
    }
  }
  const valor = [...porSede.values()].reduce((t, x) => t + x, 0);
  return { articulo: a, porSede, valor, cantidad: sumar(...cantidades) };
}

function monto(valor: number): string {
  return formatearMontoExacto(valor as Centavos);
}

/** «45,3 %», calculado en décimas enteras. Solo se muestra: nunca se suma dinero con esto. */
function porcentaje(parte: number, total: number): string {
  if (total <= 0) return '—';
  const decimas = Math.round((parte * 1000) / total);
  const absoluto = Math.abs(decimas);
  return `${decimas < 0 ? '-' : ''}${Math.floor(absoluto / 10)},${absoluto % 10} %`;
}

/** «Bs 12,50 por kg», o una raya si no queda nada. */
function costoPromedio(a: ArticuloValorizado): string {
  const unitario = costoUnitario(a.cantidad, a.valor as Centavos);
  return unitario === null ? '—' : `${formatearMontoExacto(unitario)} por ${cantidad(1000n, a.articulo.unidad).replace(/^1 /, '')}`;
}

export default async function InventarioValorizado({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CONTABILIDAD.inventario), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  const sede = sedeDeParametro(ctx, parametro(valores, 'sede'));
  const mesPedido = parametro(valores, 'mes');
  const mes = mesPedido ? mesDeParametro(mesPedido, ctx.hoy) : undefined;
  const sedes = sede ? ctx.sedes.filter((s) => s.id === sede) : ctx.sedes;
  const variasSedes = sedes.length > 1;

  const leidas = await (await inventarioRepository()).existencias({ conValor: true });
  const articulos = leidas.exito ? leidas.valor.map((a) => valorizar(a, sedes)) : [];
  const total = articulos.reduce((t, a) => t + a.valor, 0);
  const porTipo = TIPOS_EN_ORDEN.map((tipo) => {
    const delTipo = articulos.filter((a) => a.articulo.tipo === tipo);
    return {
      tipo,
      articulos: delTipo,
      porSede: new Map(sedes.map((s) => [s.id as string, delTipo.reduce((t, a) => t + (a.porSede.get(s.id) ?? 0), 0)])),
      valor: delTipo.reduce((t, a) => t + a.valor, 0),
    };
  });

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Inventario"
        resaltado="valorizado"
        descripcion={`Lo que vale hoy lo que hay ${sede ? `en ${sedes[0]?.nombre ?? 'la sede'}` : 'en las sedes'}, al costo de compra según el libro de inventario.`}
        acciones={
          <>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.historial} icono="libro" variante="suave">
              Ver historial valorizado
            </EnlaceDeAccion>
            <BotonImprimir>Imprimir</BotonImprimir>
          </>
        }
      />
      <PestanasDeContabilidad activa={RUTAS_CONTABILIDAD.inventario} mes={mes} sede={sede} />
      <div className="panel-sin-imprimir">
        <SelectorDeSedeContable ctx={ctx} base={RUTAS_CONTABILIDAD.inventario} mes={mes} sede={sede} />
      </div>

      {!leidas.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el inventario">
          <p>{leidas.error}</p>
        </Aviso>
      ) : articulos.length === 0 ? (
        <EstadoVacio
          frase="Aún no hay inventario"
          detalle="Cuando registres lo que hay en el estante o una compra, aquí verás cuánto vale."
          accion={
            <EnlaceDeAccion href={RUTAS_INVENTARIO.inicio} icono="almacen">
              Ir al inventario
            </EnlaceDeAccion>
          }
        />
      ) : (
        <>
          <section aria-label="Valor total" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Indicador icono="almacen" etiqueta="Valor del inventario hoy" cifra={monto(total)} detalle="Insumos, lote por lote (PEPS); uniformes, utensilios y otros, al costo promedio." />
          </section>

          <section aria-labelledby="por-tipo" className="grid gap-3">
            <h2 id="por-tipo" className="t-display text-3xl text-estructural">
              Por tipo
            </h2>
            <div className="overflow-x-auto rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta">
              <table className="w-full min-w-[30rem] text-left print:min-w-0">
                <caption className="sr-only">Valor del inventario por tipo{variasSedes ? ' y sede' : ''}, con la parte de cada tipo en el total</caption>
                <thead>
                  <tr className="border-b-2 border-linea bg-superficie-alterna text-sm text-tinta-suave">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Tipo
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">
                      Artículos
                    </th>
                    {sedes.map((s) => (
                      <th key={s.id} scope="col" className="px-3 py-3 text-right font-semibold">
                        {s.nombre}
                      </th>
                    ))}
                    {variasSedes ? (
                      <th scope="col" className="px-3 py-3 text-right font-semibold">
                        Total
                      </th>
                    ) : null}
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Parte del total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {porTipo.map((t) => (
                    <tr key={t.tipo} className="border-b border-linea">
                      <th scope="row" className="px-4 py-3 font-semibold text-tinta">
                        {PLURAL_DE_TIPO[t.tipo]}
                      </th>
                      <td className="px-3 py-3 text-right tabular-nums">{t.articulos.length}</td>
                      {sedes.map((s) => (
                        <td key={s.id} className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                          {monto(t.porSede.get(s.id) ?? 0)}
                        </td>
                      ))}
                      {variasSedes ? <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{monto(t.valor)}</td> : null}
                      <td className="px-4 py-3 text-right whitespace-nowrap text-tinta-suave tabular-nums">{porcentaje(t.valor, total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-bold text-tinta">
                      Total
                    </th>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{articulos.length}</td>
                    {sedes.map((s) => (
                      <td key={s.id} className="px-3 py-3 text-right font-bold whitespace-nowrap tabular-nums">
                        {monto(porTipo.reduce((x, t) => x + (t.porSede.get(s.id) ?? 0), 0))}
                      </td>
                    ))}
                    {variasSedes ? <td className="px-3 py-3 text-right text-lg font-black whitespace-nowrap text-estructural tabular-nums">{monto(total)}</td> : null}
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums">{total > 0 ? '100 %' : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section aria-labelledby="por-articulo" className="grid gap-5">
            <h2 id="por-articulo" className="t-display text-3xl text-estructural">
              Por artículo
            </h2>
            {porTipo
              .filter((t) => t.articulos.length > 0)
              .map((t) => (
                <TablaDeArticulos key={t.tipo} tipo={t.tipo} articulos={t.articulos} sedes={sedes} />
              ))}
          </section>
        </>
      )}
    </div>
  );
}

function TablaDeArticulos({ tipo, articulos, sedes }: { readonly tipo: TipoDeArticulo; readonly articulos: readonly ArticuloValorizado[]; readonly sedes: readonly SedeOperable[] }) {
  const variasSedes = sedes.length > 1;
  const conTarjeta = tipo === 'insumo';
  return (
    <div className="overflow-x-auto rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta">
      <table className="w-full min-w-[36rem] text-left print:min-w-0">
        <caption className="px-4 pt-4 pb-2 text-left text-lg font-bold text-estructural">{PLURAL_DE_TIPO[tipo]}</caption>
        <thead>
          <tr className="border-b-2 border-linea bg-superficie-alterna text-sm text-tinta-suave">
            <th scope="col" className="px-4 py-3 font-semibold">
              Artículo
            </th>
            {sedes.map((s) => (
              <th key={s.id} scope="col" className="px-3 py-3 text-right font-semibold">
                {s.nombre}
              </th>
            ))}
            {variasSedes ? (
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Total
              </th>
            ) : null}
            <th scope="col" className="px-3 py-3 text-right font-semibold">
              Costo promedio
            </th>
            {conTarjeta ? (
              <th scope="col" className="panel-sin-imprimir px-4 py-3 font-semibold">
                <span className="sr-only">Tarjeta PEPS por sede</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {articulos.map((a) => (
            <tr key={a.articulo.id} className="border-b border-linea align-top">
              <th scope="row" className="px-4 py-3 font-semibold text-tinta">
                {a.articulo.nombre}
                <span className="block text-sm font-normal text-tinta-suave">
                  {a.articulo.codigo} · {cantidad(a.cantidad, a.articulo.unidad)}
                </span>
              </th>
              {sedes.map((s) => (
                <td key={s.id} className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                  {monto(a.porSede.get(s.id) ?? 0)}
                </td>
              ))}
              {variasSedes ? <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{monto(a.valor)}</td> : null}
              <td className="px-3 py-3 text-right whitespace-nowrap text-tinta-suave tabular-nums">{costoPromedio(a)}</td>
              {conTarjeta ? (
                <td className="panel-sin-imprimir px-4 py-1">
                  <span className="flex flex-col items-start">
                    {sedes.map((s) => (
                      <Link
                        key={s.id}
                        href={`${RUTAS_CONTABILIDAD.tarjeta}?articulo=${encodeURIComponent(a.articulo.codigo)}&sede=${s.id}`}
                        className="enlace inline-flex min-h-11 items-center font-semibold whitespace-nowrap"
                      >
                        Tarjeta PEPS{variasSedes ? ` · ${s.nombre}` : ''}
                        <span className="sr-only">
                          {' '}
                          de {a.articulo.nombre}
                          {variasSedes ? '' : ` en ${s.nombre}`}
                        </span>
                      </Link>
                    ))}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
