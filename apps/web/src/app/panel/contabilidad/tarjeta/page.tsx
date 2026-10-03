/**
 * CAPA: Presentation / App — Contabilidad · Tarjeta kárdex PEPS (especificación §5.7; administración).
 *
 * La tarjeta clásica de un insumo en una sede (crítica 17): por cada
 * movimiento, de qué compra salió (o a cuál entró) con su cantidad, costo
 * unitario y total; debajo, lo que queda de cada compra y el saldo. Se arma
 * con lo que la base ya descontó (`movimiento_lotes`): el dominio solo acumula,
 * no vuelve a calcular el PEPS. Imprimible.
 *
 * Solo insumos: los uniformes, utensilios y otros se valoran al costo
 * promedio y no tienen lotes.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { LoteDeTarjeta } from '@core/application/ports/contabilidad.port';
import type { MovimientoEnKardex } from '@core/application/ports/inventario.port';
import { costoUnitario, tarjetaPeps, type FilaDeTarjeta } from '@core/domain/contabilidad/tarjeta-peps';
import type { Unidad } from '@core/domain/shared/cantidad';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { contabilidadRepository, inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_CONTABILIDAD } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonImprimir } from '@/presentation/panel/Caja';
import { Chip, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { cantidad, ElegirSede, EnlaceDeAccion, quePaso } from '../../inventario/_componentes';
import { enlaceContable, parametro, sedeDeParametro, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Tarjeta PEPS' };

const CODIGO = /^(INS|UNI|UTE|OTR)-\d{4,}$/;

const ORIGEN_DE_LOTE: Record<LoteDeTarjeta['origen'], string> = { compra: 'la compra', saldo_inicial: 'el saldo inicial', sobrante: 'el sobrante' };

/** «la compra del 05/09 (vence 20/09)»: así se nombra un lote en pantalla. */
function nombreDeLote(lote: LoteDeTarjeta | undefined): string {
  if (!lote) return 'un lote';
  return `${ORIGEN_DE_LOTE[lote.origen]} del ${formatearDiaCorto(lote.fechaIngreso)}${lote.venceEl ? ` (vence ${formatearDiaCorto(lote.venceEl)})` : ''}`;
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function VolverAlInventario() {
  return (
    <EnlaceDeAccion href={RUTAS_CONTABILIDAD.inventario} icono="almacen" variante="suave">
      Ir al inventario valorizado
    </EnlaceDeAccion>
  );
}

export default async function TarjetaPepsPagina({ searchParams }: { readonly searchParams: Parametros }) {
  const valores = await searchParams;
  const codigo = parametro(valores, 'articulo');
  const pedida = parametro(valores, 'sede');
  // Sin sesión, el acceso devuelve a esta misma tarjeta.
  const lectura = await exigirPersonal(enlaceContable(RUTAS_CONTABILIDAD.tarjeta, undefined, pedida || undefined, codigo ? { articulo: codigo } : {}));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  // La tarjeta es de UNA sede: sin elegir, la primera.
  const sedeId = sedeDeParametro(ctx, pedida) ?? ctx.sedes[0]?.id;
  const sede = ctx.sedes.find((s) => s.id === sedeId);

  const encabezado = (descripcion?: string) => (
    <>
      <Link href={RUTAS_CONTABILIDAD.inventario} className="panel-sin-imprimir enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Inventario valorizado
      </Link>
      <EncabezadoDePanel titulo="Tarjeta" resaltado="PEPS" descripcion={descripcion} acciones={descripcion ? <BotonImprimir>Imprimir tarjeta</BotonImprimir> : undefined} />
    </>
  );

  if (!CODIGO.test(codigo)) {
    return (
      <div className="grid gap-6">
        {encabezado()}
        <EstadoVacio frase="Elige un insumo" detalle="En el inventario valorizado, pulsa «Tarjeta PEPS» junto al insumo y la sede que quieras ver." accion={<VolverAlInventario />} />
      </div>
    );
  }
  if (!sede) {
    return (
      <div className="grid gap-6">
        {encabezado()}
        <EstadoVacio frase="Sin sede" detalle="No hay una sede de la que puedas ver la tarjeta." />
      </div>
    );
  }

  const ficha = await (await inventarioRepository()).fichaDeArticulo(codigo, true);
  if (!ficha.exito) {
    return (
      <div className="grid gap-6">
        {encabezado()}
        <Aviso tono="error" titulo="No pudimos abrir el artículo">
          <p>{ficha.error}</p>
        </Aviso>
      </div>
    );
  }
  const a = ficha.valor;
  if (!a) {
    return (
      <div className="grid gap-6">
        {encabezado()}
        <EstadoVacio frase="No encontramos ese artículo" detalle="Puede que ya no esté activo. Elige otro desde el inventario valorizado." accion={<VolverAlInventario />} />
      </div>
    );
  }
  if (a.tipo !== 'insumo' || a.valuacion !== 'peps') {
    return (
      <div className="grid gap-6">
        {encabezado()}
        <EstadoVacio
          frase="Solo para insumos"
          detalle={`La tarjeta PEPS sigue un insumo compra por compra. ${a.nombre} se valora al costo promedio: su valor está en el inventario valorizado.`}
          accion={<VolverAlInventario />}
        />
      </div>
    );
  }

  const leidos = await (await contabilidadRepository()).tarjetaPeps(a.id, sede.id);
  const consulta = `articulo=${encodeURIComponent(a.codigo)}`;
  const descripcion = `${a.nombre} (${a.codigo}) · Sede ${sede.nombre}`;

  if (!leidos.exito) {
    return (
      <div className="grid gap-6">
        {encabezado(descripcion)}
        <Aviso tono="error" titulo="No pudimos armar la tarjeta">
          <p>{leidos.error}</p>
        </Aviso>
      </div>
    );
  }
  const datos = leidos.valor;

  // Orden PEPS de los lotes: la base toma primero la fecha de ingreso y, en la
  // misma fecha, la secuencia. Se pasa la posición en ese orden (no la
  // secuencia sola) para que un lote con fecha anterior pero registrado
  // después quede donde la base lo puso.
  const lotesEnOrden = [...datos.lotes].sort((x, y) => (x.fechaIngreso < y.fechaIngreso ? -1 : x.fechaIngreso > y.fechaIngreso ? 1 : x.secuencia - y.secuencia));
  const ordenDeLotes = new Map<string, number>(lotesEnOrden.map((l, i) => [l.id, i]));
  const lotes = new Map<string, LoteDeTarjeta>(datos.lotes.map((l) => [l.id, l]));
  const movimientos = new Map<string, MovimientoEnKardex>(datos.movimientos.map((m) => [m.id, m]));
  const filas = tarjetaPeps(
    datos.movimientos.map((m) => ({ id: m.id, numero: m.numero, entra: m.entra, sale: m.sale, deltaValor: m.deltaValor ?? (0 as Centavos) })),
    datos.tomas,
    ordenDeLotes,
  );
  const unidad = cantidad(1000n, a.unidad).replace(/^1 /, '');
  // La tarjeta se acumula desde cero: si le faltara historia (el libro trae un
  // máximo de movimientos) o el libro estuviera dañado, su saldo final no
  // coincidiría con el que el propio libro dice. Se avisa en vez de mostrar
  // una tarjeta que no cuadra como si cuadrara.
  const ultima = filas[filas.length - 1];
  const ultimo = ultima ? movimientos.get(ultima.movimientoId) : undefined;
  const descuadre =
    ultima !== undefined &&
    ultimo !== undefined &&
    (ultima.saldoCantidad !== ultimo.disponibleResultante || (ultimo.valorResultante !== null && ultima.saldoValor !== ultimo.valorResultante));

  return (
    <div className="grid gap-6">
      {encabezado(descripcion)}
      <div className="panel-sin-imprimir">
        <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_CONTABILIDAD.tarjeta} consulta={consulta} />
      </div>
      <p className="text-tinta-suave">
        <strong className="text-estructural">Lo primero que entra es lo primero que sale.</strong> Cada salida toma de la compra más antigua; debajo de cada movimiento queda lo que resta de cada compra y el saldo.
      </p>

      {descuadre && ultima && ultimo ? (
        <Aviso tono="error" titulo="La tarjeta no coincide con el saldo del inventario">
          <p>
            Según el libro quedan {cantidad(ultimo.disponibleResultante, a.unidad)}
            {ultimo.valorResultante !== null ? ` por ${formatearMontoExacto(ultimo.valorResultante)}` : ''}; la tarjeta suma {cantidad(ultima.saldoCantidad, a.unidad)} por{' '}
            {formatearMontoExacto(ultima.saldoValor)}. Puede faltar la historia más antigua o haber una diferencia: revisa la verificación del cuadre en el resumen del mes.
          </p>
        </Aviso>
      ) : null}

      {filas.length === 0 ? (
        <EstadoVacio frase="Sin movimientos" detalle={`Cuando entre o salga ${a.nombre.toLowerCase()} en ${sede.nombre}, aquí aparecerá cada compra y cada salida.`} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta">
          <table className="w-full min-w-[46rem] text-left text-sm print:min-w-0">
            <caption className="px-4 pt-4 pb-2 text-left text-base font-bold text-estructural">
              Tarjeta PEPS de {a.nombre} en {sede.nombre}
            </caption>
            <thead>
              <tr className="border-b-2 border-linea bg-superficie-alterna text-tinta-suave">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Fecha
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Qué pasó
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Compra (lote)
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  Cantidad
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  Costo por {unidad}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            {filas.map((f) => {
              const m = movimientos.get(f.movimientoId);
              return m ? <FilasDeMovimiento key={f.movimientoId} fila={f} movimiento={m} lotes={lotes} unidad={a.unidad} /> : null;
            })}
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Un movimiento de la tarjeta: sus tomas (con signo), lo que queda de cada
 * compra y el saldo, en un `<tbody>` propio para que se lea como un grupo.
 */
function FilasDeMovimiento({
  fila,
  movimiento: m,
  lotes,
  unidad,
}: {
  readonly fila: FilaDeTarjeta;
  readonly movimiento: MovimientoEnKardex;
  readonly lotes: ReadonlyMap<string, LoteDeTarjeta>;
  readonly unidad: Unidad;
}) {
  // El sentido lo da el movimiento (la base guarda las tomas en positivo).
  const entra = fila.signo === 1;
  const signo = entra ? '+' : fila.signo === -1 ? '−' : '';
  const filasDeTomas = Math.max(fila.tomas.length, 1);
  const alto = filasDeTomas + fila.capas.length + 1;
  const celdaFecha = (
    <td rowSpan={alto} className="px-4 py-3 align-top whitespace-nowrap">
      <time dateTime={m.fecha} className="font-semibold text-tinta">
        {formatearDiaCorto(m.fecha)}
        <span className="block text-xs font-normal text-tinta-suave">{m.fecha.slice(0, 4)}</span>
      </time>
    </td>
  );
  const celdaQuePaso = (
    <td rowSpan={alto} className="px-3 py-3 align-top">
      <span className="font-semibold text-tinta">{quePaso(m)}</span>
      {m.anulado ? (
        <span className="mt-1 block">
          <Chip tono="rojo" icono="cerrar">
            Anulado
          </Chip>
        </span>
      ) : null}
      {m.detalle ? <span className="block text-tinta-suave">«{m.detalle}»</span> : null}
    </td>
  );

  return (
    <tbody className="border-b-2 border-linea">
      {fila.tomas.length === 0 ? (
        <tr>
          {celdaFecha}
          {celdaQuePaso}
          <td colSpan={4} className="px-3 py-2 text-tinta-suave">
            No tocó ningún lote.
          </td>
        </tr>
      ) : (
        fila.tomas.map((t, i) => {
          const unitario = costoUnitario(t.cantidad, t.valor);
          return (
            <tr key={t.loteId}>
              {i === 0 ? celdaFecha : null}
              {i === 0 ? celdaQuePaso : null}
              <th scope="row" className="px-3 py-2 font-semibold text-tinta">
                {conMayuscula(nombreDeLote(lotes.get(t.loteId)))}
              </th>
              <td className={cn('px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums', entra ? 'text-exito' : 'text-tinta')}>
                {signo}
                {cantidad(t.cantidad, unidad)}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap text-tinta-suave tabular-nums">{unitario === null ? '—' : formatearMontoExacto(unitario)}</td>
              <td className={cn('px-4 py-2 text-right font-bold whitespace-nowrap tabular-nums', entra ? 'text-exito' : 'text-tinta')}>
                {signo}
                {formatearMontoExacto(t.valor)}
              </td>
            </tr>
          );
        })
      )}
      {fila.capas.map((c, i) => {
        const unitario = costoUnitario(c.cantidad, c.valor);
        return (
          <tr key={`capa-${c.loteId}`} className={cn('bg-superficie-alterna/60 text-tinta-suave', i === 0 && 'border-t border-linea')}>
            <th scope="row" className="px-3 py-1.5 font-normal">
              Queda de {nombreDeLote(lotes.get(c.loteId))}
            </th>
            <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{cantidad(c.cantidad, unidad)}</td>
            <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{unitario === null ? '—' : formatearMontoExacto(unitario)}</td>
            <td className="px-4 py-1.5 text-right whitespace-nowrap tabular-nums">{formatearMontoExacto(c.valor)}</td>
          </tr>
        );
      })}
      <tr className={cn('bg-superficie-alterna/60', fila.capas.length === 0 && 'border-t border-linea')}>
        <th scope="row" className="px-3 py-2 font-bold text-estructural">
          Saldo
        </th>
        <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-estructural tabular-nums">{cantidad(fila.saldoCantidad, unidad)}</td>
        <td className="px-3 py-2" />
        <td className="px-4 py-2 text-right font-bold whitespace-nowrap text-estructural tabular-nums">{formatearMontoExacto(fila.saldoValor)}</td>
      </tr>
    </tbody>
  );
}
