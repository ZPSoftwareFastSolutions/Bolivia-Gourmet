/**
 * CAPA: Infrastructure / Supabase
 *
 * Lectura de lo que devuelven `tablero_de_administracion(p_sede)` y
 * `resumen_de_deudores(p_sede)` (jsonb) hacia la forma del puerto del
 * tablero. Funciones puras y sin `server-only` para poder probarlas con
 * `node --test`; por eso no usa las piezas de
 * `rpc.ts` (ese módulo sí es solo de servidor) y trae las suyas, igual que
 * `contabilidad-desde-base.ts`.
 *
 * Es defensiva a propósito: si a la base le falta una clave o trae algo que
 * no es número (una migración a medias, una sede sin datos), las cantidades
 * y montos valen 0, las listas vacías y la fecha opcional `null`, y el
 * tablero sigue en pie en lugar de romperse. Los `bigint` de PostgreSQL
 * llegan como número JSON; los importes son centavos enteros.
 */

import type { Centavos, FechaISO, Id } from '@core/domain/shared/tipos-base';
import type { DineroDeSemana, ResumenDeDeudores, TableroDeAdministracionEnBase } from '@core/application/ports/tablero.port';

type Objeto = Readonly<Record<string, unknown>>;

function objeto(valor: unknown): Objeto {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Objeto) : {};
}

function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

/**
 * Número JSON → centavos enteros, CON signo: los netos del mes pueden quedar
 * bajo cero si se anuló más de lo que se registró. Lo que no es un número
 * finito vale 0, y `|| 0` evita mostrar un «-0».
 */
function centavos(valor: unknown): Centavos {
  return (typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) || 0 : 0) as Centavos;
}

/** Un conteo (`count(*)`): entero y nunca negativo. */
function cantidad(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.max(0, Math.round(valor)) : 0;
}

const PATRON_DE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `AAAA-MM-DD` o `null` si falta o trae otra cosa. */
function fechaONula(valor: unknown): FechaISO | null {
  return typeof valor === 'string' && PATRON_DE_FECHA.test(valor) ? (valor as FechaISO) : null;
}

const PATRON_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identificador de una sede o `null` si falta o trae otra cosa. */
function idONulo(valor: unknown): Id | null {
  return typeof valor === 'string' && PATRON_DE_UUID.test(valor) ? (valor as Id) : null;
}

/** Fecha obligatoria en el puerto: si falta, texto vacío (como hace el adaptador de contabilidad). */
function fecha(valor: unknown): FechaISO {
  return fechaONula(valor) ?? ('' as FechaISO);
}

function semana(valor: unknown): DineroDeSemana {
  const s = objeto(valor);
  return { desde: fecha(s.desde), entro: centavos(s.entro), salio: centavos(s.salio) };
}

/** `tablero_de_administracion(p_sede)` → datos del tablero de administración. */
export function tableroDesdeBase(json: unknown): TableroDeAdministracionEnBase {
  const r = objeto(json);
  const efectivo = objeto(r.efectivo_sin_arqueo);
  const arqueos = objeto(r.arqueos_con_diferencia);
  const bajas = objeto(r.bajas_7_dias);
  const sinPrecio = objeto(r.sin_precio);
  const comparacion = objeto(r.comparacion);

  return {
    hoy: fecha(r.hoy),
    efectivoSinArqueo: {
      registros: cantidad(efectivo.registros),
      desde: fechaONula(efectivo.desde),
      sede: idONulo(efectivo.sede),
      sedes: cantidad(efectivo.sedes),
    },
    arqueosConDiferencia: {
      cantidad: cantidad(arqueos.cantidad),
      monto: centavos(arqueos.monto),
      sede: idONulo(arqueos.sede),
      sedes: cantidad(arqueos.sedes),
    },
    bajasUltimos7Dias: { cantidad: cantidad(bajas.cantidad), monto: centavos(bajas.monto) },
    sinPrecio: {
      grupos: cantidad(sinPrecio.grupos),
      entregas: cantidad(sinPrecio.entregas),
      perdidas: cantidad(sinPrecio.perdidas),
    },
    comparacion: {
      entroMes: centavos(comparacion.entro_mes),
      salioMes: centavos(comparacion.salio_mes),
      entroAnterior: centavos(comparacion.entro_anterior),
      salioAnterior: centavos(comparacion.salio_anterior),
      corteAnterior: fecha(comparacion.corte_anterior),
    },
    // Se conserva el orden de la base (de la más antigua a la actual) y cada
    // semana aunque le falte una cifra: el gráfico necesita sus 8 columnas.
    semanas: lista(r.semanas).map(semana),
  };
}

/** `resumen_de_deudores(p_sede)` → cuántos deben y cuánto (lo vencido aparte). */
export function deudoresDesdeBase(json: unknown): ResumenDeDeudores {
  const r = objeto(json);
  return {
    alumnos: cantidad(r.alumnos),
    pendiente: centavos(r.pendiente),
    alumnosConVencido: cantidad(r.alumnos_con_vencido),
    vencido: centavos(r.vencido),
  };
}
