/**
 * CAPA: Application / Ports
 *
 * Tablero de administración (especificación §7.7; enmiendas B.12 crítica 29):
 * lo que ningún otro puerto da y la base suma en `tablero_de_administracion`.
 * El tablero de recepción (§7.6) se arma con los puertos que ya existen
 * (préstamos, solicitudes, sin uniforme, lo que deben, lotes, existencias y
 * caja por cerrar).
 */

import type { Centavos, FechaISO, Id, Resultado } from '@core/domain/shared/tipos-base';

export interface DineroDeSemana {
  /** Lunes de la semana. */
  readonly desde: FechaISO;
  readonly entro: Centavos;
  readonly salio: Centavos;
}

export interface TableroDeAdministracionEnBase {
  readonly hoy: FechaISO;
  /**
   * Efectivo de días anteriores que no entró en ningún arqueo. `sede` es la
   * del registro más antiguo (a donde lleva el aviso) y `sedes`, en cuántas
   * sedes hay alguno.
   */
  readonly efectivoSinArqueo: { readonly registros: number; readonly desde: FechaISO | null; readonly sede: Id | null; readonly sedes: number };
  /**
   * Arqueos con diferencia que faltan revisar, de cualquier mes (cuántos y la
   * suma de las diferencias en valor absoluto). `sede` es la del más reciente.
   */
  readonly arqueosConDiferencia: { readonly cantidad: number; readonly monto: Centavos; readonly sede: Id | null; readonly sedes: number };
  /** Bajas y faltantes vigentes de los últimos 7 días (cuántos y cuánto valían). */
  readonly bajasUltimos7Dias: { readonly cantidad: number; readonly monto: Centavos };
  /** Grupos con inscritos y sin precio; uniformes entregados sin cargo y pérdidas de préstamos sin cargo (30 días). */
  readonly sinPrecio: { readonly grupos: number; readonly entregas: number; readonly perdidas: number };
  /** Dinero de este mes (día 1 a hoy) y del mes anterior al mismo día. */
  readonly comparacion: {
    readonly entroMes: Centavos;
    readonly salioMes: Centavos;
    readonly entroAnterior: Centavos;
    readonly salioAnterior: Centavos;
    readonly corteAnterior: FechaISO;
  };
  /** Las últimas 8 semanas, de la más antigua a la actual. */
  readonly semanas: readonly DineroDeSemana[];
}

/** Lo que deben los alumnos, contado en la base (sin el tope de filas de una lista). */
export interface ResumenDeDeudores {
  /** Alumnos con algo pendiente y cuánto suma. */
  readonly alumnos: number;
  readonly pendiente: Centavos;
  /** De ellos, los que tienen algo vencido y cuánto suma lo vencido. */
  readonly alumnosConVencido: number;
  readonly vencido: Centavos;
}

/** Lotes de insumos con alerta, contados en la base. */
export interface LotesConAlertaContados {
  readonly vencidos: number;
  readonly porVencer: number;
}

export interface TableroPort {
  /** Sin sede = todas. Exige `contabilidad.leer`. */
  tableroDeAdministracion(sedeId?: Id): Promise<Resultado<TableroDeAdministracionEnBase>>;
  /** Sin sede = todas. Exige `caja.leer`. */
  resumenDeDeudores(sedeId?: Id): Promise<Resultado<ResumenDeDeudores>>;
  /** Sin sede = todas. Basta `inventario.leer` (lo pide también recepción). */
  contarLotesConAlerta(sedeId?: Id): Promise<Resultado<LotesConAlertaContados>>;
}
