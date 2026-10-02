/**
 * CAPA: Presentation / App — recibo interno (especificación §7.5 «Recibo»).
 *
 * Número, fecha y hora, sede, alumno (o cliente), conceptos y montos, total
 * en números y en letras, medio y número de operación, quién cobró y la
 * leyenda «Recibo interno: no es factura». Al imprimir, solo sale el recibo.
 * Recién cobrado muestra el sello «¡Cobrado!» y el saldo que queda.
 * Administración puede anularlo (queda registrado y el recibo dice ANULADO).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { montoEnLetras } from '@core/domain/caja/monto-en-letras';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Id } from '@core/domain/shared/tipos-base';
import { cajaRepository } from '@infra/config/composition-root';
import { INSTITUTO } from '@contenido/instituto';
import { formatearFechaYHora } from '@/lib/fechas';
import { RUTAS_CAJA, rutaDeAlumno, rutaDeRecibo } from '@/lib/rutas';
import { AreaDeTexto, Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonImprimir } from '@/presentation/panel/Caja';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Confirmacion, Desplegable } from '@/presentation/panel/Piezas';
import { Logos } from '@ui/Logos';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { anularCobroAccion } from '../../actions';
import { Medio, parametro, type Parametros } from '../../_componentes';

export const metadata: Metadata = { title: 'Recibo' };

export default async function ReciboPagina({ params, searchParams }: { readonly params: Promise<{ readonly id: string }>; readonly searchParams: Parametros }) {
  const [{ id }, valores] = await Promise.all([params, searchParams]);
  const lectura = await exigirPersonal(rutaDeRecibo(id));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.leer');

  const caja = await cajaRepository();
  const leido = await caja.recibo(id as Id);
  if (!leido.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el recibo">
        <p>{leido.error}</p>
      </Aviso>
    );
  }
  const r = leido.valor;
  if (!r) notFound();

  const nuevo = parametro(valores, 'nuevo') === '1';
  const cuenta = nuevo && r.alumno ? await caja.cuentaDeAlumno(r.alumno.id) : null;
  const saldo = cuenta && cuenta.exito && cuenta.valor ? cuenta.valor.totalPendiente : null;
  const quien = r.alumno ? r.alumno.nombre : (r.cliente ?? '');

  return (
    <div className="grid gap-6">
      <Link href={RUTAS_CAJA.inicio} className="panel-sin-imprimir enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Caja
      </Link>

      {nuevo && !r.anulacion ? (
        <div className="panel-sin-imprimir">
          <Confirmacion
            palabra="¡Cobrado!"
            titulo={`Recibo ${r.numero} · ${formatearMontoExacto(r.monto)}`}
            cerrarHref={rutaDeRecibo(r.id)}
            acciones={
              <>
                <BotonImprimir />
                <Link href={RUTAS_CAJA.cobrar} className="inline-flex min-h-12 items-center gap-2 rounded-md px-4 font-semibold text-estructural hover:bg-superficie-alterna">
                  <Icono nombre="monedas" tamano={18} />
                  Cobrar a otro alumno
                </Link>
              </>
            }
          >
            {saldo !== null ? <p>Saldo pendiente de {quien}: {formatearMontoExacto(saldo)}</p> : null}
          </Confirmacion>
        </div>
      ) : null}
      {parametro(valores, 'anulado') ? (
        <div className="panel-sin-imprimir">
          <Confirmacion palabra="Listo" titulo="El cobro quedó anulado" cerrarHref={rutaDeRecibo(r.id)} cambios={[{ etiqueta: 'Recibo', antes: 'Vigente', despues: 'Anulado' }]}>
            <p>Lo cobrado vuelve a quedar pendiente. Si fue en efectivo, sale de la caja en el próximo cierre.</p>
          </Confirmacion>
        </div>
      ) : null}

      {!nuevo ? (
        <div className="panel-sin-imprimir flex flex-wrap gap-2">
          <BotonImprimir />
        </div>
      ) : null}

      <article aria-label={`Recibo ${r.numero}`} className="relative mx-auto grid w-full max-w-2xl gap-5 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-6 sm:p-8">
        {r.anulacion ? (
          <p className="absolute top-6 right-6 rotate-6 rounded-md border-4 border-peligro px-3 py-1 text-2xl font-black tracking-widest text-peligro">ANULADO</p>
        ) : null}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-linea pb-4">
          <div>
            <Logos tamano="portal" />
            <p className="mt-2 text-sm text-tinta-suave">
              {INSTITUTO.nombreCorto} · Sede {r.sedeNombre}
            </p>
          </div>
          <div className="text-right">
            <p className="t-etiqueta">Recibo interno</p>
            <p className="t-display text-3xl text-estructural">{r.numero}</p>
            <p className="text-sm text-tinta-suave">{formatearFechaYHora(r.registradoEn)}</p>
          </div>
        </header>

        <p>
          <span className="t-etiqueta block">Recibimos de</span>
          <span className="text-lg font-bold text-tinta">{quien}</span>
          {r.alumno ? (
            <Link href={rutaDeAlumno(r.alumno.codigo)} className="panel-sin-imprimir enlace ms-2 text-sm">
              {r.alumno.codigo}
            </Link>
          ) : null}
          {r.alumno ? <span className="hidden text-sm print:inline"> · {r.alumno.codigo}</span> : null}
        </p>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-linea text-sm text-tinta-suave">
              <th scope="col" className="py-2 font-semibold">
                Concepto
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {r.lineas.map((l, i) => (
              <tr key={`${l.descripcion}-${i}`} className="border-b border-linea">
                <td className="py-2">{l.descripcion}</td>
                <td className="py-2 text-right font-semibold">{formatearMontoExacto(l.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="pt-3 text-lg">
                Total
              </th>
              <td className="pt-3 text-right text-2xl font-black text-estructural">{formatearMontoExacto(r.monto)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-sm text-tinta-suave">Son: {montoEnLetras(r.monto)}.</p>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="t-etiqueta">Medio</dt>
            <dd>
              <Medio medio={r.medio} />
            </dd>
          </div>
          {r.referencia ? (
            <div>
              <dt className="t-etiqueta">N.º de operación</dt>
              <dd className="font-semibold">{r.referencia}</dd>
            </div>
          ) : null}
          <div>
            <dt className="t-etiqueta">Cobró</dt>
            <dd className="font-semibold">{r.cobradoPor}</dd>
          </div>
          {r.nota ? (
            <div>
              <dt className="t-etiqueta">Nota</dt>
              <dd>{r.nota}</dd>
            </div>
          ) : null}
        </dl>
        {r.anulacion ? (
          <p className="rounded-md bg-peligro/8 p-3 text-sm text-tinta">
            Anulado el {r.anulacion.el.split('-').reverse().join('/')} por {r.anulacion.por}: {r.anulacion.motivo}
          </p>
        ) : null}
        <footer className="border-t-2 border-linea pt-3 text-center text-sm text-tinta-suave">Recibo interno: no es factura.</footer>
      </article>

      {tienePermiso(ctx, 'caja.anular') && !r.anulacion ? (
        <div className="panel-sin-imprimir mx-auto w-full max-w-2xl">
          <Desplegable titulo="Anular este cobro" icono="papelera" peligro>
            <FormularioDelPanel accion={anularCobroAccion} etiqueta="Anular cobro">
              <input type="hidden" name="clave" value={randomUUID()} />
              <input type="hidden" name="id" value={r.id} />
              <p className="text-tinta-suave">
                El recibo no se borra: queda marcado como ANULADO. Lo cobrado vuelve a quedar pendiente y, si fue en efectivo, sale de la caja en el próximo cierre.
              </p>
              <AreaDeTexto id="motivo" etiqueta="¿Por qué se anula?" maxLength={300} />
              <BotonGuardar variante="peligro" icono="papelera" enviando="Anulando…" className="justify-self-start">
                Sí, anular el cobro
              </BotonGuardar>
            </FormularioDelPanel>
          </Desplegable>
        </div>
      ) : null}
    </div>
  );
}
