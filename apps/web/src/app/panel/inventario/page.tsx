/**
 * CAPA: Presentation / App — Inventario (especificación §7.5).
 *
 * Arriba, lo que hay que hacer (usar en clase, dar de baja y, para
 * administración, comprar y contar) y hasta cinco avisos en frase (bajo el
 * mínimo, vencido, por vencer). Debajo, una pestaña por tipo con lo que hay
 * en cada sede: insumos con su próximo vencimiento, uniformes por talla,
 * utensilios en el estante y prestados. Administración ve además el valor.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ArticuloConExistencias, LoteVigente, PrestamoAbierto } from '@core/application/ports/inventario.port';
import { sedeDeTrabajo, tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_INVENTARIO, RUTAS_PANEL, rutaDeArticulo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, EncabezadoDePanel, EstadoVacio, Mosaico } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';
import { parametro, type Parametros } from '../caja/_componentes';
import { cantidad, ChipDeEstado, EnlaceDeAccion, estadoEnSede, InsigniaDeArticulo, PestanasDeInventario, PLURAL_DE_TIPO, tipoDeParametro } from './_componentes';

export const metadata: Metadata = { title: 'Inventario' };

interface Alerta {
  readonly clave: string;
  readonly frase: string;
  readonly href: string;
  readonly enlace: string;
  readonly grave: boolean;
}

function alertas(articulos: readonly ArticuloConExistencias[], lotes: readonly LoteVigente[], prestamos: readonly PrestamoAbierto[]): Alerta[] {
  const lista: Alerta[] = [];
  for (const p of prestamos.filter((x) => x.atrasado)) {
    lista.push({
      clave: `a-${p.id}`,
      frase: `${p.articuloNombre}: ${p.pendiente === 1 ? '1 pieza' : `${p.pendiente} piezas`} con ${p.destinatario}, atrasado ${p.diasDeAtraso === 1 ? '1 día' : `${p.diasDeAtraso} días`}.`,
      href: RUTAS_INVENTARIO.prestamos,
      enlace: 'Recibir',
      grave: true,
    });
  }
  const codigo = new Map(articulos.map((a) => [a.id as string, a.codigo]));
  for (const l of lotes.filter((x) => x.estado === 'vencido')) {
    lista.push({
      clave: `v-${l.id}`,
      frase: `${l.articuloNombre}: ${cantidad(l.cantidadRestante, l.unidad)} vencidos en ${l.sedeNombre} (compra del ${formatearDiaCorto(l.fechaIngreso)}).`,
      href: `${RUTAS_INVENTARIO.baja}?articulo=${encodeURIComponent(codigo.get(l.articuloId) ?? '')}&lote=${l.id}&sede=${l.sedeId}`,
      enlace: 'Dar de baja',
      grave: true,
    });
  }
  for (const a of articulos.filter((x) => x.stockMinimo > 0n)) {
    for (const v of a.variantes) {
      for (const s of v.sedes.filter((x) => x.estado !== 'bien')) {
        const usable = s.disponible - s.vencido;
        lista.push({
          clave: `m-${v.id}-${s.sedeId}`,
          frase:
            s.estado === 'agotado'
              ? `${a.nombre}${v.etiqueta !== 'Única' ? ` · ${v.etiqueta}` : ''}: se acabó en ${s.sedeNombre}.`
              : `${a.nombre}${v.etiqueta !== 'Única' ? ` · ${v.etiqueta}` : ''}: quedan ${cantidad(usable, a.unidad)} en ${s.sedeNombre} (avisa con menos de ${cantidad(a.stockMinimo, a.unidad)}).`,
          href: rutaDeArticulo(a.codigo),
          enlace: 'Ver',
          grave: s.estado === 'agotado',
        });
      }
    }
  }
  for (const l of lotes.filter((x) => x.estado === 'por_vencer')) {
    lista.push({
      clave: `p-${l.id}`,
      frase: `${l.articuloNombre}: ${cantidad(l.cantidadRestante, l.unidad)} vencen ${l.diasParaVencer === 0 ? 'hoy' : l.diasParaVencer === 1 ? 'mañana' : `en ${l.diasParaVencer} días`} en ${l.sedeNombre}. Úsalos primero.`,
      href: rutaDeArticulo(codigo.get(l.articuloId) ?? ''),
      enlace: 'Ver',
      grave: false,
    });
  }
  return lista;
}

export default async function Inventario({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_PANEL.inventario), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.leer');
  const tipo = tipoDeParametro(parametro(valores, 'tipo'));
  const conValor = tienePermiso(ctx, 'contabilidad.leer');
  const propia = sedeDeTrabajo(ctx);

  const repo = await inventarioRepository();
  const [todos, lotes, prestamos] = await Promise.all([repo.existencias({ conValor }), repo.lotesConAlerta(), repo.prestamosAbiertos({})]);
  const delTipo = todos.exito ? todos.valor.filter((a) => a.tipo === tipo) : [];
  const avisos = todos.exito && lotes.exito ? alertas(todos.valor, lotes.valor, prestamos.exito ? prestamos.valor : []) : [];

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Inventario"
        descripcion={propia ? `Trabajas en ${propia.nombre}. Ves lo que hay en todas las sedes.` : undefined}
        acciones={
          tienePermiso(ctx, 'inventario.catalogo') ? (
            <EnlaceDeAccion href={RUTAS_INVENTARIO.articuloNuevo} icono="mas" variante="suave">
              Artículo nuevo
            </EnlaceDeAccion>
          ) : null
        }
      />

      <section aria-label="Qué quieres hacer" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tienePermiso(ctx, 'inventario.operar') ? (
          <>
            <Mosaico href={RUTAS_INVENTARIO.usar} icono="bol" titulo="Usar en clase" detalle="Descuenta lo que se usó" tono="amarillo" />
            <Mosaico href={RUTAS_INVENTARIO.entregar} icono="chaqueta" titulo="Entregar uniforme" detalle="Por talla, con su cargo" />
            <Mosaico href={RUTAS_INVENTARIO.prestar} icono="cubiertos" titulo="Prestar utensilios" detalle="Y recibirlos de vuelta" />
            <Mosaico href={RUTAS_INVENTARIO.baja} icono="papelera" titulo="Dar de baja" detalle="Vencido, roto, perdido" />
          </>
        ) : null}
        {tienePermiso(ctx, 'inventario.comprar') ? <Mosaico href={RUTAS_INVENTARIO.compra} icono="carrito" titulo="Registrar compra" detalle="Lo que llegó con la nota" /> : null}
        {tienePermiso(ctx, 'inventario.ajustar') ? <Mosaico href={RUTAS_INVENTARIO.contar} icono="check" titulo="Contar" detalle="Compara el estante con el sistema" /> : null}
      </section>

      {!todos.exito || !lotes.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el inventario">
          <p>{!todos.exito ? todos.error : !lotes.exito ? lotes.error : ''}</p>
        </Aviso>
      ) : null}

      {avisos.length > 0 ? (
        <section aria-labelledby="avisos" className="rounded-[var(--t-radio-lg)] border-2 border-accion-fuerte/60 bg-tarjeta p-4 sm:p-5">
          <h2 id="avisos" className="flex items-center gap-2 font-bold text-estructural">
            <Icono nombre="alerta" tamano={20} />
            Para tener en cuenta
          </h2>
          <ul className="mt-3 grid gap-2">
            {avisos.slice(0, 5).map((a) => (
              <li key={a.clave} className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('min-w-0', a.grave ? 'font-semibold text-tinta' : 'text-tinta')}>{a.frase}</span>
                <Link href={a.href} className="enlace inline-flex min-h-11 items-center gap-1 font-semibold">
                  {a.enlace}
                  <Icono nombre="flecha" tamano={16} />
                </Link>
              </li>
            ))}
          </ul>
          {avisos.length > 5 ? <p className="mt-2 text-sm text-tinta-suave">Y {avisos.length - 5} más en las pestañas de abajo.</p> : null}
        </section>
      ) : null}

      <PestanasDeInventario activa={tipo} />

      {todos.exito && delTipo.length === 0 ? (
        <EstadoVacio
          frase={`Aún no hay ${PLURAL_DE_TIPO[tipo].toLowerCase()}`}
          detalle={tienePermiso(ctx, 'inventario.catalogo') ? 'Agrega el primero y registra lo que hay en el estante.' : 'Administración los agrega al catálogo.'}
          accion={
            tienePermiso(ctx, 'inventario.catalogo') ? (
              <EnlaceDeAccion href={`${RUTAS_INVENTARIO.articuloNuevo}?tipo=${tipo}`} icono="mas">
                Agregar artículo
              </EnlaceDeAccion>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3">
          {delTipo.map((a) => (
            <FilaDeArticulo key={a.id} articulo={a} conValor={conValor} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaDeArticulo({ articulo: a, conValor }: { readonly articulo: ArticuloConExistencias; readonly conValor: boolean }) {
  const sedes = a.variantes[0]?.sedes ?? [];
  const valor = conValor ? a.variantes.reduce((t, v) => t + v.sedes.reduce((s, x) => s + (x.valor ?? 0), 0), 0) : null;
  return (
    <li>
      <Link href={rutaDeArticulo(a.codigo)} className="grid gap-3 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 hover:border-estructural lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] lg:items-center">
        <span className="flex min-w-0 items-center gap-3">
          <InsigniaDeArticulo icono={a.icono} />
          <span className="min-w-0">
            <span className="block text-lg leading-tight font-bold text-estructural">{a.nombre}</span>
            <span className="text-sm text-tinta-suave">
              {a.codigo}
              {a.categoria ? ` · ${a.categoria}` : ''}
              {a.tipo === 'uniforme' ? ` · ${a.precioVenta ? formatearMontoExacto(a.precioVenta) : 'Precio por definir'}` : ''}
            </span>
          </span>
        </span>
        <span className="grid gap-2 sm:grid-cols-2">
          {sedes.map((s) => (
            <span key={s.sedeId} className="rounded-md bg-superficie-alterna px-3 py-2">
              <span className="flex items-center justify-between gap-2">
                <span className="t-etiqueta">{s.sedeNombre}</span>
                <ChipDeEstado estado={estadoEnSede(a, s.sedeId)} />
              </span>
              <span className="mt-1 block">
                <EnSede articulo={a} sedeId={s.sedeId} />
              </span>
            </span>
          ))}
        </span>
        {valor !== null ? (
          <span className="text-right text-sm text-tinta-suave lg:min-w-28">
            <span className="block t-etiqueta">Valor</span>
            <span className="font-bold text-estructural">{formatearMontoExacto(valor as Centavos)}</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Lo que hay en una sede, dicho según el tipo. */
function EnSede({ articulo: a, sedeId }: { readonly articulo: ArticuloConExistencias; readonly sedeId: string }) {
  if (a.tipo === 'uniforme') {
    return (
      <span className="flex flex-wrap gap-1.5">
        {a.variantes.map((v) => {
          const s = v.sedes.find((x) => x.sedeId === sedeId);
          const hay = s?.disponible ?? 0n;
          return (
            <Chip key={v.id} tono={hay > 0n ? 'azul' : 'gris'} contorno>
              <span className={hay > 0n ? '' : 'line-through'}>
                {v.etiqueta} {cantidad(hay, 'unidad').replace(/ unidad(es)?$/, '')}
              </span>
            </Chip>
          );
        })}
      </span>
    );
  }
  const s = a.variantes[0]?.sedes.find((x) => x.sedeId === sedeId);
  if (!s) return null;
  const usable = s.disponible - s.vencido;
  return (
    <span className="grid">
      <span className="t-display text-3xl leading-none text-estructural">{cantidad(usable, a.unidad)}</span>
      <span className="text-sm text-tinta-suave">
        {a.tipo === 'utensilio' ? (s.prestado > 0n ? `Prestados: ${cantidad(s.prestado, a.unidad)}` : 'Nada prestado') : null}
        {a.tipo === 'insumo' && s.vencido > 0n ? `${cantidad(s.vencido, a.unidad)} vencidos aparte` : null}
        {a.tipo === 'insumo' && s.vencido === 0n && s.proximoVencimiento ? `Vence el ${formatearDiaCorto(s.proximoVencimiento)}` : null}
      </span>
    </span>
  );
}
