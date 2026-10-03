/**
 * CAPA: Application / Ports
 *
 * Caja del panel interno (enmiendas B.1): lo que deben, cobrar con recibo,
 * cerrar caja, anular y gastos. Lecturas listas para la pantalla; escrituras
 * por RPC con la clave del formulario (un doble envío nunca cobra dos veces).
 */

import type { MedioDePago } from '@core/domain/caja/cobro';
import type { OrigenDeCargo, EstadoDeCargo } from '@core/domain/caja/cargo';
import type { Centavos, FechaISO, Id, Resultado } from '@core/domain/shared/tipos-base';

// ---------------------------------------------------------------- lecturas

export interface CargoDeCuenta {
  readonly id: Id;
  readonly descripcion: string;
  readonly conceptoNombre: string;
  readonly origen: OrigenDeCargo;
  readonly monto: Centavos;
  readonly aplicado: Centavos;
  readonly pendiente: Centavos;
  readonly estado: EstadoDeCargo;
  readonly venceEl: FechaISO;
  readonly vencido: boolean;
  readonly diasDeAtraso: number;
}

export interface CuentaDeAlumno {
  readonly estudianteId: Id;
  readonly codigo: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly telefono: string | null;
  readonly sedeId: Id;
  readonly totalPendiente: Centavos;
  readonly totalVencido: Centavos;
  /** Del más antiguo al más nuevo; incluye pagados y anulados recientes. */
  readonly cargos: readonly CargoDeCuenta[];
}

export interface FiltroDeDeudores {
  readonly soloVencidos?: boolean;
  readonly sedeId?: Id;
  readonly texto?: string;
}

export interface Deudor {
  readonly estudianteId: Id;
  readonly codigo: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly telefono: string | null;
  readonly sedeNombre: string;
  readonly totalPendiente: Centavos;
  readonly totalVencido: Centavos;
  readonly cargosPendientes: number;
  readonly diasDeAtraso: number;
}

export interface LineaDeRecibo {
  readonly descripcion: string;
  readonly monto: Centavos;
}

export interface Recibo {
  readonly id: Id;
  readonly numero: string;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly fecha: FechaISO;
  readonly registradoEn: string;
  readonly alumno: { readonly id: Id; readonly codigo: string; readonly nombre: string } | null;
  readonly cliente: string | null;
  readonly monto: Centavos;
  readonly medio: MedioDePago;
  readonly referencia: string | null;
  readonly nota: string | null;
  readonly cobradoPor: string;
  readonly lineas: readonly LineaDeRecibo[];
  readonly anulacion: { readonly el: FechaISO; readonly motivo: string; readonly por: string } | null;
}

export interface ReciboEnLista {
  readonly id: Id;
  readonly numero: string;
  readonly registradoEn: string;
  readonly quien: string;
  readonly monto: Centavos;
  readonly medio: MedioDePago;
  readonly anulado: boolean;
  readonly sedeNombre: string;
}

export interface SalidaPorArquear {
  readonly quien: string;
  readonly cuando: string;
  readonly monto: Centavos;
  readonly clase: 'salida' | 'cobro_anulado';
}

export interface DigitalPorArquear {
  readonly recibo: string;
  readonly medio: MedioDePago;
  readonly referencia: string | null;
  readonly monto: Centavos;
}

export interface CajaPorCerrar {
  readonly primerArqueo: boolean;
  readonly saldoInicial: Centavos;
  readonly entradasEfectivo: Centavos;
  readonly salidasEfectivo: Centavos;
  readonly esperado: Centavos;
  readonly cobrosQr: Centavos;
  readonly cobrosTransferencia: Centavos;
  readonly registros: number;
  readonly ultimoCierreEn: string | null;
  readonly salidas: readonly SalidaPorArquear[];
  readonly digitales: readonly DigitalPorArquear[];
}

export interface Arqueo {
  readonly id: Id;
  readonly numero: number;
  readonly sedeNombre: string;
  readonly cerradoEn: string;
  readonly saldoInicial: Centavos;
  readonly esperado: Centavos;
  readonly contado: Centavos;
  readonly diferencia: Centavos;
  readonly retiro: Centavos;
  readonly queda: Centavos;
  readonly cobrosQr: Centavos;
  readonly cobrosTransferencia: Centavos;
  readonly cerradoPor: string;
  readonly observacion: string | null;
}

export interface ConceptoDeCaja {
  readonly id: Id;
  readonly codigo: string;
  readonly nombre: string;
  readonly naturaleza: 'ingreso' | 'gasto';
  readonly grupo: string;
  readonly icono: string;
}

// ---------------------------------------------------------------- escrituras

export interface DatosDeCobroNuevo {
  readonly sedeId: Id;
  readonly estudianteId?: Id;
  readonly medio: MedioDePago;
  readonly referencia?: string;
  /** Cargos elegidos y cuánto a cada uno. */
  readonly aplicaciones?: readonly { readonly cargoId: Id; readonly monto: Centavos }[];
  /** Sin aplicaciones: se reparte del cargo más antiguo al más nuevo. */
  readonly monto?: Centavos;
  readonly venta?: { readonly conceptoCodigo: string; readonly descripcion: string; readonly monto: Centavos; readonly cliente?: string };
  readonly nota?: string;
}

export interface CobroHecho {
  readonly pagoId: Id;
  readonly recibo: string;
  readonly monto: Centavos;
  readonly saldoPendiente: Centavos;
  readonly codigo: string | null;
  readonly repetida: boolean;
}

export interface DatosDeCierre {
  readonly sedeId: Id;
  readonly contado: Centavos;
  readonly retiro: Centavos;
  readonly observacion?: string;
  /** Solo en el primer arqueo de la sede. */
  readonly saldoInicial?: Centavos;
}

export interface CierreHecho {
  readonly numero: number;
  readonly esperado: Centavos;
  readonly contado: Centavos;
  readonly diferencia: Centavos;
  readonly queda: Centavos;
}

export type TipoAnulable = 'cobro' | 'cargo' | 'gasto';

export interface DatosDeCargoManual {
  readonly estudianteId: Id;
  readonly inscripcionId?: Id;
  readonly conceptoId: Id;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly venceEl?: string;
}

export interface DatosDeGasto {
  readonly sedeId: Id;
  readonly fecha?: string;
  readonly conceptoId: Id;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly medio: MedioDePago;
  readonly referencia?: string;
  readonly comprobante: 'factura' | 'recibo' | 'nota_de_venta' | 'sin_comprobante';
  readonly numeroComprobante?: string;
  readonly proveedor?: string;
}

// ---------------------------------------------------------------- puerto

/**
 * Cuántos alumnos devuelve `deudores` como mucho. Lo aplica el adaptador y lo
 * lee la pantalla para avisar que la lista se cortó: una sola cifra, así no
 * se desalinean.
 */
export const TOPE_DE_DEUDORES = 100;

export interface CajaPort {
  cuentaDeAlumno(estudianteId: Id): Promise<Resultado<CuentaDeAlumno | null>>;
  /** Como mucho `TOPE_DE_DEUDORES`, lo más vencido primero. */
  deudores(filtro: FiltroDeDeudores): Promise<Resultado<readonly Deudor[]>>;
  registrarCobro(clave: string, datos: DatosDeCobroNuevo): Promise<Resultado<CobroHecho>>;
  recibo(id: Id): Promise<Resultado<Recibo | null>>;
  recibos(sedeId?: Id): Promise<Resultado<readonly ReciboEnLista[]>>;
  cajaPorCerrar(sedeId: Id): Promise<Resultado<CajaPorCerrar>>;
  cerrarCaja(clave: string, datos: DatosDeCierre): Promise<Resultado<CierreHecho>>;
  arqueos(sedeId?: Id): Promise<Resultado<readonly Arqueo[]>>;
  anular(clave: string, tipo: TipoAnulable, id: Id, motivo: string): Promise<Resultado<void>>;
  crearCargo(clave: string, datos: DatosDeCargoManual): Promise<Resultado<void>>;
  registrarGasto(clave: string, datos: DatosDeGasto): Promise<Resultado<{ readonly numero: number }>>;
  conceptos(naturaleza: 'ingreso' | 'gasto'): Promise<Resultado<readonly ConceptoDeCaja[]>>;
  generarCuotasDeGrupo(clave: string, grupoId: Id): Promise<Resultado<{ readonly inscripciones: number; readonly cuotas: number }>>;
}
