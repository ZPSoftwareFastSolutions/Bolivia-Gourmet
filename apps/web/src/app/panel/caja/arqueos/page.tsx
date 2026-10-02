/**
 * CAPA: Presentation / App — Caja · Arqueos.
 *
 * Cada cierre: cuándo, quién, debería haber, se contó, la diferencia (en
 * palabras: «¡La caja cuadra!», «Faltan Bs 5,00») y cuánto quedó. Recién
 * cerrado, el sello confirma el resultado.
 */

import type { Metadata } from 'next';
import { describirDiferencia } from '@core/domain/caja/arqueo';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { cajaRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearFechaYHora } from '@/lib/fechas';
import { RUTAS_CAJA } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Confirmacion, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, PestanasDeCaja, sedeDeCaja, SelectorDeSede, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Arqueos' };

export default async function Arqueos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CAJA.arqueos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.leer');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const q = ctx.sedes.length > 1 && sede ? sede.id : undefined;
  const lista = await (await cajaRepository()).arqueos(sede?.id);
  const cerrado = parametro(valores, 'cerrado');
  const diferencia = Number.parseInt(parametro(valores, 'diferencia'), 10);

  return (
    <div className="grid gap-6">
      {cerrado ? (
        <Confirmacion
          palabra={diferencia === 0 ? '¡Cuadra!' : 'Caja cerrada'}
          titulo={`Arqueo n.º ${cerrado}: ${describirDiferencia((Number.isFinite(diferencia) ? diferencia : 0) as Centavos)}`}
          cerrarHref={`${RUTAS_CAJA.arqueos}${q ? `?sede=${q}` : ''}`}
        >
          <p>Lo que se cobre desde ahora entra en el próximo cierre.</p>
        </Confirmacion>
      ) : null}
      <EncabezadoDePanel titulo="Arqueos" descripcion={sede ? `Sede ${sede.nombre}` : undefined} />
      <PestanasDeCaja activa={RUTAS_CAJA.arqueos} sede={q} />
      <SelectorDeSede ctx={ctx} actual={sede?.id ?? ''} base={RUTAS_CAJA.arqueos} />
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los arqueos">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio frase="Aún sin cierres" detalle="Al final del turno, cierra la caja: cuenta el dinero y escríbelo." />
      ) : (
        <ul className="grid gap-3">
          {lista.valor.map((a) => (
            <li
              key={a.id}
              data-nuevo={String(a.numero) === cerrado ? 'si' : undefined}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
