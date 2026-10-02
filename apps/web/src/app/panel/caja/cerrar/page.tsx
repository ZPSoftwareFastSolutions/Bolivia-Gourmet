/**
 * CAPA: Presentation / App — Cerrar caja (arqueo, especificación §6.14).
 *
 * «Empezaste con Bs 200 · Cobraste en efectivo Bs 1.300 · Salió en efectivo
 * Bs 150 → Debería haber Bs 1.350». Aparte, los QR y transferencias para
 * revisar en el banco. Luego: ¿cuánto contaste? y ¿cuánto dejas para el
 * cambio? Si no cuadra, se pide una explicación. Nunca bloquea un cobro: lo
 * que entre después va al arqueo siguiente.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import { cajaRepository } from '@infra/config/composition-root';
import { formatearFechaYHora } from '@/lib/fechas';
import { RUTAS_CAJA } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { CalculoDeArqueo } from '@/presentation/panel/Caja';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { cerrarCajaAccion } from '../actions';
import { Medio, parametro, sedeDeCaja, SelectorDeSede, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Cerrar caja' };

export default async function CerrarCaja({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CAJA.cerrar), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.cerrar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  if (!sede) {
    return (
      <Aviso tono="error" titulo="Tu cuenta aún no tiene sede">
        <p>Pide a administración que te la asigne.</p>
      </Aviso>
    );
  }
  const caja = await (await cajaRepository()).cajaPorCerrar(sede.id);

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={`${RUTAS_CAJA.inicio}${ctx.sedes.length > 1 ? `?sede=${sede.id}` : ''}`} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Caja
      </Link>
      <EncabezadoDePanel titulo="Cerrar" resaltado="caja" descripcion={`Sede ${sede.nombre}. Cuenta el dinero del cajón y escríbelo.`} />
      <SelectorDeSede ctx={ctx} actual={sede.id} base={RUTAS_CAJA.cerrar} />

      {!caja.exito ? (
        <Aviso tono="error" titulo="No pudimos calcular la caja">
          <p>{caja.error}</p>
        </Aviso>
      ) : caja.valor.registros === 0 ? (
        <EstadoVacio frase="Nada que contar" detalle="No hubo movimientos de dinero desde el último cierre." />
      ) : (
        <>
          <section aria-label="Resumen" className="grid gap-2 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 text-lg">
            {!caja.valor.primerArqueo ? <p>Empezaste con {formatearMontoExacto(caja.valor.saldoInicial)}</p> : null}
            <p>Cobraste en efectivo {formatearMontoExacto(caja.valor.entradasEfectivo)}</p>
            <p>Salió en efectivo {formatearMontoExacto(caja.valor.salidasEfectivo)}</p>
            {caja.valor.salidas.length > 0 ? (
              <ul className="ms-4 list-disc text-base text-tinta-suave">
                {caja.valor.salidas.map((s, i) => (
                  <li key={`${s.cuando}-${i}`}>
                    {s.clase === 'cobro_anulado' ? 'Cobro anulado' : 'Salida registrada'} por {s.quien} · {formatearFechaYHora(s.cuando)} · {formatearMontoExacto(s.monto)}
                  </li>
                ))}
              </ul>
            ) : null}
            {caja.valor.ultimoCierreEn ? <p className="text-base text-tinta-suave">Último cierre: {formatearFechaYHora(caja.valor.ultimoCierreEn)}</p> : null}
          </section>

          {caja.valor.digitales.length > 0 ? (
            <section aria-labelledby="banco" className="grid gap-2 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
              <h2 id="banco" className="font-bold text-estructural">
                QR y transferencias desde el último cierre: revísalos en la app del banco
              </h2>
              <ul className="grid gap-1">
                {caja.valor.digitales.map((d) => (
                  <li key={d.recibo} className="flex flex-wrap items-center gap-3">
                    <Medio medio={d.medio} />
                    <span className="font-semibold">{d.referencia}</span>
                    <span className="text-tinta-suave">{d.recibo}</span>
                    <span className="ms-auto font-bold">{formatearMontoExacto(d.monto)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <FormularioDelPanel accion={cerrarCajaAccion} className="rounded-[var(--t-radio-lg)] border-2 border-estructural/30 bg-tarjeta p-5 sm:p-6">
            <input type="hidden" name="clave" value={randomUUID()} />
            <input type="hidden" name="sede" value={sede.id} />
            <input type="hidden" name="primer" value={caja.valor.primerArqueo ? 'si' : 'no'} />
            <input type="hidden" name="esperado" value={caja.valor.esperado} />
            <CalculoDeArqueo esperado={caja.valor.esperado} pideSaldoInicial={caja.valor.primerArqueo} />
            <BotonGuardar icono="candado" enviando="Cerrando…" className="justify-self-start">
              Cerrar caja
            </BotonGuardar>
          </FormularioDelPanel>
        </>
      )}
    </div>
  );
}
