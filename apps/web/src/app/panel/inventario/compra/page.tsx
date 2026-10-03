/**
 * CAPA: Presentation / App — Registrar compra (especificación §6.1; administración).
 *
 * Tres bloques numerados: ¿dónde y a quién?, ¿qué compraste? (por fila: el
 * artículo, la cantidad, lo que pagaste por esa línea tal cual la nota y el
 * vencimiento si lo pide) y ¿cómo pagaste? Una compra en efectivo sale de la
 * caja de la sede y entra en su próximo arqueo. La confirmación muestra cada
 * saldo «antes → ahora» y el total.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import type { TipoDeComprobante } from '@core/application/ports/inventario.port';
import { ETIQUETA_DE_MEDIO, type MedioDePago } from '@core/domain/caja/cobro';
import { inventarioRepository } from '@infra/config/composition-root';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso, CampoDeTexto, CLASE_DE_CAMPO, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, type Parametros } from '../../caja/_componentes';
import { compraAccion } from '../actions';
import { cantidad, ConfirmacionDeOperacion, ElegirSede, EnlaceDeAccion, nombreConVariante, PLURAL_DE_TIPO, TIPOS_EN_ORDEN } from '../_componentes';

export const metadata: Metadata = { title: 'Registrar compra' };

const COMPROBANTES: readonly { valor: TipoDeComprobante; etiqueta: string }[] = [
  { valor: 'factura', etiqueta: 'Factura' },
  { valor: 'recibo', etiqueta: 'Recibo' },
  { valor: 'nota_de_venta', etiqueta: 'Nota de venta' },
  { valor: 'sin_comprobante', etiqueta: 'Sin comprobante' },
];

const MEDIOS: readonly MedioDePago[] = ['efectivo', 'qr', 'transferencia'];

function Paso({ numero, titulo }: { readonly numero: number; readonly titulo: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold text-estructural">
      <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sobre-estructural">{numero}</span>
      {titulo}
    </h2>
  );
}

export default async function RegistrarCompra({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.compra), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.comprar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const repo = await inventarioRepository();
  const hecho = parametro(valores, 'hecho');

  if (hecho) {
    return (
      <ConfirmacionDeOperacion
        repo={repo}
        operacionId={hecho}
        palabra="¡Compra registrada!"
        titulo="Lo comprado ya está en el inventario."
        conValor
        etiquetaDeValor="Total de la compra"
        cerrarHref={RUTAS_INVENTARIO.compra}
        acciones={
          <>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.compra} icono="carrito">
              Registrar otra compra
            </EnlaceDeAccion>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.inicio} icono="almacen" variante="suave">
              Ver inventario
            </EnlaceDeAccion>
          </>
        }
      >
        <p>Si se pagó en efectivo, salió de la caja de la sede y entra en su próximo cierre.</p>
      </ConfirmacionDeOperacion>
    );
  }

  if (!sede) return <EstadoVacio frase="Sin sede" detalle="No hay una sede en la que puedas registrar compras." />;
  const todos = await repo.existencias({});
  const pedidas = Number.parseInt(parametro(valores, 'filas'), 10);
  const filas = Number.isFinite(pedidas) ? Math.min(Math.max(pedidas, 3), 30) : 6;
  const pedido = parametro(valores, 'articulo');
  const primera = todos.exito ? todos.valor.find((a) => a.codigo === pedido)?.variantes[0]?.id : undefined;

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Registrar" resaltado="compra" descripcion={`Sede ${sede.nombre}. Copia los datos de la nota tal cual.`} />
      <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.compra} />
      {!todos.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los artículos">
          <p>{todos.error}</p>
        </Aviso>
      ) : todos.valor.length === 0 ? (
        <EstadoVacio
          frase="Primero, el catálogo"
          detalle="Agrega los artículos que compras (harina, juegos de uniforme…) y luego registra la compra."
          accion={
            <EnlaceDeAccion href={RUTAS_INVENTARIO.articuloNuevo} icono="mas">
              Agregar artículo
            </EnlaceDeAccion>
          }
        />
      ) : (
        <FormularioDelPanel accion={compraAccion} etiqueta="Registrar una compra">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />
          <input type="hidden" name="filas" value={filas} />

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={1} titulo="¿Dónde y a quién?" />
            <CampoDeTexto id="proveedor" etiqueta="Proveedor" opcional maxLength={120} autoComplete="off" placeholder="Por ejemplo: Molino El Trigal" />
            <GrupoDeOpciones nombre="comprobante" leyenda="Comprobante" columnas={2} valor="sin_comprobante" opciones={COMPROBANTES} />
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoDeTexto id="numeroComprobante" etiqueta="Número del comprobante" opcional maxLength={40} autoComplete="off" />
              <CampoDeTexto id="fechaDocumento" etiqueta="Fecha de la nota" opcional type="date" />
            </div>
          </section>

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={2} titulo="¿Qué compraste?" />
            <p className="-mt-2 text-sm text-tinta-suave">Por cada línea: el artículo, cuánto llegó y cuánto pagaste por esa línea. El vencimiento, si el producto lo trae.</p>
            <ol className="grid gap-3">
              {Array.from({ length: filas }, (_, i) => (
                <li key={i} className="grid gap-2 rounded-md border-2 border-linea p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-tinta">Fila {i + 1} · artículo</span>
                    <select name={`variante-${i}`} className={CLASE_DE_CAMPO} defaultValue={i === 0 && primera ? primera : ''}>
                      <option value="">— Elige —</option>
                      {TIPOS_EN_ORDEN.map((t) => {
                        const lista = todos.valor.filter((a) => a.tipo === t);
                        if (lista.length === 0) return null;
                        return (
                          <optgroup key={t} label={PLURAL_DE_TIPO[t]}>
                            {lista.flatMap((a) =>
                              a.variantes.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {nombreConVariante(a.nombre, v.etiqueta)} ({cantidad(2000n, a.unidad).replace(/^2 /, '')}){a.controlaVencimiento ? ' · vence' : ''}
                                </option>
                              )),
                            )}
                          </optgroup>
                        );
                      })}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-tinta">Cantidad</span>
                    <input name={`cantidad-${i}`} inputMode="decimal" autoComplete="off" placeholder="0" className={`${CLASE_DE_CAMPO} text-right`} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-tinta">Pagaste (Bs)</span>
                    <input name={`costo-${i}`} inputMode="decimal" autoComplete="off" placeholder="0,00" className={`${CLASE_DE_CAMPO} text-right`} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-tinta">Vence</span>
                    <input name={`vence-${i}`} type="date" className={CLASE_DE_CAMPO} />
                  </label>
                </li>
              ))}
            </ol>
            {filas < 30 ? (
              <p className="text-sm text-tinta-suave">
                ¿La nota tiene más líneas?{' '}
                <Link href={`${RUTAS_INVENTARIO.compra}?filas=${Math.min(30, filas + 6)}${ctx.sedes.length > 1 ? `&sede=${sede.id}` : ''}`} className="enlace font-semibold">
                  Agregar 6 filas
                </Link>{' '}
                (hazlo antes de escribir).
              </p>
            ) : null}
          </section>

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={3} titulo="¿Cómo pagaste?" />
            <GrupoDeOpciones
              nombre="medio"
              leyenda="Medio de pago"
              columnas={3}
              valor="efectivo"
              opciones={MEDIOS.map((m) => ({
                valor: m,
                etiqueta: ETIQUETA_DE_MEDIO[m],
                detalle: m === 'efectivo' ? `Sale de la caja de ${sede.nombre}` : 'Pide el número de operación',
              }))}
            />
            <CampoDeTexto id="referencia" etiqueta="Número de operación" opcional maxLength={60} autoComplete="off" ayuda="Solo para QR o transferencia: el que aparece en el comprobante." />
          </section>

          <div>
            <BotonGuardar icono="carrito" enviando="Guardando compra…">
              Guardar compra
            </BotonGuardar>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}
