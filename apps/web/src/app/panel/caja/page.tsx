/**
 * CAPA: Presentation / App — Caja · Por cerrar (especificación §7.5).
 *
 * Tarjetas: debería haber en el cajón (grande), efectivo que entró y salió,
 * QR y transferencias para cotejar con el banco, y el último cierre. Debajo,
 * los últimos recibos. Acciones: «Cobrar» (principal) y «Cerrar caja».
 * La cuenta es la misma que hará el cierre (`caja_por_cerrar`).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import { cajaRepository } from '@infra/config/composition-root';
import { formatearFechaYHora } from '@/lib/fechas';
import { RUTAS_CAJA, RUTAS_PANEL, rutaDeRecibo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, EncabezadoDePanel, EstadoVacio, Indicador } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../_sesion';
import { Medio, parametro, PestanasDeCaja, sedeDeCaja, SelectorDeSede, type Parametros } from './_componentes';

export const metadata: Metadata = { title: 'Caja' };

export default async function Caja({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_PANEL.caja), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.leer');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const q = ctx.sedes.length > 1 && sede ? sede.id : undefined;

  const repo = await cajaRepository();
  const [porCerrar, recibos] = await Promise.all([
    sede && tienePermiso(ctx, 'caja.cerrar') ? repo.cajaPorCerrar(sede.id) : Promise.resolve(null),
    repo.recibos(sede?.id),
  ]);

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Caja"
        descripcion={sede ? `Sede ${sede.nombre}` : undefined}
        acciones={
          <>
            {tienePermiso(ctx, 'caja.cobrar') ? (
              <Link href={`${RUTAS_CAJA.cobrar}${q ? `?sede=${q}` : ''}`} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion hover:bg-accion-fuerte">
                <Icono nombre="monedas" tamano={20} />
                Cobrar
              </Link>
            ) : null}
            {tienePermiso(ctx, 'caja.cerrar') ? (
              <Link href={`${RUTAS_CAJA.cerrar}${q ? `?sede=${q}` : ''}`} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-estructural px-5 font-bold text-sobre-estructural hover:bg-estructural-profundo">
                <Icono nombre="candado" tamano={20} />
                Cerrar caja
              </Link>
            ) : null}
          </>
        }
      />
      <PestanasDeCaja activa={RUTAS_CAJA.inicio} sede={q} />
      <SelectorDeSede ctx={ctx} actual={sede?.id ?? ''} base={RUTAS_CAJA.inicio} />

      {porCerrar && !porCerrar.exito ? (
        <Aviso tono="error" titulo="No pudimos calcular la caja">
          <p>{porCerrar.error}</p>
        </Aviso>
      ) : null}
      {porCerrar && porCerrar.exito ? (
        <section aria-label="Lo que hay por arquear" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador
            icono="billete"
            etiqueta="Debería haber en el cajón"
            cifra={formatearMontoExacto(porCerrar.valor.esperado)}
            detalle={
              porCerrar.valor.primerArqueo
                ? 'Primer cierre: sumarás el cambio con que empezó.'
                : `Empezó con ${formatearMontoExacto(porCerrar.valor.saldoInicial)}`
            }
            accion={tienePermiso(ctx, 'caja.cerrar') ? { href: `${RUTAS_CAJA.cerrar}${q ? `?sede=${q}` : ''}`, texto: 'Cerrar caja' } : undefined}
          />
          <Indicador
            icono="monedas"
            etiqueta="Efectivo desde el último cierre"
            cifra={formatearMontoExacto(porCerrar.valor.entradasEfectivo)}
            detalle={porCerrar.valor.salidasEfectivo > 0 ? `Salió ${formatearMontoExacto(porCerrar.valor.salidasEfectivo)}` : 'No salió efectivo'}
          />
          <Indicador
            icono="qr"
            etiqueta="QR por revisar en el banco"
            cifra={formatearMontoExacto(porCerrar.valor.cobrosQr)}
            detalle={porCerrar.valor.cobrosTransferencia > 0 ? `Transferencias: ${formatearMontoExacto(porCerrar.valor.cobrosTransferencia)}` : undefined}
          />
          <Indicador
            icono="reloj"
            etiqueta="Último cierre"
            cifra={porCerrar.valor.ultimoCierreEn ? formatearFechaYHora(porCerrar.valor.ultimoCierreEn).split(',')[0] ?? '—' : '—'}
            detalle={porCerrar.valor.ultimoCierreEn ? formatearFechaYHora(porCerrar.valor.ultimoCierreEn) : 'Aún no se cerró esta caja.'}
            accion={{ href: `${RUTAS_CAJA.arqueos}${q ? `?sede=${q}` : ''}`, texto: 'Ver arqueos' }}
          />
        </section>
      ) : null}

      <section aria-labelledby="ultimos" className="grid gap-3">
        <h2 id="ultimos" className="t-display text-3xl text-estructural">
          Últimos recibos
        </h2>
        {!recibos.exito ? (
          <Aviso tono="error" titulo="No pudimos cargar los recibos">
            <p>{recibos.error}</p>
          </Aviso>
        ) : recibos.valor.length === 0 ? (
          <EstadoVacio frase="¡A cobrar se ha dicho!" detalle="Cuando cobres, el recibo aparecerá aquí." />
        ) : (
          <ul className="grid gap-2">
            {recibos.valor.slice(0, 15).map((r) => (
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
      </section>
    </div>
  );
}
