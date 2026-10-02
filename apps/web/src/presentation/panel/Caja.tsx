'use client';

/**
 * CAPA: Presentation / Panel — piezas interactivas de la caja.
 *
 * - `ProveedorDeTotal`, `CargosACobrar` y `BotonCobrar`: los cargos vienen
 *   todos marcados con lo que falta pagar; si se desmarca uno o se cambia un
 *   monto, el total y el botón («Cobrar Bs 650,00») se actualizan solos.
 * - `CalculoDeArqueo`: mientras se escribe lo contado, dice en grande si la
 *   caja cuadra o cuánto falta o sobra (el servidor vuelve a calcularlo).
 * - `BotonImprimir`: imprime el recibo (el menú y las barras no salen).
 *
 * La base decide; esto solo ayuda a ver antes de guardar. Los montos se leen
 * con `parsearMonto` del dominio, igual que en el servidor.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { describirDiferencia } from '@core/domain/caja/arqueo';
import { formatearMontoExacto, montoParaCampo, parsearMonto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { cn } from '@/lib/cn';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar } from './Formulario';

// ---------------------------------------------------------------- cobro

const Total = createContext<{ readonly total: number; readonly fijar: (id: string, monto: number) => void }>({ total: 0, fijar: () => undefined });

export function ProveedorDeTotal({ inicial, children }: { readonly inicial: Readonly<Record<string, number>>; readonly children: ReactNode }) {
  const [montos, setMontos] = useState<Record<string, number>>({ ...inicial });
  const valor = useMemo(
    () => ({
      total: Object.values(montos).reduce((t, m) => t + m, 0),
      fijar: (id: string, monto: number) => setMontos((previos) => ({ ...previos, [id]: monto })),
    }),
    [montos],
  );
  return <Total.Provider value={valor}>{children}</Total.Provider>;
}

export interface CargoParaCobrar {
  readonly id: string;
  readonly descripcion: string;
  readonly pendiente: number;
  readonly venceEl: string;
  readonly vencido: boolean;
  readonly diasDeAtraso: number;
}

function Fila({ cargo }: { readonly cargo: CargoParaCobrar }) {
  const { fijar } = useContext(Total);
  const [marcado, setMarcado] = useState(true);
  const [texto, setTexto] = useState(montoParaCampo(cargo.pendiente as Centavos));
  const leido = parsearMonto(texto);
  const excede = leido.exito && leido.valor > cargo.pendiente;

  function actualizar(siguienteMarcado: boolean, siguienteTexto: string) {
    const r = parsearMonto(siguienteTexto);
    fijar(cargo.id, siguienteMarcado && r.exito ? r.valor : 0);
  }

  return (
    <li className={cn('grid gap-3 rounded-md border-2 p-3 sm:grid-cols-[auto_1fr_10rem] sm:items-center', marcado ? 'border-estructural/40 bg-tarjeta' : 'border-linea bg-superficie-alterna')}>
      <input type="hidden" name={`pendiente-${cargo.id}`} value={cargo.pendiente} />
      <input
        type="checkbox"
        name="cargo"
        value={cargo.id}
        checked={marcado}
        onChange={(e) => {
          setMarcado(e.target.checked);
          actualizar(e.target.checked, texto);
        }}
        aria-label={`Cobrar ${cargo.descripcion}`}
        className="size-6 accent-[var(--t-estructural)]"
      />
      <span>
        <span className="block font-semibold text-tinta">{cargo.descripcion}</span>
        <span className={cn('text-sm', cargo.vencido ? 'font-semibold text-peligro' : 'text-tinta-suave')}>
          {cargo.vencido ? (
            <>
              <Icono nombre="alerta" tamano={14} className="me-1 inline" />
              Vencido hace {cargo.diasDeAtraso} {cargo.diasDeAtraso === 1 ? 'día' : 'días'}
            </>
          ) : (
            `Vence el ${cargo.venceEl.split('-').reverse().join('/')}`
          )}{' '}
          · debe {formatearMontoExacto(cargo.pendiente as Centavos)}
        </span>
      </span>
      <label className="grid gap-1 text-sm">
        <span className="text-tinta-suave">Cobrar (Bs)</span>
        <input
          name={`monto-${cargo.id}`}
          inputMode="decimal"
          value={texto}
          disabled={!marcado}
          onChange={(e) => {
            setTexto(e.target.value);
            actualizar(marcado, e.target.value);
          }}
          aria-invalid={excede || undefined}
          className={cn('min-h-12 rounded-md border-2 bg-tarjeta px-3 text-lg font-semibold', excede ? 'border-peligro' : 'border-linea focus:border-estructural')}
        />
        {excede ? <span className="font-semibold text-peligro">Más de lo que debe</span> : null}
      </label>
    </li>
  );
}

export function CargosACobrar({ cargos }: { readonly cargos: readonly CargoParaCobrar[] }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-tinta">¿Qué paga?</legend>
      <ul className="grid gap-2">
        {cargos.map((c) => (
          <Fila key={c.id} cargo={c} />
        ))}
      </ul>
    </fieldset>
  );
}

export function BotonCobrar() {
  const { total } = useContext(Total);
  return (
    <div className="grid gap-2">
      <p className="t-display text-4xl text-estructural" aria-live="polite">
        Total: {formatearMontoExacto(total as Centavos)}
      </p>
      <BotonGuardar icono="monedas" enviando="Cobrando…" className="justify-self-start">
        {total > 0 ? `Cobrar ${formatearMontoExacto(total as Centavos)}` : 'Cobrar'}
      </BotonGuardar>
    </div>
  );
}

// ---------------------------------------------------------------- arqueo

export function CalculoDeArqueo({ esperado, pideSaldoInicial }: { readonly esperado: number; readonly pideSaldoInicial: boolean }) {
  const [saldo, setSaldo] = useState('0');
  const [contado, setContado] = useState('');
  const [queda, setQueda] = useState('');
  const base = pideSaldoInicial ? (parsearMontoOCero(saldo) ?? 0) : 0;
  const esperadoReal = esperado + base;
  const contadoLeido = contado.trim() === '' ? null : parsearMontoOCero(contado);
  const quedaLeida = parsearMontoOCero(queda);
  const diferencia = contadoLeido === null ? null : contadoLeido - esperadoReal;
  const retiro = contadoLeido !== null && quedaLeida !== null ? contadoLeido - quedaLeida : null;

  return (
    <div className="grid gap-5">
      {pideSaldoInicial ? (
        <label className="grid gap-1.5">
          <span className="font-semibold text-tinta">¿Con cuánto empezó la caja? (Bs)</span>
          <span className="text-sm text-tinta-suave">Es el primer cierre de esta sede: escribe el cambio que había en el cajón al empezar.</span>
          <input name="saldoInicial" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} className="min-h-14 rounded-md border-2 border-linea bg-tarjeta px-4 text-xl font-semibold" />
        </label>
      ) : null}
      <p className="rounded-md bg-superficie-alterna p-4 text-lg">
        Debería haber en el cajón: <strong className="t-display text-3xl text-estructural">{formatearMontoExacto(esperadoReal as Centavos)}</strong>
      </p>
      <label className="grid gap-1.5">
        <span className="font-semibold text-tinta">¿Cuánto contaste? (Bs)</span>
        <input name="contado" inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} className="min-h-14 rounded-md border-2 border-linea bg-tarjeta px-4 text-xl font-semibold" />
      </label>
      {diferencia !== null ? (
        <p aria-live="polite" className={cn('t-display text-4xl', diferencia === 0 ? 'text-exito' : 'text-peligro')}>
          {describirDiferencia(diferencia as Centavos)}
        </p>
      ) : null}
      <label className="grid gap-1.5">
        <span className="font-semibold text-tinta">¿Cuánto dejas para el cambio? (Bs)</span>
        <span className="text-sm text-tinta-suave">El resto se retira o se deposita. Vacío = no dejas nada.</span>
        <input name="queda" inputMode="decimal" value={queda} onChange={(e) => setQueda(e.target.value)} className="min-h-14 rounded-md border-2 border-linea bg-tarjeta px-4 text-xl font-semibold" />
      </label>
      {retiro !== null && retiro >= 0 ? (
        <p className="text-tinta-suave">Se retira: {formatearMontoExacto(retiro as Centavos)}</p>
      ) : retiro !== null ? (
        <p className="font-semibold text-peligro">No puedes dejar más de lo que contaste.</p>
      ) : null}
      {diferencia !== null && diferencia !== 0 ? (
        <label className="grid gap-1.5">
          <span className="font-semibold text-tinta">¿Qué pasó?</span>
          <textarea name="observacion" rows={3} maxLength={500} className="rounded-md border-2 border-linea bg-tarjeta p-3" />
        </label>
      ) : null}
    </div>
  );
}

function parsearMontoOCero(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return 0;
  if (/^0+([.,]0+)?$/.test(limpio)) return 0;
  const r = parsearMonto(limpio);
  return r.exito ? r.valor : null;
}

// ---------------------------------------------------------------- recibo

export function BotonImprimir({ children = 'Imprimir recibo' }: { readonly children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="panel-sin-imprimir inline-flex min-h-12 items-center gap-2 rounded-md bg-estructural px-5 font-bold text-sobre-estructural hover:bg-estructural-profundo"
    >
      <Icono nombre="imprimir" tamano={20} />
      {children}
    </button>
  );
}
