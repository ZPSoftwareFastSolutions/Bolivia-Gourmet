/**
 * CAPA: Presentation / Panel
 *
 * El único gráfico del tablero de administración (especificación §7.7;
 * enmiendas B.12 crítica 29): «Entró y salió» de las últimas semanas, en
 * barras agrupadas dibujadas en el servidor. Server Component sin estado y
 * sin JavaScript.
 *
 * Por qué así:
 * - SVG con atributos de presentación (`fill="currentColor"`, `x`, `y`,
 *   `height`) y clases de Tailwind para el color: la CSP no admite `style`.
 * - Las alturas llegan calculadas (`barrasDeSemanas`, dominio y con pruebas);
 *   aquí solo se colocan.
 * - Entró en azul marino; salió en amarillo con borde azul. El amarillo solo
 *   no contrasta con el blanco (1,4:1): el borde azul da el contorno que se ve
 *   y respeta la regla de la marca («el amarillo siempre lleva azul»). El
 *   vino queda para Capacitación.
 * - El color nunca va solo: leyenda con texto, `<title>` por semana (el
 *   rótulo que el navegador muestra al pasar el puntero, sin JavaScript) y la
 *   tabla «Ver como tabla» con las cifras exactas.
 * - Sin eje con cifras: la descripción dice cuánto vale la barra más alta y
 *   la tabla da cada valor. Un eje con seis números sería ruido en un panel
 *   pensado para leerse de un vistazo.
 */

import type { BarraDeSemana } from '@core/domain/contabilidad/tablero';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { formatearDiaCorto } from '@/lib/fechas';

/** Alto, en unidades del `viewBox`, que se pasa a `barrasDeSemanas`. */
export const ALTO_DE_BARRAS = 120;

const MARGEN_SUPERIOR = 8;
const BASE = MARGEN_SUPERIOR + ALTO_DE_BARRAS;
const ALTO_TOTAL = BASE + 28;
/** Cada semana ocupa 52 unidades: dos barras de 18 con 2 de separación y 7 de aire a cada lado. */
const ANCHO_DE_SEMANA = 52;
const ANCHO_DE_BARRA = 18;
const SEPARACION = 2;
const AIRE = (ANCHO_DE_SEMANA - 2 * ANCHO_DE_BARRA - SEPARACION) / 2;
const RADIO = 3;

const ID_TITULO = 'grafico-semanal-titulo';
const ID_DESCRIPCION = 'grafico-semanal-descripcion';

/** Fecha `AAAA-MM-DD` más N días, sin pasar por la zona horaria local. */
function sumarDias(fecha: string, dias: number): string {
  const ms = Date.parse(`${fecha}T12:00:00Z`);
  return Number.isNaN(ms) ? fecha : new Date(ms + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Barra con las esquinas de arriba redondeadas y la base recta, apoyada en la
 * línea base: así se ve dónde empieza cada barra.
 */
function trazoDeBarra(x: number, alto: number): string {
  const arriba = BASE - alto;
  const r = Math.min(RADIO, alto / 2, ANCHO_DE_BARRA / 2);
  const derecha = x + ANCHO_DE_BARRA;
  return `M${x} ${BASE}V${arriba + r}Q${x} ${arriba} ${x + r} ${arriba}H${derecha - r}Q${derecha} ${arriba} ${derecha} ${arriba + r}V${BASE}Z`;
}

function semanaLarga(desde: string): string {
  return `Del ${formatearDiaCorto(desde)} al ${formatearDiaCorto(sumarDias(desde, 6))}`;
}

/** La cifra más alta del gráfico, para dar escala sin eje. */
function mayor(semanas: readonly BarraDeSemana[]): { readonly monto: Centavos; readonly desde: string; readonly cual: 'entró' | 'salió' } | null {
  let mejor: { monto: Centavos; desde: string; cual: 'entró' | 'salió' } | null = null;
  for (const s of semanas) {
    if (s.entro > 0 && (!mejor || s.entro > mejor.monto)) mejor = { monto: s.entro, desde: s.desde, cual: 'entró' };
    if (s.salio > 0 && (!mejor || s.salio > mejor.monto)) mejor = { monto: s.salio, desde: s.desde, cual: 'salió' };
  }
  return mejor;
}

export function GraficoSemanal({ semanas, titulo }: { readonly semanas: readonly BarraDeSemana[]; readonly titulo: string }) {
  const vacio = semanas.every((s) => s.entro === 0 && s.salio === 0);
  const ancho = Math.max(1, semanas.length) * ANCHO_DE_SEMANA;
  const tope = mayor(semanas);

  return (
    <section aria-labelledby={ID_TITULO} className="grid gap-3 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
      <h2 id={ID_TITULO} className="t-display text-3xl text-estructural">
        {titulo}
      </h2>

      {vacio ? (
        <p className="text-tinta-suave">Todavía no hay movimientos de dinero en estas {semanas.length > 0 ? semanas.length : 8} semanas.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-tinta" aria-label="Leyenda">
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3.5 rounded-sm bg-estructural" />
              Entró
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3.5 rounded-sm bg-accion ring-2 ring-estructural ring-inset" />
              Salió
            </li>
          </ul>

          <p id={ID_DESCRIPCION} className="text-sm text-tinta-suave">
            Cada semana empieza el lunes; la última es la actual.
            {tope ? ` La barra más alta: ${tope.cual} ${formatearMontoExacto(tope.monto)} la semana del ${formatearDiaCorto(tope.desde)}.` : null}
          </p>

          {/* El SVG escala con el ancho: en un teléfono (≈300 px) el rótulo de 14 unidades queda en ≈10 px y,
              con el tope de `max-w-xl`, en escritorio no pasa de ≈19 px. */}
          <div className="max-w-xl">
            <svg
              role="img"
              aria-labelledby={ID_TITULO}
              aria-describedby={ID_DESCRIPCION}
              viewBox={`0 0 ${ancho} ${ALTO_TOTAL}`}
              className="block h-auto w-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1={0} x2={ancho} y1={BASE + 0.5} y2={BASE + 0.5} stroke="currentColor" strokeWidth={1} className="text-linea" />
              {semanas.map((s, i) => {
                const x = i * ANCHO_DE_SEMANA;
                const actual = i === semanas.length - 1;
                return (
                  <g key={s.desde}>
                    <title>{`${semanaLarga(s.desde)}: entró ${formatearMontoExacto(s.entro)}, salió ${formatearMontoExacto(s.salio)}`}</title>
                    {/* Rectángulo invisible del ancho de la semana: el rótulo aparece aunque la barra sea baja. */}
                    <rect x={x} y={MARGEN_SUPERIOR} width={ANCHO_DE_SEMANA} height={ALTO_DE_BARRAS} fill="transparent" />
                    {s.altoEntro > 0 ? <path d={trazoDeBarra(x + AIRE, s.altoEntro)} fill="currentColor" className="text-estructural" /> : null}
                    {s.altoSalio > 0 ? (
                      <path
                        d={trazoDeBarra(x + AIRE + ANCHO_DE_BARRA + SEPARACION, s.altoSalio)}
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        className="fill-accion text-estructural"
                      />
                    ) : null}
                    <text
                      x={x + ANCHO_DE_SEMANA / 2}
                      y={BASE + 19}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={actual ? 700 : 500}
                      fill="currentColor"
                      className={actual ? 'text-estructural' : 'text-tinta-suave'}
                    >
                      {formatearDiaCorto(s.desde)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <details className="group rounded-md border-2 border-linea">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-estructural [&::-webkit-details-marker]:hidden">
              <span className="flex-1">Ver como tabla</span>
              <span className="text-sm font-normal text-tinta-suave group-open:hidden">Abrir</span>
              <span className="hidden text-sm font-normal text-tinta-suave group-open:inline">Cerrar</span>
            </summary>
            <div className="overflow-x-auto border-t-2 border-linea p-4">
              <table className="w-full text-left">
                <caption className="pb-2 text-left text-sm text-tinta-suave">Lo que entró y salió cada semana, de la más antigua a la actual.</caption>
                <thead>
                  <tr className="border-b-2 border-linea">
                    <th scope="col" className="py-2 pr-3 font-semibold text-tinta">
                      Semana
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold text-tinta">
                      Entró
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold text-tinta">
                      Salió
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((s, i) => (
                    <tr key={s.desde} className="border-b border-linea">
                      <th scope="row" className="py-2 pr-3 font-normal text-tinta">
                        {semanaLarga(s.desde)}
                        {i === semanas.length - 1 ? <span className="text-tinta-suave"> (esta semana)</span> : null}
                      </th>
                      <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap text-estructural">{formatearMontoExacto(s.entro)}</td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap text-estructural">{formatearMontoExacto(s.salio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
