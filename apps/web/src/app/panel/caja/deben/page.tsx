/**
 * CAPA: Presentation / App — Caja · Lo que deben (especificación §7.5).
 *
 * Alumno · cuánto debe · cuánto está vencido y desde hace cuánto · celular.
 * Por fila: «Cobrar» y WhatsApp. Filtro «Solo vencidos». Si el plan dice
 * «periodicidad por confirmar», la nota sale en la cuota (B.12 27).
 *
 * Las cifras de arriba las cuenta la base (`resumen_de_deudores`, misma sede
 * y misma RLS que la lista): la lista se corta en `TOPE_DE_DEUDORES` alumnos
 * (el tope del puerto, el mismo que aplica el adaptador) y sumarla daba menos
 * de lo que se debe de verdad. Con «Solo vencidos» la cifra es la de lo
 * vencido, que es lo que esa vista muestra; si la lista se corta, se dice.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { TOPE_DE_DEUDORES } from '@core/application/ports/caja.port';
import type { ResumenDeDeudores } from '@core/application/ports/tablero.port';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import { cajaRepository, tableroRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_CAJA, rutaDeAlumno } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, EncabezadoDePanel, EstadoVacio, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, PestanasDeCaja, sedeDeCaja, SelectorDeSede, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Lo que deben' };

/** «1.250»: cantidad con punto de miles. */
function conMiles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Cuántos alumnos describe la página según el filtro. */
function alumnosDelFiltro(r: ResumenDeDeudores, soloVencidos: boolean): number {
  return soloVencidos ? r.alumnosConVencido : r.alumnos;
}

/** La línea de arriba: siempre del mismo conjunto que la lista (todos o solo los vencidos). */
function resumenEnFrase(r: ResumenDeDeudores, soloVencidos: boolean): string | undefined {
  const n = alumnosDelFiltro(r, soloVencidos);
  if (n === 0) return undefined;
  if (soloVencidos) {
    return `${n === 1 ? '1 alumno tiene' : `${conMiles(n)} alumnos tienen`} cuotas vencidas por ${formatearMontoExacto(r.vencido)} en total`;
  }
  return `${n === 1 ? '1 alumno debe' : `${conMiles(n)} alumnos deben`} ${formatearMontoExacto(r.pendiente)} en total · ${formatearMontoExacto(r.vencido)} ya vencido`;
}

export default async function LoQueDeben({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CAJA.deben), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.leer');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const q = ctx.sedes.length > 1 && sede ? sede.id : undefined;
  const soloVencidos = parametro(valores, 'vencidos') === '1';
  const [caja, tablero] = await Promise.all([cajaRepository(), tableroRepository()]);
  const [lista, resumen] = await Promise.all([caja.deudores({ sedeId: sede?.id, soloVencidos }), tablero.resumenDeDeudores(sede?.id)]);
  // Si la base no pudo contar, no se muestra una cifra: sumar la lista cortada daría menos.
  const cuantos = resumen.exito ? alumnosDelFiltro(resumen.valor, soloVencidos) : null;
  const cortada = lista.exito && lista.valor.length >= TOPE_DE_DEUDORES && (cuantos === null || cuantos > lista.valor.length);
  const base = (extra: string) => `${RUTAS_CAJA.deben}?${[q ? `sede=${q}` : '', extra].filter(Boolean).join('&')}`;

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Lo que" resaltado="deben" descripcion={resumen.exito ? resumenEnFrase(resumen.valor, soloVencidos) : undefined} />
      <PestanasDeCaja activa={RUTAS_CAJA.deben} sede={q} />
      <SelectorDeSede ctx={ctx} actual={sede?.id ?? ''} base={RUTAS_CAJA.deben} />
      <nav aria-label="Filtrar" className="flex flex-wrap gap-2">
        {[
          { href: base(''), etiqueta: 'Todos', activo: !soloVencidos },
          { href: base('vencidos=1'), etiqueta: 'Solo vencidos', activo: soloVencidos },
        ].map((f) => (
          <Link
            key={f.etiqueta}
            href={f.href}
            aria-current={f.activo ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border-2 px-4 font-semibold',
              f.activo ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar la lista">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio frase="¡Todos al día!" detalle={soloVencidos ? 'Nadie tiene cuotas vencidas.' : 'Nadie debe en esta sede.'} />
      ) : (
        <>
          {cortada ? (
            <p className="-mb-3 text-sm text-tinta-suave">
              {cuantos === null
                ? `Se muestran los primeros ${TOPE_DE_DEUDORES} alumnos; puede haber más.`
                : `Se muestran los primeros ${TOPE_DE_DEUDORES} de ${conMiles(cuantos)} alumnos.`}{' '}
              Primero los que más tienen vencido.
            </p>
          ) : null}
          <ul className="grid gap-3">
            {lista.valor.map((d) => (
              <li key={d.estudianteId} className="flex flex-wrap items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4">
                <Iniciales nombres={d.nombres} apellidos={d.apellidos} />
                <span className="min-w-0 flex-1">
                  <Link href={rutaDeAlumno(d.codigo)} className="block text-lg leading-tight font-bold text-estructural hover:underline">
                    {d.nombres} {d.apellidos}
                  </Link>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
                    {d.codigo} · {d.cargosPendientes === 1 ? '1 cargo' : `${d.cargosPendientes} cargos`}
                    {d.totalVencido > 0 ? (
                      <Chip tono="rojo" icono="alerta">
                        Vencido hace {d.diasDeAtraso} {d.diasDeAtraso === 1 ? 'día' : 'días'}
                      </Chip>
                    ) : (
                      <Chip tono="gris">Por vencer</Chip>
                    )}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-xl font-black text-estructural">{formatearMontoExacto(d.totalPendiente)}</span>
                  {d.totalVencido > 0 ? <span className="text-sm font-semibold text-peligro">vencido {formatearMontoExacto(d.totalVencido)}</span> : null}
                </span>
                <span className="flex flex-wrap gap-2">
                  {d.telefono ? (
                    <a
                      href={`https://wa.me/591${d.telefono}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp a ${d.nombres}`}
                      className="inline-grid size-12 place-items-center rounded-md border-2 border-linea text-estructural hover:border-estructural"
                    >
                      <Icono nombre="whatsapp" tamano={20} />
                    </a>
                  ) : null}
                  {tienePermiso(ctx, 'caja.cobrar') ? (
                    <Link
                      href={`${RUTAS_CAJA.cobrar}?alumno=${encodeURIComponent(d.codigo)}${q ? `&sede=${q}` : ''}`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-4 font-bold text-sobre-accion hover:bg-accion-fuerte"
                    >
                      <Icono nombre="monedas" tamano={18} />
                      Cobrar
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
