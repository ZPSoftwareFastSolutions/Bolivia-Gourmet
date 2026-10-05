/**
 * CAPA: Presentation / App — una fila de «¿Qué se usó?» (Usar en clase).
 *
 * Vive aparte de la página para poder dibujarla sola: una página de Next solo
 * exporta la página y sus metadatos.
 */

import type { ArticuloConExistencias } from '@core/application/ports/inventario.port';
import { cn } from '@/lib/cn';
import { formatearDiaCorto } from '@/lib/fechas';
import { CLASE_DE_CAMPO } from '@/presentation/formularios/Campos';
import { admiteFraccion, cantidad, InsigniaDeArticulo } from '../_componentes';

export function FilaDeUso({ articulo: a, sedeId, destacado }: { readonly articulo: ArticuloConExistencias; readonly sedeId: string; readonly destacado: boolean }) {
  const v = a.variantes[0];
  const s = v?.sedes.find((x) => x.sedeId === sedeId);
  if (!v || !s) return null;
  const usable = s.disponible - s.vencido;
  const id = `cantidad-${v.id}`;
  const agotado = usable <= 0n;
  return (
    <li className={cn('grid gap-3 rounded-md border-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', destacado ? 'border-accion-fuerte bg-accion/10' : 'border-linea', agotado && 'opacity-70')}>
      <input type="hidden" name={`nombre-${v.id}`} value={a.nombre} />
      <span className="flex min-w-0 items-center gap-3">
        <InsigniaDeArticulo icono={a.icono} />
        <span className="min-w-0">
          <label htmlFor={id} className="block font-semibold text-tinta">
            {a.nombre}
          </label>
          <span className="text-sm text-tinta-suave">
            {agotado ? 'Agotado' : `Hay ${cantidad(usable, a.unidad)}`}
            {s.vencido > 0n ? ` · ${cantidad(s.vencido, a.unidad)} vencidos no se usan` : ''}
            {!agotado && s.proximoVencimiento ? ` · lo próximo vence el ${formatearDiaCorto(s.proximoVencimiento)}` : ''}
          </span>
        </span>
      </span>
      {/* La unidad toma el ancho que necesita («unidades», «paquetes» no caben en 4rem con Montserrat) y el campo se ajusta al resto. */}
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 sm:w-28 sm:flex-none">
          <input
            id={id}
            name={id}
            inputMode={admiteFraccion(a) ? 'decimal' : 'numeric'}
            autoComplete="off"
            disabled={agotado}
            placeholder="0"
            className={cn(CLASE_DE_CAMPO, 'text-right')}
            aria-describedby={undefined}
          />
        </span>
        <span className="shrink-0 whitespace-nowrap text-sm text-tinta-suave">{cantidad(2000n, a.unidad).replace(/^2 /, '')}</span>
      </span>
    </li>
  );
}
