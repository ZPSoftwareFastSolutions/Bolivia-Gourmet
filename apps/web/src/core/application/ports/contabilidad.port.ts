/**
 * CAPA: Application / Ports
 *
 * Contabilidad del panel interno (especificación §5.7; solo administración):
 * los totales del mes que suma la base (`resumen_del_mes`), la verificación
 * del cuadre (`verificar_cuadre`), los gastos y las compras del mes y los
 * datos de la tarjeta kárdex PEPS de un insumo. Registrar y anular un gasto
 * van por la caja (`CajaPort`); anular una compra, por el inventario.
 */

import type { MedioDePago } from '@core/domain/caja/cobro';
import type { TotalesDeMedio } from '@core/domain/contabilidad/resumen';
import type { TipoDeMovimiento } from '@core/domain/inventario/movimiento';
import type { Milesimas } from '@core/domain/shared/cantidad';
import type { Centavos, FechaISO, Id, Resultado } from '@core/domain/shared/tipos-base';
import type { MovimientoEnKardex, TipoDeComprobante } from './inventario.port';

/** Totales del mes tal como los suma la base (sin combinar todavía). */
export interface TotalesDelMesEnBase {
  /** Primer día del mes y primer día del mes siguiente. */
  readonly desde: FechaISO;
  readonly hasta: FechaISO;
  readonly ingresos: {
    readonly total: Centavos;
    readonly anulados: Centavos;
    /** Neto por grupo de concepto (Colegiaturas, Ventas…), de mayor a menor. */
    readonly porGrupo: readonly { readonly grupo: string; readonly monto: Centavos }[];
  };
  readonly costo: {
    /** Costo de lo usado (con signo). */
    readonly total: Centavos;
    readonly porTipo: readonly { readonly tipo: TipoDeMovimiento; readonly monto: Centavos }[];
    readonly compras: Centavos;
    readonly comprasAnuladas: Centavos;
    readonly saldosIniciales: Centavos;
    readonly saldosInicialesAnulados: Centavos;
  };
  readonly gastos: {
    readonly total: Centavos;
    readonly anulados: Centavos;
    readonly porConcepto: readonly { readonly concepto: string; readonly icono: string; readonly monto: Centavos }[];
  };
  /** Dinero del mes por medio (los medios sin movimiento no vienen). */
  readonly dinero: Partial<Record<MedioDePago, TotalesDeMedio>>;
  /** `diferencia` (contado − esperado) de cada arqueo del mes, en orden. */
  readonly arqueos: readonly Centavos[];
  /** Valor del inventario según el libro al empezar y al terminar el mes. */
  readonly inventario: { readonly valorInicial: Centavos; readonly valorFinal: Centavos };
  /** Cifras de hoy: lo que deben los alumnos y el valor del inventario. */
  readonly hoy: { readonly deben: Centavos; readonly valorInventario: Centavos };
}

export type ClaseDeDiferencia = 'cantidad' | 'valor' | 'lotes' | 'compra' | 'cobro';

export interface CuadreDeLaBase {
  readonly cuadra: boolean;
  readonly valorLibro: Centavos;
  readonly valorSaldos: Centavos;
  readonly diferencias: readonly { readonly clase: ClaseDeDiferencia; readonly detalle: string }[];
}

export interface GastoEnLista {
  readonly id: Id;
  readonly numero: number;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly fecha: FechaISO;
  readonly conceptoNombre: string;
  readonly conceptoIcono: string;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly medio: MedioDePago;
  readonly referencia: string | null;
  readonly comprobante: TipoDeComprobante;
  readonly numeroComprobante: string | null;
  readonly proveedor: string | null;
  readonly anulado: boolean;
  readonly anuladoEl: FechaISO | null;
  readonly anulacionMotivo: string | null;
  /** Nombre de quien lo registró. */
  readonly quien: string;
}

export interface CompraEnLista {
  readonly id: Id;
  readonly numero: number;
  readonly operacionId: Id;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly fecha: FechaISO;
  readonly fechaDocumento: FechaISO | null;
  readonly proveedor: string | null;
  readonly comprobante: TipoDeComprobante;
  readonly numeroComprobante: string | null;
  readonly medio: MedioDePago;
  readonly referencia: string | null;
  readonly total: Centavos;
  readonly anulado: boolean;
  readonly anuladoEl: FechaISO | null;
  readonly anulacionMotivo: string | null;
  readonly quien: string;
  /** Resumen de lo comprado: «Harina de trigo», «Juego de uniforme · M»… */
  readonly articulos: readonly string[];
}

/** Lo que salió de (o entró a) un lote en un movimiento. */
export interface TomaDeLote {
  readonly movimientoId: Id;
  readonly loteId: Id;
  readonly cantidad: Milesimas;
  readonly valor: Centavos;
}

export interface LoteDeTarjeta {
  readonly id: Id;
  /** Orden PEPS entre lotes con la misma fecha. */
  readonly secuencia: number;
  readonly fechaIngreso: FechaISO;
  readonly venceEl: FechaISO | null;
  readonly origen: 'compra' | 'saldo_inicial' | 'sobrante';
}

export interface DatosDeTarjetaPeps {
  /** Del más antiguo al más nuevo, con su valor (`deltaValor`). */
  readonly movimientos: readonly MovimientoEnKardex[];
  readonly tomas: readonly TomaDeLote[];
  readonly lotes: readonly LoteDeTarjeta[];
}

export interface ContabilidadPort {
  /** `mes` en forma `AAAA-MM`; sin sede = todas. */
  totalesDelMes(mes: string, sedeId?: Id): Promise<Resultado<TotalesDelMesEnBase>>;
  verificarCuadre(sedeId?: Id): Promise<Resultado<CuadreDeLaBase>>;
  /** Gastos con fecha en el mes o anulados en el mes, del más nuevo al más antiguo. */
  gastos(mes: string, sedeId?: Id): Promise<Resultado<readonly GastoEnLista[]>>;
  /** Compras con fecha en el mes o anuladas en el mes, de la más nueva a la más antigua. */
  compras(mes: string, sedeId?: Id): Promise<Resultado<readonly CompraEnLista[]>>;
  compra(id: Id): Promise<Resultado<CompraEnLista | null>>;
  /** Tarjeta PEPS de un insumo en una sede (insumos: una sola variante por artículo). */
  tarjetaPeps(articuloId: Id, sedeId: Id): Promise<Resultado<DatosDeTarjetaPeps>>;
}
