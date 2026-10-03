/**
 * CAPA: Infrastructure / Supabase
 *
 * Lectura de lo que devuelven `resumen_del_mes` y `verificar_cuadre` (jsonb)
 * hacia la forma del puerto de contabilidad. Funciones puras y sin
 * `server-only` para poder probarlas con `node --test`; por eso no usan las
 * piezas de `rpc.ts` (ese módulo sí es solo de servidor) y traen las suyas.
 *
 * Es defensiva a propósito: si a la base le falta una clave o trae algo que
 * no es número (una migración a medias, un mes sin datos), vale 0 o lista
 * vacía y la pantalla sigue en pie en lugar de romperse. Los `bigint` de
 * PostgreSQL llegan como número JSON; los importes son centavos enteros.
 */

import { MEDIOS_DE_PAGO } from '../../core/domain/caja/cobro';
import { TIPOS_DE_MOVIMIENTO } from '../../core/domain/inventario/movimiento';
import type { MedioDePago } from '@core/domain/caja/cobro';
import type { TotalesDeMedio } from '@core/domain/contabilidad/resumen';
import type { TipoDeMovimiento } from '@core/domain/inventario/movimiento';
import type { Centavos, FechaISO } from '@core/domain/shared/tipos-base';
import type { ClaseDeDiferencia, CuadreDeLaBase, TotalesDelMesEnBase } from '@core/application/ports/contabilidad.port';

type Objeto = Readonly<Record<string, unknown>>;

/** Las clases de diferencia que sabe nombrar la pantalla. */
const CLASES_DE_DIFERENCIA: readonly ClaseDeDiferencia[] = ['cantidad', 'valor', 'lotes', 'compra', 'cobro'];

function objeto(valor: unknown): Objeto {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Objeto) : {};
}

function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

/**
 * Número JSON → centavos enteros. Lo que no es un número finito vale 0. Se
 * redondea por si algún total llegara con decimales (no debería: todo es
 * `bigint`), y `|| 0` evita mostrar un «-0».
 */
function centavos(valor: unknown): Centavos {
  return (typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) || 0 : 0) as Centavos;
}

function esMedio(valor: string): valor is MedioDePago {
  return (MEDIOS_DE_PAGO as readonly string[]).includes(valor);
}

function esTipoDeMovimiento(valor: string): valor is TipoDeMovimiento {
  return (TIPOS_DE_MOVIMIENTO as readonly string[]).includes(valor);
}

function esClaseDeDiferencia(valor: string): valor is ClaseDeDiferencia {
  return (CLASES_DE_DIFERENCIA as readonly string[]).includes(valor);
}

function totalesDeMedio(valor: unknown): TotalesDeMedio {
  const m = objeto(valor);
  return {
    cobros: centavos(m.cobros),
    cobrosAnulados: centavos(m.cobros_anulados),
    gastos: centavos(m.gastos),
    gastosAnulados: centavos(m.gastos_anulados),
    compras: centavos(m.compras),
    comprasAnuladas: centavos(m.compras_anuladas),
  };
}

/** `resumen_del_mes(p_mes, p_sede)` → totales del mes sin combinar. */
export function totalesDesdeBase(json: unknown): TotalesDelMesEnBase {
  const r = objeto(json);
  const ingresos = objeto(r.ingresos);
  const costo = objeto(r.costo);
  const gastos = objeto(r.gastos);
  const inventario = objeto(r.inventario);
  const hoy = objeto(r.hoy);

  // Solo los medios que conoce el dominio: uno desconocido no tendría
  // etiqueta ni lugar en el flujo del mes, así que se ignora.
  const dinero: Partial<Record<MedioDePago, TotalesDeMedio>> = {};
  for (const [medio, totales] of Object.entries(objeto(r.dinero))) {
    if (esMedio(medio)) dinero[medio] = totalesDeMedio(totales);
  }

  return {
    desde: texto(r.desde) as FechaISO,
    hasta: texto(r.hasta) as FechaISO,
    ingresos: {
      total: centavos(ingresos.total),
      anulados: centavos(ingresos.anulados),
      porGrupo: lista(ingresos.por_grupo).map((g) => {
        const f = objeto(g);
        return { grupo: texto(f.grupo), monto: centavos(f.monto) };
      }),
    },
    costo: {
      total: centavos(costo.total),
      // Un tipo que el dominio no conoce no se puede etiquetar: se omite.
      porTipo: lista(costo.por_tipo).flatMap((t) => {
        const f = objeto(t);
        const tipo = texto(f.tipo);
        return esTipoDeMovimiento(tipo) ? [{ tipo, monto: centavos(f.monto) }] : [];
      }),
      compras: centavos(costo.compras),
      comprasAnuladas: centavos(costo.compras_anuladas),
      saldosIniciales: centavos(costo.saldos_iniciales),
      saldosInicialesAnulados: centavos(costo.saldos_iniciales_anulados),
    },
    gastos: {
      total: centavos(gastos.total),
      anulados: centavos(gastos.anulados),
      porConcepto: lista(gastos.por_concepto).map((g) => {
        const f = objeto(g);
        return { concepto: texto(f.concepto), icono: texto(f.icono), monto: centavos(f.monto) };
      }),
    },
    dinero,
    arqueos: lista(r.arqueos).map(centavos),
    inventario: { valorInicial: centavos(inventario.valor_inicial), valorFinal: centavos(inventario.valor_final) },
    hoy: { deben: centavos(hoy.deben), valorInventario: centavos(hoy.valor_inventario) },
  };
}

/**
 * `verificar_cuadre(p_sede)` → si cuadra y por qué no. `cuadra` se toma tal
 * cual de la base y no se recalcula con la lista: la base corta la lista en
 * 50 y además compara el valor del libro con el de los saldos. Una
 * diferencia de clase desconocida se omite de la lista, pero `cuadra` sigue
 * diciendo la verdad.
 */
export function cuadreDesdeBase(json: unknown): CuadreDeLaBase {
  const r = objeto(json);
  return {
    cuadra: r.cuadra === true,
    valorLibro: centavos(r.valor_libro),
    valorSaldos: centavos(r.valor_saldos),
    diferencias: lista(r.diferencias).flatMap((d) => {
      const f = objeto(d);
      const clase = texto(f.clase);
      return esClaseDeDiferencia(clase) ? [{ clase, detalle: texto(f.detalle) }] : [];
    }),
  };
}
