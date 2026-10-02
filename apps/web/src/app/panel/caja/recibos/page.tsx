/**
 * CAPA: Presentation / App — Caja · Recibos (los últimos 100 de la sede).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import { cajaRepository } from '@infra/config/composition-root';
import { formatearFechaYHora } from '@/lib/fechas';
import { RUTAS_CAJA, rutaDeRecibo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { Medio, parametro, PestanasDeCaja, sedeDeCaja, SelectorDeSede, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Recibos' };

export default async function Recibos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CAJA.recibos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.leer');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const q = ctx.sedes.length > 1 && sede ? sede.id : undefined;
  const lista = await (await cajaRepository()).recibos(sede?.id);

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Recibos" descripcion={sede ? `Sede ${sede.nombre}` : undefined} />
      <PestanasDeCaja activa={RUTAS_CAJA.recibos} sede={q} />
      <SelectorDeSede ctx={ctx} actual={sede?.id ?? ''} base={RUTAS_CAJA.recibos} />
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los recibos">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio frase="Sin recibos todavía" detalle="Cada cobro genera su recibo con número correlativo." />
      ) : (
        <ul className="grid gap-2">
          {lista.valor.map((r) => (
            <li key={r.id}>
              <Link href={rutaDeRecibo(r.id)} className="flex flex-wrap items-center gap-3 rounded-md border border-linea bg-tarjeta p-3 hover:border-estructural">
                <Icono nombre="recibo" tamano={22} className="text-estructural" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-estructural">{r.numero}</span>
                  <span className="text-sm text-tinta-suave">
                    {formatearFechaYHora(r.registradoEn)} · {r.quien}
                  </span>
                </span>
                <Medio medio={r.medio} />
                <span className={r.anulado ? 'font-bold text-tinta-suave line-through' : 'font-bold text-estructural'}>{formatearMontoExacto(r.monto)}</span>
                {r.anulado ? <Chip tono="rojo">Anulado</Chip> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
