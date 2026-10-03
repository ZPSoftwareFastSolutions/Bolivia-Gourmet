/**
 * CAPA: Application / Ports
 *
 * Inventario del panel interno (especificación §3.6, §6.1–6.8 y §7.5):
 * existencias por sede, ficha del artículo con sus lotes, kárdex en frases y
 * las operaciones del motor (compra, uso en clase, baja, conteo, saldo
 * inicial, anulación). Las cantidades viajan en milésimas enteras y los
 * valores en centavos: nada de coma flotante. El costo solo llega a quien
 * puede verlo (la base lo decide con RLS; aquí se pide o no).
 */

import type { IconoDeArticulo, TipoDeArticulo } from '@core/domain/inventario/articulo';
import type { DestinoDeUso, MotivoDeBaja, TipoDeMovimiento } from '@core/domain/inventario/movimiento';
import type { MedioDePago } from '@core/domain/caja/cobro';
import type { Milesimas, Unidad } from '@core/domain/shared/cantidad';
import type { Centavos, FechaISO, Id, Resultado } from '@core/domain/shared/tipos-base';

// ---------------------------------------------------------------- lecturas

export type EstadoDeExistencia = 'agotado' | 'bajo' | 'bien';

/** Saldo de una variante en una sede. */
export interface ExistenciaEnSede {
  readonly sedeId: Id;
  readonly sedeNombre: string;
  /** En el estante (incluye lo vencido, que no se usa). */
  readonly disponible: Milesimas;
  readonly prestado: Milesimas;
  readonly total: Milesimas;
  readonly vencido: Milesimas;
  readonly proximoVencimiento: FechaISO | null;
  readonly estado: EstadoDeExistencia;
  /** Solo con costos (administración). */
  readonly valor: Centavos | null;
}

export interface VarianteConExistencias {
  readonly id: Id;
  /** «Única», «S», «M»… */
  readonly etiqueta: string;
  readonly orden: number;
  readonly sedes: readonly ExistenciaEnSede[];
}

export interface ArticuloConExistencias {
  readonly id: Id;
  readonly codigo: string;
  readonly nombre: string;
  readonly tipo: TipoDeArticulo;
  readonly valuacion: 'peps' | 'promedio';
  readonly icono: IconoDeArticulo;
  readonly categoria: string | null;
  readonly unidad: Unidad;
  readonly controlaVencimiento: boolean;
  readonly stockMinimo: Milesimas;
  readonly precioVenta: Centavos | null;
  readonly activo: boolean;
  readonly variantes: readonly VarianteConExistencias[];
}

export interface FiltroDeExistencias {
  readonly tipo?: TipoDeArticulo;
  readonly tipos?: readonly TipoDeArticulo[];
  readonly incluirInactivos?: boolean;
  /** Pedir el valor (solo administración lo recibe). */
  readonly conValor?: boolean;
}

export type EstadoDeLote = 'vencido' | 'por_vencer' | 'bien' | 'sin_vencimiento';

/** «La compra del 05/09»: lo que queda de una entrada de insumo. */
export interface LoteVigente {
  readonly id: Id;
  readonly varianteId: Id;
  readonly articuloId: Id;
  readonly articuloNombre: string;
  readonly unidad: Unidad;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly origen: 'compra' | 'saldo_inicial' | 'sobrante';
  readonly fechaIngreso: FechaISO;
  readonly venceEl: FechaISO | null;
  readonly cantidadInicial: Milesimas;
  readonly cantidadRestante: Milesimas;
  readonly diasParaVencer: number | null;
  readonly estado: EstadoDeLote;
}

export interface FichaDeArticulo extends ArticuloConExistencias {
  /** Insumos: lotes con saldo, en orden PEPS. */
  readonly lotes: readonly LoteVigente[];
}

/** Una fila del kárdex en frases. */
export interface MovimientoEnKardex {
  readonly id: Id;
  readonly numero: number;
  readonly operacionId: Id;
  readonly varianteId: Id;
  readonly articuloId: Id;
  readonly articuloNombre: string;
  readonly unidad: Unidad;
  readonly etiqueta: string;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly tipo: TipoDeMovimiento;
  readonly fecha: FechaISO;
  readonly registradoEn: string;
  readonly entra: Milesimas;
  readonly sale: Milesimas;
  readonly deltaDisponible: Milesimas;
  readonly disponibleResultante: Milesimas;
  readonly prestadoResultante: Milesimas;
  readonly destino: DestinoDeUso | null;
  readonly motivoBaja: MotivoDeBaja | null;
  readonly detalle: string | null;
  readonly grupoNombre: string | null;
  readonly compraId: Id | null;
  readonly prestamoId: Id | null;
  readonly anulaA: Id | null;
  readonly anulado: boolean;
  readonly quien: string;
  /** Solo con costos. */
  readonly deltaValor: Centavos | null;
  readonly valorResultante: Centavos | null;
}

export interface FiltroDeKardex {
  readonly articuloId?: Id;
  readonly sedeId?: Id;
  readonly operacionId?: Id;
  readonly compraId?: Id;
  readonly movimientoId?: Id;
  /** Solo estos tipos (vacío o ausente = todos): «Revisar bajas» pide bajas y faltantes. */
  readonly tipos?: readonly TipoDeMovimiento[];
  readonly limite?: number;
  /** Saltar las primeras N filas (para leer por páginas: la API corta en 1000). */
  readonly desde?: number;
  readonly conValor?: boolean;
}

/** Grupo en el que se puede registrar el uso de insumos. */
export interface GrupoParaUso {
  readonly id: Id;
  readonly nombre: string;
}

// ---------------------------------------------------------------- escrituras

export interface DatosDeArticuloNuevo {
  readonly nombre: string;
  readonly tipo: TipoDeArticulo;
  readonly unidad: Unidad;
  readonly categoria?: string;
  readonly icono: IconoDeArticulo;
  readonly controlaVencimiento: boolean;
  readonly stockMinimo: Milesimas;
  readonly precioVenta?: Centavos;
}

export interface CambiosDeArticulo {
  readonly nombre: string;
  readonly categoria?: string;
  readonly icono: IconoDeArticulo;
  readonly stockMinimo: Milesimas;
  readonly controlaVencimiento: boolean;
  readonly precioVenta?: Centavos;
  readonly activo: boolean;
}

export interface LineaDeSaldoInicial {
  readonly varianteId: Id;
  readonly cantidad: Milesimas;
  readonly valor: Centavos;
  readonly venceEl?: FechaISO;
}

export type TipoDeComprobante = 'factura' | 'recibo' | 'nota_de_venta' | 'sin_comprobante';

export interface LineaDeCompra {
  readonly varianteId: Id;
  readonly cantidad: Milesimas;
  /** Lo que se pagó por la línea, tal cual la nota. */
  readonly costoTotal: Centavos;
  readonly venceEl?: FechaISO;
}

export interface DatosDeCompra {
  readonly sedeId: Id;
  readonly fechaDocumento?: FechaISO;
  readonly proveedor?: string;
  readonly comprobante: TipoDeComprobante;
  readonly numeroComprobante?: string;
  readonly medio: MedioDePago;
  readonly referencia?: string;
  readonly lineas: readonly LineaDeCompra[];
}

export interface LineaDeUso {
  readonly varianteId: Id;
  readonly cantidad: Milesimas;
}

export interface DatosDeUso {
  readonly sedeId: Id;
  readonly destino: DestinoDeUso;
  readonly grupoId?: Id;
  readonly detalle?: string;
  readonly lineas: readonly LineaDeUso[];
}

export interface DatosDeBaja {
  readonly sedeId: Id;
  readonly varianteId: Id;
  readonly cantidad: Milesimas;
  readonly motivo: MotivoDeBaja;
  readonly detalle?: string;
  readonly loteId?: Id;
}

export interface LineaContada {
  readonly varianteId: Id;
  /** Lo que mostraba el sistema cuando se abrió el conteo. */
  readonly existenciaVista: Milesimas;
  readonly contado: Milesimas;
  readonly motivo?: string;
  /** Solo si sobra algo que nunca tuvo compras. */
  readonly valor?: Centavos;
  readonly venceEl?: FechaISO;
}

export type DocumentoAnulable = 'compra' | 'uso' | 'baja' | 'saldo_inicial';

// ---------------------------------------------------------------- uniformes y préstamos (R5)

export type ContextoDeEntrega = 'inscripcion' | 'reposicion' | 'cambio_de_talla' | 'otro';

/** Un uniforme entregado a un alumno (lo que tiene en su poder = cantidad − devuelta). */
export interface EntregaDeUniforme {
  readonly id: Id;
  readonly numero: number;
  readonly inscripcionId: Id;
  readonly estudianteId: Id;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly varianteId: Id;
  readonly articuloId: Id;
  readonly articuloCodigo: string;
  readonly articuloNombre: string;
  readonly etiqueta: string;
  readonly cantidad: number;
  readonly devuelta: number;
  readonly enPoder: number;
  readonly contexto: ContextoDeEntrega;
  readonly detalle: string | null;
  readonly fecha: FechaISO;
}

export interface PrestamoAbierto {
  readonly id: Id;
  readonly numero: number;
  readonly operacionId: Id;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly varianteId: Id;
  readonly articuloCodigo: string;
  readonly articuloNombre: string;
  readonly icono: IconoDeArticulo;
  readonly cantidad: number;
  readonly devuelta: number;
  readonly perdida: number;
  readonly pendiente: number;
  readonly estudianteId: Id | null;
  readonly estudianteCodigo: string | null;
  readonly telefono: string | null;
  readonly grupoNombre: string | null;
  readonly persona: string | null;
  /** «Ana Pérez», el nombre del grupo o la persona. */
  readonly destinatario: string;
  readonly fecha: FechaISO;
  readonly devolverEl: FechaISO;
  readonly diasDeAtraso: number;
  readonly atrasado: boolean;
}

/** Alumno de la carrera con inscripción vigente y sin uniforme en su poder. */
export interface AlumnoSinUniforme {
  readonly inscripcionId: Id;
  readonly estudianteId: Id;
  readonly codigo: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly telefono: string | null;
  readonly sedeId: Id;
  readonly sedeNombre: string;
  readonly grupoNombre: string;
  readonly inscritoEl: FechaISO;
}

export interface DatosDeEntrega {
  readonly inscripcionId: Id;
  readonly sedeId: Id;
  readonly contexto: ContextoDeEntrega;
  readonly detalle?: string;
  readonly lineas: readonly { readonly varianteId: Id; readonly cantidad: number }[];
  /** Cargar «Venta de uniforme» a su cuenta. */
  readonly cargar: boolean;
  /** Cobrar en el acto (exige cargar). */
  readonly cobro?: { readonly medio: MedioDePago; readonly referencia?: string };
}

export interface EntregaHecha {
  readonly codigo: string;
  readonly cargado: Centavos;
  readonly pagoId: Id | null;
  readonly recibo: string | null;
}

export interface DatosDeDevolucion {
  readonly entregaId: Id;
  readonly cantidad: number;
  readonly motivo: string;
  /** Otra talla del mismo uniforme: cambio de talla, sin cargo. */
  readonly cambiarPor?: Id;
}

/**
 * Qué pasó con el cargo del uniforme al recibir la devolución (enmiendas
 * B.12, crítica 14), según la base. El cargo es de la entrega original y
 * cubre también las tallas por las que se cambió, así que «todo» cuenta las
 * piezas de toda esa cadena, se devuelvan desde la fila que se devuelvan:
 * - `anulado`: volvió todo y el cargo no tenía cobros; la base lo anuló.
 * - `cobrado`: volvió todo, pero ya se había cobrado; el cargo sigue y
 *   administración tiene que anular el cobro y después el cargo.
 * - `parcial`: todavía le queda alguna pieza; el cargo sigue igual.
 */
export type EstadoDelCargoDevuelto = 'anulado' | 'cobrado' | 'parcial';

export interface CargoDeLaDevolucion {
  readonly cargoId: Id;
  readonly monto: Centavos;
  readonly estado: EstadoDelCargoDevuelto;
}

export interface DevolucionHecha {
  /** null: la entrega original no tenía cargo vigente, o fue un cambio de talla (no toca el cargo). */
  readonly cargo: CargoDeLaDevolucion | null;
}

export interface DatosDePrestamo {
  readonly sedeId: Id;
  readonly estudianteId?: Id;
  readonly grupoId?: Id;
  readonly persona?: string;
  readonly devolverEl?: FechaISO;
  readonly lineas: readonly { readonly varianteId: Id; readonly cantidad: number }[];
}

export interface LineaRecibida {
  readonly prestamoId: Id;
  readonly devueltos: number;
  readonly perdidos: number;
  readonly motivoBaja?: 'perdida' | 'rotura';
  readonly motivo?: string;
}

// ---------------------------------------------------------------- puerto

export interface InventarioPort {
  existencias(filtro: FiltroDeExistencias): Promise<Resultado<readonly ArticuloConExistencias[]>>;
  fichaDeArticulo(codigo: string, conValor: boolean): Promise<Resultado<FichaDeArticulo | null>>;
  lotesConAlerta(sedeId?: Id): Promise<Resultado<readonly LoteVigente[]>>;
  kardex(filtro: FiltroDeKardex): Promise<Resultado<readonly MovimientoEnKardex[]>>;
  gruposParaUso(sedeId: Id): Promise<Resultado<readonly GrupoParaUso[]>>;
  /** Variantes que ya tienen movimientos en la sede (no admiten saldo inicial). */
  variantesConMovimientos(sedeId: Id): Promise<Resultado<ReadonlySet<Id>>>;

  guardarArticulo(clave: string, datos: DatosDeArticuloNuevo, variantes: readonly string[]): Promise<Resultado<{ readonly codigo: string }>>;
  editarArticulo(id: Id, cambios: CambiosDeArticulo): Promise<Resultado<void>>;
  agregarVariante(articuloId: Id, etiqueta: string, orden: number): Promise<Resultado<void>>;
  registrarSaldoInicial(clave: string, sedeId: Id, lineas: readonly LineaDeSaldoInicial[]): Promise<Resultado<void>>;
  registrarCompra(clave: string, datos: DatosDeCompra): Promise<Resultado<void>>;
  usarInsumos(clave: string, datos: DatosDeUso): Promise<Resultado<void>>;
  darDeBaja(clave: string, datos: DatosDeBaja): Promise<Resultado<void>>;
  registrarConteo(clave: string, sedeId: Id, lineas: readonly LineaContada[]): Promise<Resultado<{ readonly diferencias: number }>>;
  anular(clave: string, tipo: DocumentoAnulable, id: Id, motivo: string): Promise<Resultado<void>>;

  entregas(estudianteId: Id): Promise<Resultado<readonly EntregaDeUniforme[]>>;
  prestamosAbiertos(filtro: { readonly sedeId?: Id; readonly estudianteId?: Id }): Promise<Resultado<readonly PrestamoAbierto[]>>;
  sinUniforme(sedeId?: Id): Promise<Resultado<readonly AlumnoSinUniforme[]>>;
  entregarUniforme(clave: string, datos: DatosDeEntrega): Promise<Resultado<EntregaHecha>>;
  devolverUniforme(clave: string, datos: DatosDeDevolucion): Promise<Resultado<DevolucionHecha>>;
  prestarUtensilios(clave: string, datos: DatosDePrestamo): Promise<Resultado<void>>;
  recibirDevolucion(clave: string, lineas: readonly LineaRecibida[]): Promise<Resultado<{ readonly perdidos: number }>>;
}
