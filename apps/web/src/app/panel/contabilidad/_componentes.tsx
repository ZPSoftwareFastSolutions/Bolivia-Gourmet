/**
 * CAPA: Presentation / App — piezas de la sección Contabilidad del panel.
 *
 * Pestañas (Resumen del mes · Gastos · Compras · Inventario valorizado), el
 * mes elegido con «anterior / siguiente» y la sede (todas o una). Todo con
 * enlaces: la consulta (`?mes=2026-10&sede=…`) se conserva al cambiar.
 */

import Link from 'next/link';
import type { ContextoDePanel } from '@core/domain/identidad/contexto-de-panel';
import type { FechaISO, Id } from '@core/domain/shared/tipos-base';
import { cn } from '@/lib/cn';
import { RUTAS_CONTABILIDAD } from '@/lib/rutas';
import { Icono } from '@/presentation/icons/Icono';
import { Pestanas } from '@/presentation/panel/Piezas';

export type Parametros = Promise<Record<string, string | string[] | undefined>>;

export function parametro(valores: Record<string, string | string[] | undefined>, nombre: string): string {
  const v = valores[nombre];
  return (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `AAAA-MM` pedido si es válido y no futuro; si no, el mes de `hoy`. */
export function mesDeParametro(valor: string, hoy: FechaISO): string {
  const actual = hoy.slice(0, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) && valor <= actual ? valor : actual;
}

/** «octubre de 2026». */
export function nombreDelMes(mes: string): string {
  const [anio = '', numero = '1'] = mes.split('-');
  return `${MESES[Number(numero) - 1] ?? ''} de ${anio}`;
}

export function mesVecino(mes: string, paso: -1 | 1): string {
  const [anio = 2026, numero = 1] = mes.split('-').map(Number);
  const indice = anio * 12 + (numero - 1) + paso;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
}

/** La sede pedida si existe; vacío = todas. */
export function sedeDeParametro(ctx: ContextoDePanel, valor: string): Id | undefined {
  return ctx.sedes.find((s) => s.id === valor)?.id;
}

function consulta(base: string, valores: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(valores)) if (v) q.set(k, v);
  const texto = q.toString();
  return `${base}${texto ? `?${texto}` : ''}`;
}

/** Enlace a una página de contabilidad conservando el mes y la sede. */
export function enlaceContable(base: string, mes?: string, sede?: string, extra: Record<string, string> = {}): string {
  return consulta(base, { mes, sede, ...extra });
}

export function PestanasDeContabilidad({ activa, mes, sede }: { readonly activa: string; readonly mes?: string; readonly sede?: string }) {
  const href = (base: string) => enlaceContable(base, mes, sede);
  return (
    <Pestanas
      etiqueta="Secciones de la contabilidad"
      activa={href(activa)}
      pestanas={[
        { href: href(RUTAS_CONTABILIDAD.resumen), etiqueta: 'Resumen del mes', icono: 'libro' },
        { href: href(RUTAS_CONTABILIDAD.gastos), etiqueta: 'Gastos', icono: 'recibo' },
        { href: href(RUTAS_CONTABILIDAD.compras), etiqueta: 'Compras', icono: 'carrito' },
        { href: href(RUTAS_CONTABILIDAD.inventario), etiqueta: 'Inventario valorizado', icono: 'almacen' },
      ]}
    />
  );
}

/** Mes anterior · mes elegido · mes siguiente (no se pasa del mes actual). */
export function SelectorDeMes({ base, mes, sede, hoy }: { readonly base: string; readonly mes: string; readonly sede?: string; readonly hoy: FechaISO }) {
  const siguiente = mesVecino(mes, 1);
  const hay = siguiente <= hoy.slice(0, 7);
  return (
    <nav aria-label="Mes" className="flex flex-wrap items-center gap-2">
      <Link href={enlaceContable(base, mesVecino(mes, -1), sede)} className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-linea bg-tarjeta px-4 font-semibold text-estructural hover:border-estructural">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Anterior
      </Link>
      <span className="t-display px-2 text-2xl text-estructural capitalize" aria-current="date">
        {nombreDelMes(mes)}
      </span>
      {hay ? (
        <Link href={enlaceContable(base, siguiente, sede)} className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-linea bg-tarjeta px-4 font-semibold text-estructural hover:border-estructural">
          Siguiente
          <Icono nombre="flecha" tamano={16} />
        </Link>
      ) : null}
    </nav>
  );
}

/** Todas las sedes o una (chips). */
export function SelectorDeSedeContable({ ctx, base, mes, sede }: { readonly ctx: ContextoDePanel; readonly base: string; readonly mes?: string; readonly sede?: string }) {
  if (ctx.sedes.length < 2) return null;
  const opciones = [{ id: '', nombre: 'Todas las sedes' }, ...ctx.sedes];
  return (
    <nav aria-label="Sede" className="flex flex-wrap gap-2">
      {opciones.map((s) => {
        const actual = (sede ?? '') === s.id;
        return (
          <Link
            key={s.id || 'todas'}
            href={enlaceContable(base, mes, s.id || undefined)}
            aria-current={actual ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold',
              actual ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            <Icono nombre="pin" tamano={16} />
            {s.nombre}
          </Link>
        );
      })}
    </nav>
  );
}
