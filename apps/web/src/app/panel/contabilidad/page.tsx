/**
 * CAPA: Presentation / App — Contabilidad · Resumen del mes (especificación
 * §5.7 y §7.5; solo administración).
 *
 * Pocas cosas, grandes y en orden de importancia:
 *   1. el RESULTADO del mes («Ganancia», «Pérdida» o «Sin resultado») con su
 *      cuenta en filas: ingresos − costo de lo usado − gastos − diferencias
 *      de caja;
 *   2. el dinero que entró y salió por medio, con las frases que explican por
 *      qué no coincide con el resultado;
 *   3. dos cifras de hoy: lo que deben los alumnos y el valor del inventario;
 *   4. el detalle (por grupo, por tipo de costo, por concepto), plegado;
 *   5. el cuadre del inventario del mes y la revisión de hoy (libro y saldos).
 *
 * La base suma (`resumen_del_mes`, `verificar_cuadre`) y el caso de uso
 * combina (`resumenParaPantalla`): aquí solo se muestra. Los signos de la
 * cuenta se eligen por el signo de cada cifra para no escribir «− -Bs 5».
 * Es una vista de gestión, no un estado financiero oficial.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { etiquetaDeCosto, resumenParaPantalla } from '@core/application/panel/contabilidad/contabilidad.usecase';
import type { ClaseDeDiferencia, CuadreDeLaBase, TotalesDelMesEnBase } from '@core/application/ports/contabilidad.port';
import { ETIQUETA_DE_MEDIO, MEDIOS_DE_PAGO } from '@core/domain/caja/cobro';
import type { ClaseDeResultado, FlujoDelMes, ResultadoDelMes } from '@core/domain/contabilidad/resumen';
import { sedeDeTrabajo } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos, FechaISO, Resultado } from '@core/domain/shared/tipos-base';
import { contabilidadRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearDia } from '@/lib/fechas';
import { RUTAS_CAJA, RUTAS_CONTABILIDAD } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';
import { BotonImprimir } from '@/presentation/panel/Caja';
import { Chip, Dato, Desplegable, EncabezadoDePanel, Indicador } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';
import { ICONO_DE_MEDIO } from '../caja/_componentes';
import {
  enlaceContable,
  mesDeParametro,
  nombreDelMes,
  parametro,
  PestanasDeContabilidad,
  sedeDeParametro,
  SelectorDeMes,
  SelectorDeSedeContable,
  type Parametros,
} from './_componentes';

export const metadata: Metadata = { title: 'Resumen del mes' };

export default async function ResumenDelMes({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CONTABILIDAD.resumen), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  const mes = mesDeParametro(parametro(valores, 'mes'), ctx.hoy);
  const sede = sedeDeParametro(ctx, parametro(valores, 'sede'));
  const esMesActual = mes === ctx.hoy.slice(0, 7);
  // «Lo que deben» de la caja se ve por sede: con todas las sedes, el enlace va a la de trabajo.
  const trabajo = sedeDeTrabajo(ctx);

  const repo = await contabilidadRepository();
  const [totales, cuadre] = await Promise.all([repo.totalesDelMes(mes, sede), repo.verificarCuadre(sede)]);
  // Los dos resultados fallan por separado: sin totales se pierde lo del mes,
  // pero la revisión del cuadre (que es de hoy) se sigue mostrando.
  const datos = totales.exito ? { base: totales.valor, resumen: resumenParaPantalla(totales.valor) } : null;

  // El mes y la sede van también en el encabezado: los selectores no salen al
  // imprimir y el papel tiene que decir de qué mes y de qué sede es.
  const alcance = sede ? `Sede ${ctx.sedes.find((s) => s.id === sede)?.nombre ?? ''}` : ctx.sedes.length > 1 ? 'Todas las sedes' : null;
  const descripcion = [conMayuscula(nombreDelMes(mes)), alcance].filter(Boolean).join(' · ');

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Resumen del mes" descripcion={descripcion} />
      <PestanasDeContabilidad activa={RUTAS_CONTABILIDAD.resumen} mes={mes} sede={sede} />
      <div className="panel-sin-imprimir flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SelectorDeMes base={RUTAS_CONTABILIDAD.resumen} mes={mes} sede={sede} hoy={ctx.hoy} />
        <SelectorDeSedeContable ctx={ctx} base={RUTAS_CONTABILIDAD.resumen} mes={mes} sede={sede} />
      </div>

      {!totales.exito ? (
        <Aviso tono="error" titulo="No pudimos calcular el resumen del mes">
          <p>{totales.error}</p>
        </Aviso>
      ) : null}

      {datos ? (
        <>
          <TarjetaDeResultado resultado={datos.resumen.resultado} mes={mes} />
          <DineroDelMes flujo={datos.resumen.flujo} explicaciones={datos.resumen.explicaciones} />

          <section aria-labelledby="hoy-titulo" className="grid gap-3">
            <h2 id="hoy-titulo" className="t-display text-3xl text-estructural">
              Cifras de hoy
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Indicador
                icono="monedas"
                etiqueta="Lo que deben los alumnos"
                cifra={formatearMontoExacto(datos.base.hoy.deben)}
                detalle={`Todo lo pendiente al ${formatearDia(ctx.hoy)}, de cualquier mes.${!sede && trabajo && ctx.sedes.length > 1 ? ' Suma de todas las sedes; en la caja se ve por sede.' : ''}`}
                accion={
                  sede
                    ? { href: `${RUTAS_CAJA.deben}?sede=${sede}`, texto: 'Ver quién debe' }
                    : trabajo
                      ? { href: `${RUTAS_CAJA.deben}?sede=${trabajo.id}`, texto: ctx.sedes.length > 1 ? `Ver quién debe · ${trabajo.nombre}` : 'Ver quién debe' }
                      : undefined
                }
              />
              <Indicador
                icono="almacen"
                etiqueta="Valor del inventario"
                cifra={formatearMontoExacto(datos.base.hoy.valorInventario)}
                detalle={`Lo que costó lo que hay en el estante al ${formatearDia(ctx.hoy)}.`}
                accion={{ href: enlaceContable(RUTAS_CONTABILIDAD.inventario, mes, sede), texto: 'Ver inventario valorizado' }}
              />
            </div>
          </section>

          <section aria-labelledby="detalle-titulo" className="grid gap-3">
            <h2 id="detalle-titulo" className="t-display sr-only text-3xl text-estructural print:not-sr-only">
              Detalle del mes
            </h2>
            {/* En pantalla, plegado; al imprimir, desplegado (un <details> cerrado no sale en papel). */}
            <div className="print:hidden">
              <Desplegable titulo="Ver el detalle del mes" icono="documento">
                <DetalleDelMes base={datos.base} resultado={datos.resumen.resultado} />
              </Desplegable>
            </div>
            <div className="hidden print:block">
              <DetalleDelMes base={datos.base} resultado={datos.resumen.resultado} />
            </div>
          </section>
        </>
      ) : null}

      <section aria-labelledby="cuadre-titulo" className="grid gap-4">
        <h2 id="cuadre-titulo" className="t-display text-3xl text-estructural">
          Cuadre del inventario
        </h2>
        {datos ? <CuentaDelInventario base={datos.base} diferencia={datos.resumen.cuadreDelMes} esMesActual={esMesActual} hoy={ctx.hoy} /> : null}
        <RevisionDeHoy cuadre={cuadre} hoy={ctx.hoy} />
      </section>

      <footer className="flex flex-col gap-3 border-t-2 border-linea pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-tinta-suave">
          <Icono nombre="info" tamano={20} className="mt-0.5 flex-none text-estructural" />
          <span>Vista de gestión: no es un estado financiero oficial.</span>
        </p>
        <BotonImprimir>Imprimir</BotonImprimir>
      </footer>
    </div>
  );
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function absoluto(monto: Centavos): Centavos {
  return Math.abs(monto) as Centavos;
}

// ---------------------------------------------------------------- Signos de la cuenta

type Signo = '+' | '−' | '=' | '';

/** El signo se ve grande y se lee en palabras («menos»): un lector de pantalla se come «−». */
function Operador({ signo }: { readonly signo: Signo }) {
  const palabra = { '+': 'más', '−': 'menos', '=': 'igual a', '': '' }[signo];
  return (
    <span className="inline-block w-6 flex-none text-center text-2xl leading-none font-black text-estructural">
      <span aria-hidden="true">{signo}</span>
      {palabra ? <span className="sr-only">{palabra} </span> : null}
    </span>
  );
}

/**
 * Una fila de la cuenta. `resta` dice qué hace la cifra con el resultado
 * cuando es positiva; si llega negativa (más sobrantes que usos, más
 * anulaciones que cargos), el signo se invierte y se muestra el valor
 * absoluto. La primera fila no lleva «+».
 */
function FilaDeCuenta({
  etiqueta,
  detalle,
  monto,
  resta = false,
  primera = false,
}: {
  readonly etiqueta: string;
  readonly detalle?: ReactNode;
  readonly monto: Centavos;
  readonly resta?: boolean;
  readonly primera?: boolean;
}) {
  const restando = resta ? monto >= 0 : monto < 0;
  const signo: Signo = restando ? '−' : primera ? '' : '+';
  return (
    <tr className="border-b border-linea">
      <th scope="row" className="py-3 pr-3 text-left align-top font-semibold text-tinta">
        <span className="flex items-start gap-2">
          <Operador signo={signo} />
          <span>
            {etiqueta}
            {detalle ? <span className="block text-sm font-normal text-tinta-suave">{detalle}</span> : null}
          </span>
        </span>
      </th>
      <td className="py-3 text-right align-top text-lg font-bold whitespace-nowrap text-estructural">{formatearMontoExacto(absoluto(monto))}</td>
    </tr>
  );
}

function FilaDeTotal({ etiqueta, detalle, monto }: { readonly etiqueta: string; readonly detalle?: ReactNode; readonly monto: Centavos }) {
  return (
    <tr className="border-t-4 border-estructural">
      <th scope="row" className="pt-3 pr-3 text-left align-top text-lg font-bold text-tinta">
        <span className="flex items-start gap-2">
          <Operador signo="=" />
          <span>
            {etiqueta}
            {detalle ? <span className="block text-sm font-normal text-tinta-suave">{detalle}</span> : null}
          </span>
        </span>
      </th>
      <td className="pt-3 text-right align-top text-2xl font-black whitespace-nowrap text-estructural">{formatearMontoExacto(monto)}</td>
    </tr>
  );
}

// ---------------------------------------------------------------- 1. Resultado

const TONO_DE_RESULTADO: Record<ClaseDeResultado, { readonly palabra: string; readonly icono: NombreDeIcono; readonly insignia: string; readonly texto: string; readonly borde: string }> = {
  ganancia: { palabra: 'Ganancia', icono: 'check', insignia: 'bg-exito/12 text-exito', texto: 'text-exito', borde: 'border-exito/40' },
  perdida: { palabra: 'Pérdida', icono: 'alerta', insignia: 'bg-peligro/10 text-peligro', texto: 'text-peligro', borde: 'border-peligro/40' },
  sin_resultado: { palabra: 'Sin resultado', icono: 'info', insignia: 'bg-superficie-alterna text-estructural', texto: 'text-estructural', borde: 'border-linea' },
};

function fraseDelResultado(r: ResultadoDelMes): string {
  if (r.clase === 'ganancia') return 'Los ingresos fueron más que el costo de lo usado, los gastos y las diferencias de caja.';
  if (r.clase === 'perdida') return 'El costo de lo usado, los gastos y las diferencias de caja fueron más que los ingresos.';
  const sinMovimiento = r.ingresos === 0 && r.costoDeLoUsado === 0 && r.gastos === 0 && r.diferenciasDeCaja === 0;
  return sinMovimiento ? 'Este mes todavía no tiene ingresos, costos ni gastos.' : 'Los ingresos alcanzaron justo para cubrir costos y gastos.';
}

function detalleDeDiferencias(diferencias: Centavos): string {
  if (diferencias > 0) return 'Faltó dinero al cerrar caja';
  if (diferencias < 0) return 'Sobró dinero al cerrar caja';
  return 'No faltó ni sobró dinero al cerrar caja';
}

function TarjetaDeResultado({ resultado: r, mes }: { readonly resultado: ResultadoDelMes; readonly mes: string }) {
  const tono = TONO_DE_RESULTADO[r.clase];
  return (
    <section
      aria-labelledby="resultado-titulo"
      className={cn('grid gap-6 rounded-[var(--t-radio-xl)] border-2 bg-tarjeta p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start', tono.borde)}
    >
      <div>
        <h2 id="resultado-titulo" className="t-etiqueta">
          Resultado de {nombreDelMes(mes)}
        </h2>
        <p className="mt-3 flex items-center gap-3">
          <span className={cn('inline-grid size-14 flex-none place-items-center rounded-full', tono.insignia)}>
            <Icono nombre={tono.icono} tamano={28} />
          </span>
          <span className={cn('text-3xl font-bold', tono.texto)}>{tono.palabra}</span>
        </p>
        <p className="t-display mt-4 text-5xl leading-none text-estructural sm:text-7xl">{formatearMontoExacto(absoluto(r.resultado))}</p>
        <p className="mt-3 max-w-md text-tinta-suave">{fraseDelResultado(r)}</p>
      </div>

      <table className="w-full text-left">
        <caption className="pb-2 text-left font-bold text-estructural">Cómo se calcula</caption>
        <tbody>
          <FilaDeCuenta primera etiqueta="Ingresos" detalle="Lo que el mes generó: cuotas, ventas y uniformes" monto={r.ingresos} />
          <FilaDeCuenta resta etiqueta="Costo de lo usado" detalle="Lo que salió del inventario: usado en clase, entregado o dado de baja" monto={r.costoDeLoUsado} />
          <FilaDeCuenta resta etiqueta="Gastos" detalle="Lo que costó funcionar"monto={r.gastos} />
          <FilaDeCuenta resta etiqueta="Diferencias de caja" detalle={detalleDeDiferencias(r.diferenciasDeCaja)} monto={r.diferenciasDeCaja} />
        </tbody>
        <tfoot>
          <FilaDeTotal etiqueta="Resultado del mes" detalle={tono.palabra} monto={r.resultado} />
        </tfoot>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------- 2. Dinero del mes

interface FilaDeDinero {
  readonly clave: string;
  readonly etiqueta: string;
  readonly detalle?: string;
  readonly icono: NombreDeIcono;
  /** Nulo en la fila de los arqueos: solo cambia el neto. */
  readonly entro: Centavos | null;
  readonly salio: Centavos | null;
  readonly neto: Centavos;
}

function filasDeDinero(flujo: FlujoDelMes): readonly FilaDeDinero[] {
  const filas: FilaDeDinero[] = MEDIOS_DE_PAGO.map((m) => ({
    clave: m,
    etiqueta: ETIQUETA_DE_MEDIO[m],
    icono: ICONO_DE_MEDIO[m],
    entro: flujo.porMedio[m].entro,
    salio: flujo.porMedio[m].salio,
    neto: flujo.porMedio[m].neto,
  }));
  // Lo que faltó en los arqueos también salió (y lo que sobró, entró): va en
  // su propia fila para que la columna «Neto» sume igual que el total.
  const d = flujo.diferenciasDeCaja;
  if (d !== 0) {
    filas.push({
      clave: 'arqueos',
      etiqueta: d > 0 ? 'Faltó en los arqueos' : 'Sobró en los arqueos',
      detalle: d > 0 ? 'Efectivo que faltó al cerrar caja' : 'Efectivo que sobró al cerrar caja',
      icono: d > 0 ? 'alerta' : 'billete',
      entro: null,
      salio: null,
      neto: -d as Centavos,
    });
  }
  return filas;
}

function Monto({ monto }: { readonly monto: Centavos | null }) {
  if (monto === null) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">no aplica</span>
      </>
    );
  }
  return <>{formatearMontoExacto(monto)}</>;
}

function DineroDelMes({ flujo, explicaciones }: { readonly flujo: FlujoDelMes; readonly explicaciones: readonly string[] }) {
  const filas = filasDeDinero(flujo);
  return (
    <section aria-labelledby="dinero-titulo" className="grid gap-3">
      <h2 id="dinero-titulo" className="t-display text-3xl text-estructural">
        Dinero del mes
      </h2>
      <p className="text-tinta-suave">Lo que entró y salió de verdad: cobros, gastos y compras.</p>

      {/* En pantallas anchas, tabla; en el celular, una tarjeta por medio (especificación §7.1). */}
      <div className="hidden overflow-hidden rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta sm:block">
        <table className="w-full text-left">
          <caption className="sr-only">Dinero que entró y salió en el mes, por medio de pago</caption>
          <thead>
            <tr className="border-b-2 border-linea bg-superficie-alterna text-sm text-tinta-suave">
              <th scope="col" className="px-4 py-3 font-semibold">
                Medio
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Entró
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Salió
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Neto
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-b border-linea">
                <th scope="row" className="px-4 py-3 text-left font-semibold text-tinta">
                  <span className="flex items-center gap-2">
                    <Icono nombre={f.icono} tamano={20} className="flex-none text-estructural" />
                    <span>
                      {f.etiqueta}
                      {f.detalle ? <span className="block text-sm font-normal text-tinta-suave">{f.detalle}</span> : null}
                    </span>
                  </span>
                </th>
                <td className="px-4 py-3 text-right whitespace-nowrap text-tinta">
                  <Monto monto={f.entro} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-tinta">
                  <Monto monto={f.salio} />
                </td>
                <td className={cn('px-4 py-3 text-right font-bold whitespace-nowrap', f.neto < 0 ? 'text-peligro' : 'text-estructural')}>{formatearMontoExacto(f.neto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-superficie-alterna">
              <th scope="row" className="px-4 py-3 text-left text-lg font-bold text-tinta">
                Total del mes
              </th>
              <td className="px-4 py-3 text-right text-lg font-bold whitespace-nowrap text-estructural">{formatearMontoExacto(flujo.entro)}</td>
              <td className="px-4 py-3 text-right text-lg font-bold whitespace-nowrap text-estructural">{formatearMontoExacto(flujo.salio)}</td>
              <td className={cn('px-4 py-3 text-right text-xl font-black whitespace-nowrap', flujo.neto < 0 ? 'text-peligro' : 'text-estructural')}>
                {formatearMontoExacto(flujo.neto)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="grid gap-2 sm:hidden" aria-label="Dinero que entró y salió en el mes, por medio de pago">
        {filas.map((f) => (
          <li key={f.clave} className="rounded-md border-2 border-linea bg-tarjeta p-3">
            <p className="flex items-center gap-2 font-semibold text-estructural">
              <Icono nombre={f.icono} tamano={20} className="flex-none" />
              {f.etiqueta}
            </p>
            {f.detalle ? <p className="text-sm text-tinta-suave">{f.detalle}</p> : null}
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              {f.entro !== null ? <Dato etiqueta="Entró">{formatearMontoExacto(f.entro)}</Dato> : null}
              {f.salio !== null ? <Dato etiqueta="Salió">{formatearMontoExacto(f.salio)}</Dato> : null}
              <Dato etiqueta="Neto">
                <span className={f.neto < 0 ? 'text-peligro' : 'text-estructural'}>{formatearMontoExacto(f.neto)}</span>
              </Dato>
            </dl>
          </li>
        ))}
        <li className="rounded-md border-2 border-estructural bg-superficie-alterna p-3">
          <p className="font-bold text-tinta">Total del mes</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <Dato etiqueta="Entró">{formatearMontoExacto(flujo.entro)}</Dato>
            <Dato etiqueta="Salió">{formatearMontoExacto(flujo.salio)}</Dato>
            <Dato etiqueta="Neto">
              <span className={flujo.neto < 0 ? 'text-peligro' : 'text-estructural'}>{formatearMontoExacto(flujo.neto)}</span>
            </Dato>
          </dl>
        </li>
      </ul>

      {explicaciones.length > 0 ? (
        <div className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4">
          <h3 className="font-bold text-estructural">¿Por qué el dinero no es igual al resultado?</h3>
          <ul className="mt-2 grid gap-2">
            {explicaciones.map((e) => (
              <li key={e} className="flex items-start gap-2 text-tinta">
                <Icono nombre="info" tamano={20} className="mt-0.5 flex-none text-estructural" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- 4. Detalle

interface FilaDeDetalle {
  readonly clave: string;
  readonly etiqueta: string;
  readonly monto: Centavos;
}

function TablaDeDetalle({
  titulo,
  columna,
  filas,
  total,
  vacio,
  nota,
}: {
  readonly titulo: string;
  readonly columna: string;
  readonly filas: readonly FilaDeDetalle[];
  readonly total: Centavos;
  readonly vacio: string;
  readonly nota?: string;
}) {
  return (
    <div className="grid content-start gap-2">
      <h3 className="font-bold text-estructural">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-tinta-suave">{vacio}</p>
      ) : (
        <table className="w-full text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="border-b-2 border-linea text-sm text-tinta-suave">
              <th scope="col" className="py-2 pr-3 font-semibold">
                {columna}
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-b border-linea">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-tinta">
                  {f.etiqueta}
                </th>
                <td className="py-2 text-right font-semibold whitespace-nowrap text-estructural">{formatearMontoExacto(f.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="pt-3 pr-3 text-left font-bold text-tinta">
                Total
              </th>
              <td className="pt-3 text-right font-black whitespace-nowrap text-estructural">{formatearMontoExacto(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      {nota ? <p className="text-sm text-tinta-suave">{nota}</p> : null}
    </div>
  );
}

function DetalleDelMes({ base, resultado }: { readonly base: TotalesDelMesEnBase; readonly resultado: ResultadoDelMes }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <TablaDeDetalle
        titulo="Ingresos por grupo"
        columna="Grupo"
        filas={base.ingresos.porGrupo.map((g) => ({ clave: g.grupo, etiqueta: g.grupo, monto: g.monto }))}
        total={resultado.ingresos}
        vacio="No hubo ingresos este mes."
        nota={base.ingresos.anulados > 0 ? `Ya se restaron ${formatearMontoExacto(base.ingresos.anulados)} de cargos anulados en el mes.` : undefined}
      />
      <TablaDeDetalle
        titulo="Costo de lo usado"
        columna="Qué pasó"
        filas={base.costo.porTipo.map((t) => ({ clave: t.tipo, etiqueta: etiquetaDeCosto(t.tipo), monto: t.monto }))}
        total={resultado.costoDeLoUsado}
        vacio="No salió nada del inventario este mes."
        nota="Las compras no son costo: son dinero que se convirtió en inventario."
      />
      <TablaDeDetalle
        titulo="Gastos por concepto"
        columna="Concepto"
        filas={base.gastos.porConcepto.map((g, i) => ({ clave: `${g.concepto}-${i}`, etiqueta: g.concepto, monto: g.monto }))}
        total={resultado.gastos}
        vacio="No hubo gastos este mes."
        nota={base.gastos.anulados > 0 ? `Ya se restaron ${formatearMontoExacto(base.gastos.anulados)} de gastos anulados en el mes.` : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------- 5. Cuadre del inventario

/**
 * La cuenta del mes con las cifras de la base: valor al empezar + compras
 * + saldos iniciales − sus anulaciones − costo de lo usado = valor al
 * terminar. Las filas de anulaciones y saldos iniciales en cero no se
 * muestran (casi siempre lo están y solo estorban).
 */
function CuentaDelInventario({
  base,
  diferencia,
  esMesActual,
  hoy,
}: {
  readonly base: TotalesDelMesEnBase;
  readonly diferencia: Centavos;
  readonly esMesActual: boolean;
  readonly hoy: FechaISO;
}) {
  const { costo, inventario } = base;
  return (
    <div className="grid gap-3 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 sm:p-5">
      <table className="w-full text-left">
        <caption className="pb-2 text-left text-tinta-suave">Lo que había al empezar, más lo que entró, menos lo que se usó, tiene que dar lo que hay al terminar.</caption>
        <tbody>
          <FilaDeCuenta primera etiqueta="Valor al empezar el mes" detalle={formatearDia(base.desde)} monto={inventario.valorInicial} />
          <FilaDeCuenta etiqueta="Compras" monto={costo.compras} />
          {costo.comprasAnuladas !== 0 ? <FilaDeCuenta resta etiqueta="Compras anuladas" monto={costo.comprasAnuladas} /> : null}
          {costo.saldosIniciales !== 0 ? <FilaDeCuenta etiqueta="Saldos iniciales" detalle="Lo que ya había al empezar a usar el sistema" monto={costo.saldosIniciales} /> : null}
          {costo.saldosInicialesAnulados !== 0 ? <FilaDeCuenta resta etiqueta="Saldos iniciales anulados" monto={costo.saldosInicialesAnulados} /> : null}
          <FilaDeCuenta resta etiqueta="Costo de lo usado" monto={costo.total} />
        </tbody>
        <tfoot>
          <FilaDeTotal etiqueta={esMesActual ? 'Valor hoy' : 'Valor al terminar el mes'} detalle={esMesActual ? formatearDia(hoy) : undefined} monto={inventario.valorFinal} />
        </tfoot>
      </table>
      {diferencia !== 0 ? (
        <Aviso tono="error" titulo="La cuenta del mes no cierra">
          <p>
            Entre la cuenta y el valor al terminar hay una diferencia de {formatearMontoExacto(absoluto(diferencia))}. Avisa a quien da soporte al sistema antes de cerrar el mes.
          </p>
        </Aviso>
      ) : null}
    </div>
  );
}

const CLASE_EN_PALABRAS: Record<ClaseDeDiferencia, string> = {
  cantidad: 'Cantidad',
  valor: 'Valor',
  lotes: 'Lotes PEPS',
  compra: 'Compra',
  cobro: 'Cobro',
};

/** Tope de diferencias que devuelve `verificar_cuadre` (la base corta en 50). */
const TOPE_DE_DIFERENCIAS = 50;

/**
 * Revisión de HOY (no del mes): el libro de movimientos y los saldos dicen lo
 * mismo, artículo por artículo, y cada compra y cada cobro suman lo que deben.
 * Puede no cuadrar sin diferencias en la lista si solo difieren los totales.
 */
function RevisionDeHoy({ cuadre, hoy }: { readonly cuadre: Resultado<CuadreDeLaBase>; readonly hoy: FechaISO }) {
  return (
    <div className="grid gap-2">
      <h3 className="font-bold text-estructural">Revisión del {formatearDia(hoy)}: libro y existencias</h3>
      {!cuadre.exito ? (
        <Aviso tono="error" titulo="No pudimos revisar el cuadre">
          <p>{cuadre.error}</p>
        </Aviso>
      ) : cuadre.valor.cuadra ? (
        <p className="flex flex-wrap items-center gap-3">
          <Chip tono="verde" icono="check">
            Todo cuadra
          </Chip>
          <span className="text-tinta-suave">El libro del inventario y las existencias dicen lo mismo: {formatearMontoExacto(cuadre.valor.valorLibro)}.</span>
        </p>
      ) : (
        <Aviso tono="error" titulo="El inventario no cuadra">
          {cuadre.valor.valorLibro !== cuadre.valor.valorSaldos ? (
            <p>
              El libro suma {formatearMontoExacto(cuadre.valor.valorLibro)} y las existencias suman {formatearMontoExacto(cuadre.valor.valorSaldos)}.
            </p>
          ) : null}
          {cuadre.valor.diferencias.length > 0 ? (
            <ul className="mt-2 grid gap-1.5">
              {cuadre.valor.diferencias.map((d, i) => (
                <li key={`${d.clase}-${i}`}>
                  <span className="font-semibold text-tinta">{CLASE_EN_PALABRAS[d.clase]}:</span> {d.detalle}
                </li>
              ))}
            </ul>
          ) : null}
          {cuadre.valor.diferencias.length >= TOPE_DE_DIFERENCIAS ? <p className="mt-2 text-sm">Se muestran las primeras {TOPE_DE_DIFERENCIAS} diferencias.</p> : null}
          <p className="mt-2">Avisa a quien da soporte al sistema antes de cerrar el mes.</p>
        </Aviso>
      )}
    </div>
  );
}
