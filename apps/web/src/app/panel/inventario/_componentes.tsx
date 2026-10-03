/**
 * CAPA: Presentation / App — piezas de la sección Inventario del panel.
 *
 * Pestañas por tipo (Insumos · Uniformes · Utensilios · Otros · Historial),
 * chips de estado (Agotado · Bajo · Bien: color con icono y palabra), la fila
 * del kárdex contada en frases y la confirmación de una operación, que se
 * arma con el propio libro: «Harina: 25 kg → 20 kg».
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ContextoDePanel } from '@core/domain/identidad/contexto-de-panel';
import type { ArticuloConExistencias, EstadoDeExistencia, InventarioPort, MovimientoEnKardex } from '@core/application/ports/inventario.port';
import { COMPORTAMIENTO_POR_TIPO, ETIQUETA_DE_VARIANTE_UNICA, type TipoDeArticulo } from '@core/domain/inventario/articulo';
import { ETIQUETA_DE_DESTINO, ETIQUETA_DE_MOTIVO_DE_BAJA, ETIQUETA_DE_MOVIMIENTO, type DestinoDeUso, type TipoDeMovimiento } from '@core/domain/inventario/movimiento';
import { formatearCantidad, type Unidad } from '@core/domain/shared/cantidad';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos, Id } from '@core/domain/shared/tipos-base';
import { cn } from '@/lib/cn';
import { formatearFechaYHora } from '@/lib/fechas';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';
import { Chip, Confirmacion, Pestanas } from '@/presentation/panel/Piezas';

export const TIPOS_EN_ORDEN: readonly TipoDeArticulo[] = ['insumo', 'uniforme', 'utensilio', 'otro'];

export const PLURAL_DE_TIPO: Record<TipoDeArticulo, string> = {
  insumo: 'Insumos',
  uniforme: 'Uniformes',
  utensilio: 'Utensilios',
  otro: 'Otros',
};

export const ICONO_DE_TIPO: Record<TipoDeArticulo, NombreDeIcono> = {
  insumo: 'trigo',
  uniforme: 'chaqueta',
  utensilio: 'cubiertos',
  otro: 'paquete',
};

export function tipoDeParametro(valor: string): TipoDeArticulo {
  return (TIPOS_EN_ORDEN as readonly string[]).includes(valor) ? (valor as TipoDeArticulo) : 'insumo';
}

export function PestanasDeInventario({ activa }: { readonly activa: TipoDeArticulo | 'historial' | 'prestamos' }) {
  const href = (t: TipoDeArticulo) => `${RUTAS_INVENTARIO.inicio}?tipo=${t}`;
  return (
    <Pestanas
      etiqueta="Secciones del inventario"
      activa={activa === 'historial' ? RUTAS_INVENTARIO.historial : activa === 'prestamos' ? RUTAS_INVENTARIO.prestamos : href(activa)}
      pestanas={[
        ...TIPOS_EN_ORDEN.map((t) => ({ href: href(t), etiqueta: PLURAL_DE_TIPO[t], icono: ICONO_DE_TIPO[t] })),
        { href: RUTAS_INVENTARIO.historial, etiqueta: 'Historial', icono: 'libro' as const },
      ]}
    />
  );
}

/** Insignia redonda con el icono del artículo. */
export function InsigniaDeArticulo({ icono, tamano = 'md' }: { readonly icono: NombreDeIcono; readonly tamano?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid flex-none place-items-center rounded-full bg-superficie-alterna text-estructural ring-2 ring-linea', tamano === 'lg' ? 'size-16' : 'size-11')}
    >
      <Icono nombre={icono} tamano={tamano === 'lg' ? 30 : 22} />
    </span>
  );
}

const CHIP_DE_ESTADO: Record<EstadoDeExistencia, { tono: 'rojo' | 'amarillo' | 'verde'; icono: NombreDeIcono; texto: string }> = {
  agotado: { tono: 'rojo', icono: 'alerta', texto: 'Agotado' },
  bajo: { tono: 'amarillo', icono: 'alerta', texto: 'Bajo' },
  bien: { tono: 'verde', icono: 'check', texto: 'Bien' },
};

export function ChipDeEstado({ estado }: { readonly estado: EstadoDeExistencia }) {
  const c = CHIP_DE_ESTADO[estado];
  return (
    <Chip tono={c.tono} icono={c.icono}>
      {c.texto}
    </Chip>
  );
}

/** «Juego de uniforme · M» o solo el nombre si la variante es la única. */
export function nombreConVariante(nombre: string, etiqueta: string): string {
  return etiqueta && etiqueta !== ETIQUETA_DE_VARIANTE_UNICA ? `${nombre} · ${etiqueta}` : nombre;
}

/** El peor estado de un artículo en una sede (para la lista). */
export function estadoEnSede(articulo: ArticuloConExistencias, sedeId: Id): EstadoDeExistencia {
  const estados = articulo.variantes.flatMap((v) => v.sedes.filter((s) => s.sedeId === sedeId).map((s) => s.estado));
  if (estados.length === 0) return 'agotado';
  if (articulo.tipo === 'uniforme') return estados.every((e) => e === 'agotado') ? 'agotado' : estados.some((e) => e !== 'bien') ? 'bajo' : 'bien';
  return estados.includes('agotado') ? 'agotado' : estados.includes('bajo') ? 'bajo' : 'bien';
}

export function admiteFraccion(articulo: Pick<ArticuloConExistencias, 'tipo' | 'unidad'>): boolean {
  return COMPORTAMIENTO_POR_TIPO[articulo.tipo].admiteFraccion && ['kg', 'g', 'l', 'ml'].includes(articulo.unidad);
}

/** Cantidad para un campo de formulario: «1250,5» (sin punto de miles; la lee `parsearCantidad`). */
export function cantidadParaCampo(valor: bigint): string {
  return formatearCantidad(valor).replace(/\./g, '');
}

/** Formato corto de cantidad: «9,5 kg». */
export function cantidad(valor: bigint, unidad: Unidad): string {
  return formatearCantidad(valor, unidad);
}

// ---------------------------------------------------------------- kárdex

export const ICONO_DE_MOVIMIENTO: Record<TipoDeMovimiento, NombreDeIcono> = {
  saldo_inicial: 'almacen',
  compra: 'carrito',
  consumo: 'bol',
  entrega: 'chaqueta',
  devolucion_entrega: 'renovar',
  prestamo: 'cubiertos',
  devolucion_prestamo: 'renovar',
  baja: 'papelera',
  ajuste_faltante: 'alerta',
  ajuste_sobrante: 'mas',
  anulacion: 'cerrar',
};

const FRASE_DE_DESTINO: Record<DestinoDeUso, string> = {
  clase: 'Usado en clase',
  practica: 'Usado en una práctica',
  evento: 'Usado en un evento',
  degustacion: 'Usado en una degustación',
  uso_interno: 'Uso interno',
  otro: `Usado · ${ETIQUETA_DE_DESTINO.otro.toLowerCase()}`,
};

/** Qué pasó, en una frase: «Usado en Cocina · Sábados · oct 2026 · La Paz». */
export function quePaso(m: MovimientoEnKardex): string {
  if (m.tipo === 'consumo') {
    if (m.grupoNombre) return `Usado en ${m.grupoNombre}`;
    return m.destino ? FRASE_DE_DESTINO[m.destino] : 'Usado en clase';
  }
  if (m.tipo === 'baja') return `Baja · ${m.motivoBaja ? ETIQUETA_DE_MOTIVO_DE_BAJA[m.motivoBaja] : 'sin motivo'}`;
  return ETIQUETA_DE_MOVIMIENTO[m.tipo];
}

/** El documento que se anula desde esta fila, si se puede. */
export function anulacionDe(m: MovimientoEnKardex): string | null {
  if (m.anulado || m.tipo === 'anulacion') return null;
  if (m.tipo === 'consumo') return `${RUTAS_INVENTARIO.anular}?tipo=uso&id=${m.operacionId}`;
  if (m.tipo === 'compra' && m.compraId) return `${RUTAS_INVENTARIO.anular}?tipo=compra&id=${m.compraId}`;
  if (m.tipo === 'baja' && !m.prestamoId) return `${RUTAS_INVENTARIO.anular}?tipo=baja&id=${m.id}`;
  if (m.tipo === 'saldo_inicial') return `${RUTAS_INVENTARIO.anular}?tipo=saldo_inicial&id=${m.id}`;
  return null;
}

export function FilaDeKardex({ m, conArticulo, puedeAnular }: { readonly m: MovimientoEnKardex; readonly conArticulo: boolean; readonly puedeAnular: boolean }) {
  const anular = puedeAnular ? anulacionDe(m) : null;
  const queda = m.prestadoResultante > 0n ? `${cantidad(m.disponibleResultante, m.unidad)} · prestados ${cantidad(m.prestadoResultante, m.unidad)}` : cantidad(m.disponibleResultante, m.unidad);
  return (
    <li className={cn('grid gap-2 rounded-md border border-linea bg-tarjeta p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center', m.anulado && 'opacity-70')}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-grid size-10 place-items-center rounded-full',
          m.entra > 0n ? 'bg-exito/12 text-exito' : m.sale > 0n ? 'bg-superficie-alterna text-estructural' : 'bg-superficie-alterna text-tinta-suave',
        )}
      >
        <Icono nombre={ICONO_DE_MOVIMIENTO[m.tipo]} tamano={20} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-tinta">
          {conArticulo ? <span className="text-estructural">{nombreConVariante(m.articuloNombre, m.etiqueta)}: </span> : null}
          {quePaso(m)}
          {m.anulado ? (
            <>
              {' '}
              <Chip tono="rojo">Anulado</Chip>
            </>
          ) : null}
        </span>
        <span className="block text-sm text-tinta-suave">
          {formatearFechaYHora(m.registradoEn)} · {m.sedeNombre}
          {m.quien ? ` · ${m.quien}` : ''}
          {m.detalle ? ` · «${m.detalle}»` : ''}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:justify-end">
        {m.entra > 0n ? <span className="font-bold text-exito">+{cantidad(m.entra, m.unidad)}</span> : null}
        {m.sale > 0n ? <span className="font-bold text-tinta">−{cantidad(m.sale, m.unidad)}</span> : null}
        <span className="text-tinta-suave">Queda {queda}</span>
        {m.deltaValor !== null && m.deltaValor !== 0 ? (
          <span className="text-tinta-suave">{m.deltaValor > 0 ? '+' : '−'}{formatearMontoExacto(Math.abs(m.deltaValor) as Centavos)}</span>
        ) : null}
        {anular ? (
          <Link href={anular} className="enlace inline-flex min-h-11 items-center gap-1 font-semibold">
            Anular
          </Link>
        ) : null}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------- confirmación

/**
 * Confirmación de una operación recién guardada, leída del libro con la clave
 * del formulario (= la operación): cada línea con su saldo «antes → ahora».
 */
export async function ConfirmacionDeOperacion({
  repo,
  operacionId,
  palabra,
  titulo,
  conValor,
  etiquetaDeValor,
  acciones,
  cerrarHref,
  children,
}: {
  readonly repo: InventarioPort;
  readonly operacionId: string;
  readonly palabra: string;
  readonly titulo: string;
  readonly conValor: boolean;
  readonly etiquetaDeValor?: string;
  readonly acciones?: ReactNode;
  readonly cerrarHref: string;
  readonly children?: ReactNode;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(operacionId)) return null;
  const r = await repo.kardex({ operacionId: operacionId as Id, conValor, limite: 60 });
  if (!r.exito || r.valor.length === 0) return null;
  const lineas = [...r.valor].sort((a, b) => a.numero - b.numero);
  const valor = lineas.reduce((t, m) => t + Math.abs(m.deltaValor ?? 0), 0);
  return (
    <Confirmacion
      palabra={palabra}
      titulo={titulo}
      cerrarHref={cerrarHref}
      acciones={acciones}
      cambios={lineas.map((m) => ({
        etiqueta: `${nombreConVariante(m.articuloNombre, m.etiqueta)}${lineas.some((x) => x.sedeId !== m.sedeId) ? ` (${m.sedeNombre})` : ''}`,
        antes: cantidad((m.disponibleResultante - m.deltaDisponible) as bigint, m.unidad),
        despues: cantidad(m.disponibleResultante, m.unidad),
      }))}
    >
      {children}
      {conValor && etiquetaDeValor && valor > 0 ? (
        <p>
          {etiquetaDeValor}: <strong className="text-estructural">{formatearMontoExacto(valor as Centavos)}</strong>
        </p>
      ) : null}
    </Confirmacion>
  );
}

/** Botón-enlace de acción principal (amarillo) o secundaria (azul). */
export function EnlaceDeAccion({ href, icono, children, variante = 'primario' }: { readonly href: string; readonly icono: NombreDeIcono; readonly children: ReactNode; readonly variante?: 'primario' | 'secundario' | 'suave' }) {
  const estilo = {
    primario: 'bg-accion text-sobre-accion hover:bg-accion-fuerte',
    secundario: 'bg-estructural text-sobre-estructural hover:bg-estructural-profundo',
    suave: 'border-2 border-linea bg-tarjeta text-estructural hover:border-estructural',
  }[variante];
  return (
    <Link href={href} className={cn('inline-flex min-h-12 items-center gap-2 rounded-md px-5 font-bold', estilo)}>
      <Icono nombre={icono} tamano={20} />
      {children}
    </Link>
  );
}

/** Chips de sede (solo si la persona opera en más de una), conservando la consulta. */
export function ElegirSede({ ctx, actual, base, consulta = '' }: { readonly ctx: ContextoDePanel; readonly actual: string; readonly base: string; readonly consulta?: string }) {
  if (ctx.sedes.length < 2) return null;
  return (
    <nav aria-label="Sede" className="flex flex-wrap gap-2">
      {ctx.sedes.map((s) => (
        <Link
          key={s.id}
          href={`${base}?${consulta}${consulta ? '&' : ''}sede=${s.id}`}
          aria-current={actual === s.id ? 'true' : undefined}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold',
            actual === s.id ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
          )}
        >
          <Icono nombre="pin" tamano={16} />
          {s.nombre}
        </Link>
      ))}
    </nav>
  );
}
