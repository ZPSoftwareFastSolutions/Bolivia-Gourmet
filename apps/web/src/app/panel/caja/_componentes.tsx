/**
 * CAPA: Presentation / App — piezas de la sección Caja del panel.
 *
 * Pestañas (Por cerrar · Lo que deben · Recibos · Arqueos), elección de sede
 * para quien opera en las dos (administración) y el icono de cada medio de
 * pago: el medio siempre va con icono Y palabra.
 */

import Link from 'next/link';
import { ETIQUETA_DE_MEDIO, type MedioDePago } from '@core/domain/caja/cobro';
import { sedeDeTrabajo, type ContextoDePanel, type SedeOperable } from '@core/domain/identidad/contexto-de-panel';
import { cn } from '@/lib/cn';
import { RUTAS_CAJA } from '@/lib/rutas';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';
import { Pestanas } from '@/presentation/panel/Piezas';

export type Parametros = Promise<Record<string, string | string[] | undefined>>;

export function parametro(valores: Record<string, string | string[] | undefined>, nombre: string): string {
  const v = valores[nombre];
  return (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();
}

export const ICONO_DE_MEDIO: Record<MedioDePago, NombreDeIcono> = { efectivo: 'billete', qr: 'qr', transferencia: 'intercambio' };

export function Medio({ medio }: { readonly medio: MedioDePago }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-tinta">
      <Icono nombre={ICONO_DE_MEDIO[medio]} tamano={16} className="text-estructural" />
      {ETIQUETA_DE_MEDIO[medio]}
    </span>
  );
}

/** La sede en la que se trabaja: la pedida si se puede operar en ella; si no, la propia. */
export function sedeDeCaja(ctx: ContextoDePanel, pedida: string): SedeOperable | null {
  return ctx.sedes.find((s) => s.id === pedida) ?? sedeDeTrabajo(ctx);
}

export function PestanasDeCaja({ activa, sede }: { readonly activa: string; readonly sede?: string }) {
  const q = sede ? `?sede=${sede}` : '';
  return (
    <Pestanas
      etiqueta="Secciones de la caja"
      activa={`${activa}${q}`}
      pestanas={[
        { href: `${RUTAS_CAJA.inicio}${q}`, etiqueta: 'Por cerrar', icono: 'monedas' },
        { href: `${RUTAS_CAJA.deben}${q}`, etiqueta: 'Lo que deben', icono: 'alerta' },
        { href: `${RUTAS_CAJA.recibos}${q}`, etiqueta: 'Recibos', icono: 'recibo' },
        { href: `${RUTAS_CAJA.arqueos}${q}`, etiqueta: 'Arqueos', icono: 'candado' },
      ]}
    />
  );
}

/** Chips de sede (solo si la persona opera en más de una). */
export function SelectorDeSede({ ctx, actual, base }: { readonly ctx: ContextoDePanel; readonly actual: string; readonly base: string }) {
  if (ctx.sedes.length < 2) return null;
  return (
    <nav aria-label="Sede" className="flex flex-wrap gap-2">
      {ctx.sedes.map((s) => (
        <Link
          key={s.id}
          href={`${base}?sede=${s.id}`}
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
