/**
 * CAPA: Presentation / App — Ficha del artículo (especificación §7.5).
 *
 * Nombre, tipo, unidad y mínimo; lo que hay en cada sede (dos tarjetas); los
 * lotes de un insumo («la compra del 05/09: quedan 3 kg, vence el 20/09») o
 * las tallas de un uniforme; y el historial en frases. La acción principal
 * depende del tipo. Administración ve el valor y puede editar y anular.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { FichaDeArticulo, LoteVigente } from '@core/application/ports/inventario.port';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { COMPORTAMIENTO_POR_TIPO } from '@core/domain/inventario/articulo';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_INVENTARIO, rutaDeArticulo } from '@/lib/rutas';
import { Aviso, CampoDeTexto } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Confirmacion, Dato, Desplegable, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, type Parametros } from '../../caja/_componentes';
import { agregarTallaAccion } from '../actions';
import { cantidad, ChipDeEstado, ConfirmacionDeOperacion, EnlaceDeAccion, FilaDeKardex, InsigniaDeArticulo, PLURAL_DE_TIPO } from '../_componentes';

export const metadata: Metadata = { title: 'Artículo' };

type Props = { readonly params: Promise<{ readonly codigo: string }>; readonly searchParams: Parametros };

const ESTADO_DE_LOTE: Record<LoteVigente['estado'], { tono: 'rojo' | 'amarillo' | 'verde' | 'gris'; texto: string }> = {
  vencido: { tono: 'rojo', texto: 'Vencido' },
  por_vencer: { tono: 'amarillo', texto: 'Por vencer' },
  bien: { tono: 'verde', texto: 'Vigente' },
  sin_vencimiento: { tono: 'gris', texto: 'Sin vencimiento' },
};

const ORIGEN_DE_LOTE: Record<LoteVigente['origen'], string> = { compra: 'La compra', saldo_inicial: 'El saldo inicial', sobrante: 'El sobrante' };

export default async function FichaDelArticulo({ params, searchParams }: Props) {
  const [{ codigo }, valores] = await Promise.all([params, searchParams]);
  const lectura = await exigirPersonal(rutaDeArticulo(codigo));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.leer');
  if (!/^(INS|UNI|UTE|OTR)-\d{4,}$/.test(codigo)) notFound();
  const conValor = tienePermiso(ctx, 'contabilidad.leer');
  const repo = await inventarioRepository();
  const ficha = await repo.fichaDeArticulo(codigo, conValor);
  if (!ficha.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el artículo">
        <p>{ficha.error}</p>
      </Aviso>
    );
  }
  const a = ficha.valor;
  if (!a) notFound();
  const historial = await repo.kardex({ articuloId: a.id, conValor, limite: 30 });
  const comportamiento = COMPORTAMIENTO_POR_TIPO[a.tipo];
  const aqui = rutaDeArticulo(a.codigo);
  const hecho = parametro(valores, 'hecho');
  const anulado = parametro(valores, 'anulado');

  return (
    <div className="grid gap-6">
      {parametro(valores, 'nuevo') ? (
        <Confirmacion
          palabra="¡Listo!"
          titulo={`${a.nombre} ya está en el catálogo con el código ${a.codigo}.`}
          cerrarHref={aqui}
          acciones={
            tienePermiso(ctx, 'inventario.ajustar') ? (
              <EnlaceDeAccion href={RUTAS_INVENTARIO.saldoInicial} icono="almacen">
                Registrar lo que hay
              </EnlaceDeAccion>
            ) : null
          }
        >
          <p>Si ya tienes en el estante, registra el saldo inicial; si llega con una nota, registra la compra.</p>
        </Confirmacion>
      ) : null}
      {parametro(valores, 'editado') ? <Confirmacion palabra="¡Guardado!" titulo="Los cambios del artículo quedaron guardados." cerrarHref={aqui} /> : null}
      {parametro(valores, 'talla') ? <Confirmacion palabra="¡Listo!" titulo="La talla nueva ya aparece en la lista." cerrarHref={aqui} /> : null}
      {anulado ? <Confirmacion palabra="Anulado" titulo="Se deshizo el movimiento y quedó registrado con su motivo." cerrarHref={aqui} /> : null}
      {hecho ? (
        <ConfirmacionDeOperacion
          repo={repo}
          operacionId={hecho}
          palabra="¡Dado de baja!"
          titulo="Salió del inventario y quedó registrado."
          conValor={conValor}
          etiquetaDeValor="Valor que salió"
          cerrarHref={aqui}
        />
      ) : null}

      <EncabezadoDePanel
        gancho={comportamiento.etiqueta}
        titulo={a.nombre}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span>{a.codigo}</span>
            {a.categoria ? <Chip tono="gris">{a.categoria}</Chip> : null}
            {!a.activo ? <Chip tono="rojo">Inactivo</Chip> : null}
          </span>
        }
        acciones={
          <>
            {comportamiento.admiteUso && tienePermiso(ctx, 'inventario.operar') ? (
              <EnlaceDeAccion href={`${RUTAS_INVENTARIO.usar}?articulo=${a.codigo}`} icono="bol">
                Usar en clase
              </EnlaceDeAccion>
            ) : null}
            {tienePermiso(ctx, 'inventario.comprar') ? (
              <EnlaceDeAccion href={`${RUTAS_INVENTARIO.compra}?articulo=${a.codigo}`} icono="carrito" variante="secundario">
                Registrar compra
              </EnlaceDeAccion>
            ) : null}
            {tienePermiso(ctx, 'inventario.operar') ? (
              <EnlaceDeAccion href={`${RUTAS_INVENTARIO.baja}?articulo=${a.codigo}`} icono="papelera" variante="suave">
                Dar de baja
              </EnlaceDeAccion>
            ) : null}
            {tienePermiso(ctx, 'inventario.catalogo') ? (
              <EnlaceDeAccion href={`${aqui}/editar`} icono="lapiz" variante="suave">
                Editar
              </EnlaceDeAccion>
            ) : null}
          </>
        }
      />

      <div className="flex items-center gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4">
        <InsigniaDeArticulo icono={a.icono} tamano="lg" />
        <dl className="grid flex-1 gap-3 sm:grid-cols-3">
          <Dato etiqueta="Se cuenta en">{cantidad(1000n, a.unidad).replace(/^1 /, '')}</Dato>
          <Dato etiqueta="Avísame con menos de">{a.stockMinimo > 0n ? cantidad(a.stockMinimo, a.unidad) : 'Sin aviso'}</Dato>
          {a.tipo === 'uniforme' ? <Dato etiqueta="Precio de venta">{a.precioVenta ? formatearMontoExacto(a.precioVenta) : 'Precio por definir'}</Dato> : null}
          {a.tipo === 'insumo' ? <Dato etiqueta="Vencimiento">{a.controlaVencimiento ? 'Cada compra lleva su fecha' : 'No vence'}</Dato> : null}
        </dl>
      </div>

      <SaldoPorSede articulo={a} conValor={conValor} />

      {a.tipo === 'insumo' ? <Lotes articulo={a} puedeDarDeBaja={tienePermiso(ctx, 'inventario.operar')} /> : null}

      {a.tipo === 'uniforme' && tienePermiso(ctx, 'inventario.catalogo') ? (
        <Desplegable titulo="Agregar una talla" icono="mas">
          <FormularioDelPanel accion={agregarTallaAccion} etiqueta="Agregar una talla">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="codigo" value={a.codigo} />
            <input type="hidden" name="existentes" value={a.variantes.map((v) => v.etiqueta).join('|')} />
            <CampoDeTexto id="talla" etiqueta="Talla nueva" maxLength={20} autoComplete="off" ayuda="Por ejemplo XXL o 3XL." />
            <div>
              <BotonGuardar icono="mas">Agregar talla</BotonGuardar>
            </div>
          </FormularioDelPanel>
        </Desplegable>
      ) : null}

      <section aria-labelledby="historial" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="historial" className="t-display text-3xl text-estructural">
            Historial
          </h2>
          <Link href={`${RUTAS_INVENTARIO.historial}?articulo=${a.codigo}`} className="enlace inline-flex min-h-11 items-center font-semibold">
            Ver todo el historial
          </Link>
        </div>
        {!historial.exito ? (
          <Aviso tono="error" titulo="No pudimos cargar el historial">
            <p>{historial.error}</p>
          </Aviso>
        ) : historial.valor.length === 0 ? (
          <EstadoVacio frase="Sin movimientos" detalle={`Cuando entre o salga ${a.nombre.toLowerCase()}, aquí se contará qué pasó.`} />
        ) : (
          <ul className="grid gap-2">
            {historial.valor.map((m) => (
              <FilaDeKardex key={m.id} m={m} conArticulo={a.tipo === 'uniforme'} puedeAnular={tienePermiso(ctx, 'inventario.anular')} />
            ))}
          </ul>
        )}
      </section>

      <p>
        <Link href={`${RUTAS_INVENTARIO.inicio}?tipo=${a.tipo}`} className="enlace inline-flex min-h-11 items-center font-semibold">
          ← Volver a {PLURAL_DE_TIPO[a.tipo].toLowerCase()}
        </Link>
      </p>
    </div>
  );
}

function SaldoPorSede({ articulo: a, conValor }: { readonly articulo: FichaDeArticulo; readonly conValor: boolean }) {
  const sedes = a.variantes[0]?.sedes ?? [];
  return (
    <section aria-label="Lo que hay en cada sede" className="grid gap-3 md:grid-cols-2">
      {sedes.map((s) => {
        const deSede = a.variantes.map((v) => ({ v, x: v.sedes.find((y) => y.sedeId === s.sedeId) }));
        const disponible = deSede.reduce((t, d) => t + (d.x ? d.x.disponible - d.x.vencido : 0n), 0n);
        const prestado = deSede.reduce((t, d) => t + (d.x?.prestado ?? 0n), 0n);
        const vencido = deSede.reduce((t, d) => t + (d.x?.vencido ?? 0n), 0n);
        const valor = deSede.reduce((t, d) => t + (d.x?.valor ?? 0), 0);
        const total = deSede.reduce((t, d) => t + (d.x?.total ?? 0n), 0n);
        return (
          <article key={s.sedeId} className="rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="t-etiqueta">{s.sedeNombre}</h2>
              {a.tipo !== 'uniforme' ? <ChipDeEstado estado={s.estado} /> : null}
            </div>
            <p className="t-display mt-1 text-5xl leading-none text-estructural">{cantidad(disponible, a.unidad)}</p>
            <p className="mt-1 text-sm text-tinta-suave">{a.tipo === 'utensilio' ? 'en el estante' : 'para usar'}</p>
            <ul className="mt-3 grid gap-1 text-sm">
              {prestado > 0n ? <li>Prestados: {cantidad(prestado, a.unidad)}</li> : null}
              {vencido > 0n ? <li className="font-semibold text-peligro">Vencidos (no se usan): {cantidad(vencido, a.unidad)}</li> : null}
              {a.tipo === 'insumo' && s.proximoVencimiento ? <li>Lo próximo vence el {formatearDiaCorto(s.proximoVencimiento)}</li> : null}
              {conValor ? (
                <li className="text-tinta-suave">
                  Valor: <strong className="text-estructural">{formatearMontoExacto(valor as Centavos)}</strong>
                  {total > 0n && a.valuacion === 'promedio'
                    ? ` · costo promedio ${formatearMontoExacto(Math.round((valor * 1000) / Number(total)) as Centavos)} por ${cantidad(1000n, a.unidad).replace(/^1 /, '')}`
                    : ''}
                </li>
              ) : null}
            </ul>
            {a.tipo === 'uniforme' ? (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Por talla">
                {deSede.map(({ v, x }) => (
                  <li key={v.id}>
                    <Chip tono={x && x.disponible > 0n ? 'azul' : 'gris'} contorno>
                      <span className={x && x.disponible > 0n ? '' : 'line-through'}>
                        {v.etiqueta}: {x ? cantidad(x.disponible, 'unidad').replace(/ unidad(es)?$/, '') : '0'}
                      </span>
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function Lotes({ articulo: a, puedeDarDeBaja }: { readonly articulo: FichaDeArticulo; readonly puedeDarDeBaja: boolean }) {
  return (
    <section aria-labelledby="lotes" className="grid gap-3">
      <h2 id="lotes" className="t-display text-3xl text-estructural">
        Lo que queda de cada compra
      </h2>
      <p className="-mt-2 text-sm text-tinta-suave">Lo primero que entra es lo primero que sale: se usa primero lo más antiguo que no esté vencido.</p>
      {a.lotes.length === 0 ? (
        <EstadoVacio frase="No queda nada" detalle="Cuando registres una compra, aparecerá aquí con su fecha de vencimiento." />
      ) : (
        <ul className="grid gap-2">
          {a.lotes.map((l) => {
            const e = ESTADO_DE_LOTE[l.estado];
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linea bg-tarjeta p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">
                    {ORIGEN_DE_LOTE[l.origen]} del {formatearDiaCorto(l.fechaIngreso)} · {l.sedeNombre}
                  </span>
                  <span className="text-sm text-tinta-suave">
                    Quedan {cantidad(l.cantidadRestante, l.unidad)} de {cantidad(l.cantidadInicial, l.unidad)}
                    {l.venceEl ? ` · vence el ${formatearDiaCorto(l.venceEl)}` : ''}
                  </span>
                </span>
                <Chip tono={e.tono}>{e.texto}</Chip>
                {l.estado === 'vencido' && puedeDarDeBaja ? (
                  <Link href={`${RUTAS_INVENTARIO.baja}?articulo=${a.codigo}&lote=${l.id}&sede=${l.sedeId}`} className="enlace inline-flex min-h-11 items-center font-semibold">
                    Dar de baja
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

