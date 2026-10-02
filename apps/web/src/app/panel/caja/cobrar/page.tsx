/**
 * CAPA: Presentation / App — Cobrar (especificación §6.12).
 *
 * 1. ¿A quién? Buscar al alumno o elegirlo de «lo que deben».
 * 2. Sus cuotas y cargos pendientes, del más antiguo al más nuevo, todos
 *    marcados; el total se calcula solo. Para cobrar una parte, se cambia el
 *    monto del cargo.
 * 3. ¿Cómo pagó? Efectivo · QR · Transferencia (número de operación en los
 *    dos últimos). «Cobrar Bs …» → recibo con «¡Cobrado!».
 *
 * «Otro cobro» registra una venta directa (a un alumno o a alguien de fuera).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { ETIQUETA_DE_MEDIO, MEDIOS_DE_PAGO } from '@core/domain/caja/cobro';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import { alumnosRepository, cajaRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_CAJA, rutaDeAlumno } from '@/lib/rutas';
import { AreaDeTexto, Aviso, CampoDeTexto, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonCobrar, CargosACobrar, ProveedorDeTotal } from '@/presentation/panel/Caja';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { cobrarAccion } from '../actions';
import { parametro, sedeDeCaja, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Cobrar' };

const DETALLE_DE_MEDIO = {
  efectivo: 'Entra al cajón de hoy.',
  qr: 'Revisa en la app del banco que llegó y anota el número de operación.',
  transferencia: 'Anota el número de operación del comprobante.',
} as const;

function CamposDeMedio() {
  return (
    <>
      <GrupoDeOpciones
        nombre="medio"
        leyenda="¿Cómo pagó?"
        columnas={3}
        valor="efectivo"
        opciones={MEDIOS_DE_PAGO.map((m) => ({ valor: m, etiqueta: ETIQUETA_DE_MEDIO[m], detalle: DETALLE_DE_MEDIO[m] }))}
      />
      <CampoDeTexto
        id="referencia"
        etiqueta="Número de operación"
        opcional
        maxLength={60}
        autoComplete="off"
        ayuda="Solo en QR y transferencia: el número que aparece en el comprobante."
      />
      <AreaDeTexto id="nota" etiqueta="Nota" opcional maxLength={300} />
    </>
  );
}

export default async function Cobrar({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CAJA.cobrar), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.cobrar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const codigo = parametro(valores, 'alumno');
  const venta = parametro(valores, 'modo') === 'venta';
  const q = parametro(valores, 'q');
  const caja = await cajaRepository();
  const alumnos = await alumnosRepository();
  const conSede = (extra: Record<string, string>) => {
    const p = new URLSearchParams(extra);
    if (ctx.sedes.length > 1 && sede) p.set('sede', sede.id);
    return `${RUTAS_CAJA.cobrar}?${p.toString()}`;
  };

  if (!sede) {
    return (
      <Aviso tono="error" titulo="Tu cuenta aún no tiene sede">
        <p>Pide a administración que te la asigne para poder cobrar.</p>
      </Aviso>
    );
  }

  // ------------------------------------------------------------ alumno elegido
  const ficha = codigo ? await alumnos.fichaDeAlumno(codigo) : null;
  const alumno = ficha && ficha.exito ? ficha.valor : null;
  const cuenta = alumno ? await caja.cuentaDeAlumno(alumno.id) : null;

  // ------------------------------------------------------------ venta directa
  if (venta) {
    const conceptos = await caja.conceptos('ingreso');
    const opciones = conceptos.exito ? conceptos.valor.filter((k) => k.codigo !== 'colegiatura-carrera' && k.codigo !== 'curso-capacitacion') : [];
    return (
      <div className="grid max-w-3xl gap-6">
        <Link href={conSede({})} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
          <Icono nombre="flechaIzquierda" tamano={16} />
          Cobrar
        </Link>
        <EncabezadoDePanel titulo="Otro" resaltado="cobro" descripcion={alumno ? `${alumno.nombres} ${alumno.apellidos} · ${alumno.codigo}` : 'Venta a alguien de fuera o sin cuota previa.'} />
        <FormularioDelPanel accion={cobrarAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />
          <input type="hidden" name="modo" value="venta" />
          {alumno ? <input type="hidden" name="alumno" value={alumno.id} /> : null}
          <GrupoDeOpciones nombre="concepto" leyenda="¿Qué se cobra?" valor={opciones[0]?.codigo} opciones={opciones.map((k) => ({ valor: k.codigo, etiqueta: k.nombre }))} />
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoDeTexto id="descripcion" etiqueta="Detalle" maxLength={200} ayuda="Por ejemplo: «Recetario de cocina»." />
            <CampoDeTexto id="montoVenta" etiqueta="Monto (Bs)" inputMode="decimal" maxLength={14} />
            {!alumno ? <CampoDeTexto id="cliente" etiqueta="Nombre de quien paga" maxLength={120} /> : null}
          </div>
          <CamposDeMedio />
          <BotonGuardar icono="monedas" enviando="Cobrando…" className="justify-self-start">
            Cobrar
          </BotonGuardar>
        </FormularioDelPanel>
      </div>
    );
  }

  // ------------------------------------------------------------ cuenta del alumno
  if (alumno && cuenta) {
    const pendientes = cuenta.exito && cuenta.valor ? cuenta.valor.cargos.filter((c) => c.pendiente > 0) : [];
    return (
      <div className="grid max-w-3xl gap-6">
        <Link href={conSede({})} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
          <Icono nombre="flechaIzquierda" tamano={16} />
          Buscar a otro alumno
        </Link>
        <header className="flex flex-wrap items-center gap-4">
          <Iniciales nombres={alumno.nombres} apellidos={alumno.apellidos} tamano="lg" />
          <div className="min-w-0 flex-1">
            <EncabezadoDePanel gancho="Cobrar a" titulo={`${alumno.nombres} ${alumno.apellidos}`} />
            <p className="mt-1 text-tinta-suave">
              <Link href={rutaDeAlumno(alumno.codigo)} className="enlace">
                {alumno.codigo}
              </Link>
              {cuenta.exito && cuenta.valor ? ` · Debe ${formatearMontoExacto(cuenta.valor.totalPendiente)}` : ''}
              {cuenta.exito && cuenta.valor && cuenta.valor.totalVencido > 0 ? ` (vencido ${formatearMontoExacto(cuenta.valor.totalVencido)})` : ''}
            </p>
          </div>
        </header>

        {!cuenta.exito ? (
          <Aviso tono="error" titulo="No pudimos abrir su cuenta">
            <p>{cuenta.error}</p>
          </Aviso>
        ) : pendientes.length === 0 ? (
          <EstadoVacio
            frase="¡Está al día!"
            detalle="No debe nada. Si viene a comprar algo, registra otro cobro."
            accion={
              <Link href={conSede({ alumno: alumno.codigo, modo: 'venta' })} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-estructural px-5 font-bold text-sobre-estructural">
                <Icono nombre="mas" tamano={20} />
                Otro cobro
              </Link>
            }
          />
        ) : (
          <FormularioDelPanel accion={cobrarAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
            <input type="hidden" name="clave" value={randomUUID()} />
            <input type="hidden" name="sede" value={sede.id} />
            <input type="hidden" name="alumno" value={alumno.id} />
            <ProveedorDeTotal inicial={Object.fromEntries(pendientes.map((c) => [c.id, c.pendiente]))}>
              <CargosACobrar
                cargos={pendientes.map((c) => ({
                  id: c.id,
                  descripcion: c.descripcion,
                  pendiente: c.pendiente,
                  venceEl: c.venceEl,
                  vencido: c.vencido,
                  diasDeAtraso: c.diasDeAtraso,
                }))}
              />
              <CamposDeMedio />
              <BotonCobrar />
            </ProveedorDeTotal>
          </FormularioDelPanel>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ paso 1: ¿a quién?
  const [resultados, deudores] = await Promise.all([q ? alumnos.buscarAlumnos({ texto: q }) : Promise.resolve(null), caja.deudores({ sedeId: sede.id })]);
  return (
    <div className="grid max-w-3xl gap-6">
      <EncabezadoDePanel
        titulo="Cobrar"
        descripcion={`Sede ${sede.nombre}`}
        acciones={
          <Link href={conSede({ modo: 'venta' })} className="inline-flex min-h-12 items-center gap-2 rounded-md border-2 border-linea bg-tarjeta px-5 font-semibold text-estructural hover:border-estructural">
            <Icono nombre="mas" tamano={20} />
            Otro cobro (venta)
          </Link>
        }
      />
      {ficha && !ficha.exito ? (
        <Aviso tono="error" titulo="No pudimos abrir la ficha">
          <p>{ficha.error}</p>
        </Aviso>
      ) : null}
      <form role="search" action={RUTAS_CAJA.cobrar} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        {ctx.sedes.length > 1 ? <input type="hidden" name="sede" value={sede.id} /> : null}
        <label htmlFor="q" className="sr-only">
          Buscar alumno
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          maxLength={60}
          placeholder="Nombre, carnet o código del alumno"
          className="min-h-14 w-full rounded-md border-2 border-linea bg-tarjeta px-4 text-lg focus:border-estructural focus:outline-none focus-visible:ring-4 focus-visible:ring-accion/50"
        />
        <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-estructural px-6 font-bold text-sobre-estructural">
          <Icono nombre="buscar" tamano={20} />
          Buscar
        </button>
      </form>

      {resultados ? (
        resultados.exito && resultados.valor.length > 0 ? (
          <ul className="grid gap-2">
            {resultados.valor.map((a) => (
              <li key={a.id}>
                <Link href={conSede({ alumno: a.codigo })} className="mosaico flex items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 hover:border-estructural">
                  <Iniciales nombres={a.nombres} apellidos={a.apellidos} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-estructural">
                      {a.nombres} {a.apellidos}
                    </span>
                    <span className="text-sm text-tinta-suave">{a.codigo}</span>
                  </span>
                  <span className="font-semibold text-estructural">Elegir</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-tinta-suave">{resultados.exito ? 'No encontramos a nadie con esos datos.' : resultados.error}</p>
        )
      ) : null}

      <section aria-labelledby="deben" className="grid gap-3">
        <h2 id="deben" className="t-etiqueta">
          Deben en esta sede
        </h2>
        {deudores.exito && deudores.valor.length > 0 ? (
          <ul className="grid gap-2">
            {deudores.valor.slice(0, 8).map((d) => (
              <li key={d.estudianteId}>
                <Link href={conSede({ alumno: d.codigo })} className="flex flex-wrap items-center gap-3 rounded-md border border-linea bg-tarjeta p-3 hover:border-estructural">
                  <Iniciales nombres={d.nombres} apellidos={d.apellidos} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-estructural">
                      {d.nombres} {d.apellidos}
                    </span>
                    <span className={cn('text-sm', d.totalVencido > 0 ? 'font-semibold text-peligro' : 'text-tinta-suave')}>
                      {d.totalVencido > 0 ? `Vencido ${formatearMontoExacto(d.totalVencido)}` : 'Por vencer'}
                    </span>
                  </span>
                  <span className="font-bold text-estructural">{formatearMontoExacto(d.totalPendiente)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-tinta-suave">{deudores.exito ? 'Nadie debe en esta sede.' : deudores.error}</p>
        )}
      </section>
    </div>
  );
}

