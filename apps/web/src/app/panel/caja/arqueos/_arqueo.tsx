/**
 * CAPA: Presentation / App — un arqueo en la lista (Caja · Arqueos).
 *
 * Vive aparte de la página para poder dibujarlo solo. Un arqueo con
 * diferencia queda «Por revisar» hasta que administración lo revisa y deja
 * una nota; la diferencia no cambia (ver la página).
 */

import { randomUUID } from 'node:crypto';
import type { Arqueo } from '@core/application/ports/caja.port';
import { describirDiferencia } from '@core/domain/caja/arqueo';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import { cn } from '@/lib/cn';
import { formatearFechaYHora } from '@/lib/fechas';
import { AreaDeTexto } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Desplegable } from '@/presentation/panel/Piezas';
import { revisarArqueoAccion } from '../actions';

export function ArqueoEnLista({
  arqueo: a,
  nuevo,
  puedeRevisar,
  sede,
}: {
  readonly arqueo: Arqueo;
  /** Recién cerrado: lo resalta la animación de la lista. */
  readonly nuevo: boolean;
  readonly puedeRevisar: boolean;
  /** Sede elegida en la lista, para volver a ella después de revisar. */
  readonly sede: string | undefined;
}) {
  return (
    <li
      data-nuevo={nuevo ? 'si' : undefined}
      className="grid gap-3 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <span>
        <span className="block font-bold text-estructural">
          Arqueo n.º {a.numero} · {a.sedeNombre}
        </span>
        <span className="text-sm text-tinta-suave">
          {formatearFechaYHora(a.cerradoEn)} · {a.cerradoPor}
        </span>
        <span className="mt-1 block text-sm text-tinta-suave">
          Debería haber {formatearMontoExacto(a.esperado)} · se contó {formatearMontoExacto(a.contado)} · se retiró {formatearMontoExacto(a.retiro)} · quedó{' '}
          {formatearMontoExacto(a.queda)}
        </span>
        {a.observacion ? <span className="mt-1 block text-sm">«{a.observacion}»</span> : null}
      </span>
      <span className={cn('t-display text-2xl', a.diferencia === 0 ? 'text-exito' : 'text-peligro')}>{describirDiferencia(a.diferencia)}</span>
      {a.diferencia === 0 ? null : a.revision ? (
        <p className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
          <Chip tono="verde" icono="check">
            Revisado
          </Chip>
          <span className="text-tinta-suave">
            {a.revision.por || 'Administración'}, {formatearFechaYHora(a.revision.en)}:
          </span>
          <span>«{a.revision.nota}»</span>
        </p>
      ) : (
        <div className="grid gap-2 sm:col-span-2">
          <span>
            <Chip tono="rojo" icono="alerta">
              Por revisar
            </Chip>
          </span>
          {puedeRevisar ? (
            <Desplegable titulo="Marcar como revisado" icono="check">
              <FormularioDelPanel accion={revisarArqueoAccion} etiqueta={`Revisar el arqueo n.º ${a.numero}`}>
                <input type="hidden" name="clave" value={randomUUID()} />
                <input type="hidden" name="cierre" value={a.id} />
                {sede ? <input type="hidden" name="sede" value={sede} /> : null}
                <p className="text-tinta-suave">
                  La diferencia no cambia: es dinero que faltó o sobró. Si un cobro o un gasto quedó mal, anúlalo primero (la anulación entra en el
                  próximo arqueo).
                </p>
                <AreaDeTexto id={`nota-${a.id}`} name="nota" etiqueta="¿Qué se encontró?" maxLength={300} />
                <BotonGuardar icono="check" enviando="Guardando…" className="justify-self-start">
                  Marcar revisado
                </BotonGuardar>
              </FormularioDelPanel>
            </Desplegable>
          ) : null}
        </div>
      )}
    </li>
  );
}
