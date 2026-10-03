/**
 * CAPA: Presentation / App — Contabilidad · Gastos (especificación §5.7; administración).
 *
 * Los gastos del mes elegido (y de una sede o de todas): fecha, concepto con
 * su icono, qué fue, medio (icono y palabra), monto, comprobante y
 * proveedor. Arriba, el total del mes sin los anulados, separado en efectivo
 * (sale del cajón) y por banco (se coteja con el extracto). Un gasto anulado
 * no se borra: queda tachado, con el chip «Anulado» y su motivo. Registrar y
 * anular van por la caja (`registrar_gasto`, `anular`).
 *
 * La lista llega cortada en `TOPE_DE_LISTA_DEL_MES` filas (el tope del puerto,
 * el mismo que aplica el adaptador). Si se corta, se avisa y, sin concepto
 * elegido, los totales se toman de `resumen_del_mes`, que suma exactamente
 * los mismos gastos sin tope; con un concepto, siguen siendo la suma de la
 * lista y el aviso lo dice.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { TOPE_DE_LISTA_DEL_MES, type GastoEnLista, type TotalesDelMesEnBase } from '@core/application/ports/contabilidad.port';
import type { TipoDeComprobante } from '@core/application/ports/inventario.port';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { contabilidadRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_CONTABILIDAD } from '@/lib/rutas';
import { AreaDeTexto, Aviso } from '@/presentation/formularios/Campos';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Confirmacion, Desplegable, EncabezadoDePanel, EstadoVacio, Indicador } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { Medio } from '../../caja/_componentes';
import { EnlaceDeAccion } from '../../inventario/_componentes';
import { anularGastoAccion } from '../actions';
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
} from '../_componentes';

export const metadata: Metadata = { title: 'Gastos' };

const ETIQUETA_DE_COMPROBANTE: Record<TipoDeComprobante, string> = {
  factura: 'Factura',
  recibo: 'Recibo',
  nota_de_venta: 'Nota de venta',
  sin_comprobante: 'Sin comprobante',
};

/**
 * El icono de un concepto es texto libre en la base (`conceptos.icono`). Solo
 * se dibuja si está en esta lista, que el compilador comprueba contra el set
 * de `Icono`; cualquier otro nombre se muestra como «recibo».
 */
const ICONOS_DE_CONCEPTO: readonly NombreDeIcono[] = [
  'recibo',
  'casa',
  'chispas',
  'grupo',
  'engranaje',
  'documento',
  'campana',
  'flecha',
  'monedas',
  'billete',
  'carrito',
  'tienda',
  'telefono',
  'correo',
  'libro',
  'almacen',
  'paquete',
  'calendario',
  'reloj',
  'escudo',
  'mundo',
  'imprimir',
  'lapiz',
  'usuario',
  'apreton',
  'hotel',
  'graduacion',
  'medalla',
  'candado',
  'gorro',
  'cubiertos',
  'plato',
  'copa',
  'bol',
  'batidor',
  'chaqueta',
  'trigo',
  'torta',
  'lacteo',
];

function iconoDeConcepto(nombre: string): NombreDeIcono {
  return (ICONOS_DE_CONCEPTO as readonly string[]).includes(nombre) ? (nombre as NombreDeIcono) : 'recibo';
}

function suma(lista: readonly GastoEnLista[]): Centavos {
  return lista.reduce((t, g) => t + g.monto, 0) as Centavos;
}

function cuantos(n: number): string {
  return n === 1 ? '1 gasto' : `${n} gastos`;
}

/** Las cifras de arriba, sumadas de la lista o tomadas de la base. */
interface TotalesDeGastos {
  /** Gastos con fecha en el mes (también los que después se anularon). */
  readonly conFecha: Centavos;
  /** Gastos anulados en el mes, de cualquier mes de origen. */
  readonly anulados: Centavos;
  /** Neto en efectivo (lo que salió del cajón). */
  readonly efectivo: Centavos;
  /** Cuántos tienen fecha en el mes; null si la cifra viene de la base, que no los cuenta. */
  readonly cuantos: number | null;
}

/**
 * Como en el resumen del mes (§5.7): suma lo que tiene fecha en el mes y
 * resta lo que se anuló en el mes, aunque fuera de un mes anterior. Así el
 * total de un mes ya pasado no cambia cuando algo se anula después.
 */
function totalesDeLaLista(mes: string, gastos: readonly GastoEnLista[]): TotalesDeGastos {
  const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const anuladosEnElMes = gastos.filter((g) => g.anuladoEl?.startsWith(mes) === true);
  const efectivo = (g: GastoEnLista) => g.medio === 'efectivo';
  return {
    conFecha: suma(delMes),
    anulados: suma(anuladosEnElMes),
    efectivo: (suma(delMes.filter(efectivo)) - suma(anuladosEnElMes.filter(efectivo))) as Centavos,
    cuantos: delMes.length,
  };
}

/**
 * Las mismas cifras sumadas en la base (`resumen_del_mes`): mismos gastos
 * (fecha en el mes; anulados en el mes), misma sede y misma RLS, pero sin el
 * tope de filas de la lista. Solo valen sin filtro de concepto: la base da el
 * neto por concepto, no su parte en efectivo.
 */
function totalesDeLaBase(t: TotalesDelMesEnBase): TotalesDeGastos {
  const efectivo = t.dinero.efectivo;
  return {
    conFecha: t.gastos.total,
    anulados: t.gastos.anulados,
    efectivo: ((efectivo?.gastos ?? 0) - (efectivo?.gastosAnulados ?? 0)) as Centavos,
    cuantos: null,
  };
}

/** «3 gastos con fecha en el mes · menos Bs 50,00 anulados en el mes» (con cifras de la base, el monto en lugar de cuántos). */
function detalleDelTotal(t: TotalesDeGastos): string {
  const conFecha = t.cuantos === null ? `${formatearMontoExacto(t.conFecha)} con fecha en el mes` : `${cuantos(t.cuantos)} con fecha en el mes`;
  return t.anulados === 0 ? conFecha : `${conFecha} · menos ${formatearMontoExacto(t.anulados)} anulados en el mes`;
}

export default async function Gastos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CONTABILIDAD.gastos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  const mes = mesDeParametro(parametro(valores, 'mes'), ctx.hoy);
  const sede = sedeDeParametro(ctx, parametro(valores, 'sede'));
  const puedeRegistrar = tienePermiso(ctx, 'contabilidad.gestionar');
  const puedeAnular = tienePermiso(ctx, 'caja.anular');
  const conSede = ctx.sedes.length > 1 && !sede;

  const repo = await contabilidadRepository();
  const lista = await repo.gastos(mes, sede);
  const todos = lista.exito ? lista.valor : [];
  // Filtro por concepto (§7.5), con los conceptos que aparecen en el mes.
  const conceptos = [...new Set(todos.map((g) => g.conceptoNombre))].sort((a, b) => a.localeCompare(b, 'es'));
  const concepto = conceptos.includes(parametro(valores, 'concepto')) ? parametro(valores, 'concepto') : '';
  const gastos = concepto ? todos.filter((g) => g.conceptoNombre === concepto) : todos;
  // La lista se corta en `TOPE_DE_LISTA_DEL_MES` filas (las más nuevas). Si se cortó,
  // sumarla daría menos: sin concepto elegido, las cifras salen de la base.
  // Solo entonces se pide el resumen, que es una consulta pesada.
  const cortada = todos.length >= TOPE_DE_LISTA_DEL_MES;
  const enBase = cortada && !concepto ? await repo.totalesDelMes(mes, sede) : null;
  const totales = enBase?.exito ? totalesDeLaBase(enBase.valor) : totalesDeLaLista(mes, gastos);
  const completos = !cortada || enBase?.exito === true;
  const total = (totales.conFecha - totales.anulados) as Centavos;
  const enEfectivo = totales.efectivo;

  const registrado = /^\d+$/.test(parametro(valores, 'registrado')) ? parametro(valores, 'registrado') : '';
  const nuevo = registrado ? gastos.find((g) => String(g.numero) === registrado) : undefined;
  const anulado = parametro(valores, 'anulado') === '1';
  const aqui = enlaceContable(RUTAS_CONTABILIDAD.gastos, mes, sede);
  const registrarHref = enlaceContable(RUTAS_CONTABILIDAD.gastoNuevo, undefined, sede);

  return (
    <div className="grid gap-6">
      {registrado ? (
        <Confirmacion
          palabra="¡Registrado!"
          titulo={nuevo ? `Gasto n.º ${nuevo.numero} · ${formatearMontoExacto(nuevo.monto)}` : `Gasto n.º ${registrado} registrado`}
          cerrarHref={aqui}
          acciones={
            puedeRegistrar ? (
              <EnlaceDeAccion href={registrarHref} icono="mas">
                Registrar otro gasto
              </EnlaceDeAccion>
            ) : undefined
          }
        >
          {nuevo ? (
            <>
              <p>
                {nuevo.conceptoNombre}: {nuevo.descripcion.replace(/\.+$/, '')}.
              </p>
              <p>{nuevo.medio === 'efectivo' ? `Salió de la caja de ${nuevo.sedeNombre}: entra en su próximo cierre.` : 'Pagado por banco: no toca el cajón. Cotéjalo con el extracto.'}</p>
            </>
          ) : null}
        </Confirmacion>
      ) : null}
      {anulado ? (
        <Confirmacion palabra="Listo" titulo="El gasto quedó anulado" cerrarHref={aqui} cambios={[{ etiqueta: 'Gasto', antes: 'Vigente', despues: 'Anulado' }]}>
          <p>No se borra: queda tachado en la lista, con su motivo. Si fue en efectivo, vuelve a la caja en el próximo cierre.</p>
        </Confirmacion>
      ) : null}

      <EncabezadoDePanel
        titulo="Gastos"
        descripcion={`Lo que se pagó en ${nombreDelMes(mes)}${sede ? ` en ${ctx.sedes.find((s) => s.id === sede)?.nombre ?? ''}` : ''}: luz, alquiler, sueldos, mantenimiento…`}
        acciones={
          puedeRegistrar ? (
            <EnlaceDeAccion href={registrarHref} icono="mas">
              Registrar gasto
            </EnlaceDeAccion>
          ) : null
        }
      />
      <PestanasDeContabilidad activa={RUTAS_CONTABILIDAD.gastos} mes={mes} sede={sede} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SelectorDeMes base={RUTAS_CONTABILIDAD.gastos} mes={mes} sede={sede} hoy={ctx.hoy} />
        <SelectorDeSedeContable ctx={ctx} base={RUTAS_CONTABILIDAD.gastos} mes={mes} sede={sede} />
      </div>

      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los gastos">
          <p>{lista.error}</p>
        </Aviso>
      ) : (
        <>
          {gastos.length === 0 ? null : (
            <section aria-label="Total del mes" className="grid gap-4 sm:grid-cols-2">
              <Indicador
                icono="recibo"
                etiqueta={`Gastos de ${nombreDelMes(mes)}`}
                cifra={formatearMontoExacto(total)}
                detalle={detalleDelTotal(totales)}
              />
              <Indicador
                icono="billete"
                etiqueta="Salió en efectivo (del cajón)"
                cifra={formatearMontoExacto(enEfectivo)}
                detalle={`Por banco (QR y transferencia): ${formatearMontoExacto((total - enEfectivo) as Centavos)}`}
              />
            </section>
          )}

          {cortada ? (
            <Aviso tono="info" titulo={`La lista muestra los ${TOPE_DE_LISTA_DEL_MES} gastos más nuevos`}>
              <p>
                {completos
                  ? 'Puede haber más gastos en el mes que no salen abajo, y los conceptos para filtrar pueden estar incompletos. Los totales de arriba sí cuentan todos los gastos del mes: los suma la base.'
                  : concepto
                    ? 'Puede haber más gastos en el mes que no salen abajo. Con un concepto elegido, los totales de arriba suman solo los gastos de esta lista: elige «Todos los conceptos» para ver el total completo del mes.'
                    : 'Puede haber más gastos en el mes que no salen abajo, y los totales de arriba suman solo los de esta lista. El total completo está en el resumen del mes.'}
              </p>
            </Aviso>
          ) : null}

          {conceptos.length > 1 ? (
            <nav aria-label="Concepto" className="flex flex-wrap gap-2">
              {['', ...conceptos].map((k) => (
                <Link
                  key={k || 'todos'}
                  href={enlaceContable(RUTAS_CONTABILIDAD.gastos, mes, sede, k ? { concepto: k } : {})}
                  aria-current={concepto === k ? 'true' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border-2 px-4 font-semibold',
                    concepto === k ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
                  )}
                >
                  {k || 'Todos los conceptos'}
                </Link>
              ))}
            </nav>
          ) : null}

          {gastos.length === 0 ? (
            <EstadoVacio
              frase={`Sin gastos en ${nombreDelMes(mes).replace(/ de \d{4}$/, '')}`}
              detalle="No se registró ningún gasto en este mes. Cuando pagues algo del instituto (luz, alquiler, sueldos…), regístralo con su comprobante."
              accion={
                puedeRegistrar ? (
                  <EnlaceDeAccion href={registrarHref} icono="mas" variante="suave">
                    Registrar gasto
                  </EnlaceDeAccion>
                ) : undefined
              }
            />
          ) : (
            <section aria-labelledby="lista-de-gastos" className="grid gap-3">
              <h2 id="lista-de-gastos" className="t-display text-3xl text-estructural">
                Gasto por gasto
              </h2>
              <p className="-mt-2 text-sm text-tinta-suave">Del más nuevo al más antiguo. Los anulados quedan tachados: se restan en el mes en que se anulan.</p>
              <ul className="grid gap-3">
                {gastos.map((g) => (
                  <FilaDeGasto key={g.id} g={g} conSede={conSede} puedeAnular={puedeAnular} mes={mes} sede={sede} nuevo={g.numero === nuevo?.numero} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FilaDeGasto({
  g,
  conSede,
  puedeAnular,
  mes,
  sede,
  nuevo,
}: {
  readonly g: GastoEnLista;
  readonly conSede: boolean;
  readonly puedeAnular: boolean;
  readonly mes: string;
  readonly sede: string | undefined;
  readonly nuevo: boolean;
}) {
  return (
    <li
      data-nuevo={nuevo ? 'si' : undefined}
      className={cn('grid gap-3 rounded-[var(--t-radio-lg)] border-2 bg-tarjeta p-4', nuevo ? 'border-exito/40' : 'border-linea')}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
        <span
          aria-hidden="true"
          className={cn(
            'inline-grid size-11 flex-none place-items-center rounded-full ring-2 ring-linea',
            g.anulado ? 'bg-superficie-alterna text-tinta-suave' : 'bg-superficie-alterna text-estructural',
          )}
        >
          <Icono nombre={iconoDeConcepto(g.conceptoIcono)} tamano={22} />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-estructural">{g.conceptoNombre}</span>
            {g.anulado ? (
              <Chip tono="rojo" icono="cerrar">
                Anulado
              </Chip>
            ) : null}
          </p>
          <p className={cn('mt-0.5', g.anulado ? 'text-tinta-suave line-through' : 'text-tinta')}>{g.descripcion}</p>
          <p className="mt-1 text-sm text-tinta-suave">
            <span className="inline-flex items-center gap-1">
              <Icono nombre="calendario" tamano={14} />
              {formatearDiaCorto(g.fecha)}
            </span>{' '}
            · Gasto n.º {g.numero}
            {conSede ? ` · ${g.sedeNombre}` : ''} · {g.quien}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="t-etiqueta">Medio</dt>
              <dd className="mt-0.5">
                <Medio medio={g.medio} />
                {g.referencia ? <span className="ms-1 text-tinta-suave">· Op. {g.referencia}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="t-etiqueta">Comprobante</dt>
              <dd className="mt-0.5 font-semibold text-tinta">
                {ETIQUETA_DE_COMPROBANTE[g.comprobante]}
                {g.numeroComprobante ? ` n.º ${g.numeroComprobante}` : ''}
              </dd>
            </div>
            {g.proveedor ? (
              <div>
                <dt className="t-etiqueta">Proveedor</dt>
                <dd className="mt-0.5 font-semibold text-tinta">{g.proveedor}</dd>
              </div>
            ) : null}
          </dl>
          {g.anulado ? (
            <p className="mt-2 rounded-md bg-peligro/8 p-3 text-sm text-tinta">
              Anulado{g.anuladoEl ? ` el ${formatearDiaCorto(g.anuladoEl)}` : ''}
              {g.anulacionMotivo ? `: ${g.anulacionMotivo}` : '.'}
            </p>
          ) : null}
        </div>
        <p className={cn('t-display text-3xl leading-none sm:text-right', g.anulado ? 'text-tinta-suave line-through' : 'text-estructural')}>
          {g.anulado ? <span className="sr-only">Anulado: </span> : null}
          {formatearMontoExacto(g.monto)}
        </p>
      </div>
      {puedeAnular && !g.anulado ? (
        <Desplegable titulo={`Anular el gasto n.º ${g.numero}`} icono="papelera" peligro>
          <FormularioDelPanel accion={anularGastoAccion} etiqueta={`Anular el gasto n.º ${g.numero}`}>
            <input type="hidden" name="clave" value={randomUUID()} />
            <input type="hidden" name="id" value={g.id} />
            <input type="hidden" name="mes" value={mes} />
            {sede ? <input type="hidden" name="sede" value={sede} /> : null}
            <p className="text-tinta-suave">
              El gasto no se borra: queda tachado con su motivo y se resta en el mes en que se anula. {g.medio === 'efectivo' ? 'Como fue en efectivo, vuelve a la caja en el próximo cierre.' : ''}
            </p>
            <AreaDeTexto id={`motivo-${g.id}`} name="motivo" etiqueta="¿Por qué se anula?" maxLength={300} rows={2} />
            <div>
              <BotonGuardar variante="peligro" icono="papelera" enviando="Anulando…">
                Anular gasto
              </BotonGuardar>
            </div>
          </FormularioDelPanel>
        </Desplegable>
      ) : null}
    </li>
  );
}
