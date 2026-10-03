/**
 * CAPA: Application / Panel · Inventario
 *
 * Casos de uso del inventario (especificación §6.1–6.8): revisan la forma con
 * el dominio (artículo y variantes, cantidades, referencias de pago) y llaman
 * al puerto; la base decide lo que depende de datos (lo que hay, de qué lote
 * sale, el costo). Devuelven todas las frases juntas, en lenguaje simple.
 */

import { validarArticulo, validarVariantes, type TipoDeArticulo } from '../../../domain/inventario/articulo';
import type { MotivoDeBaja } from '../../../domain/inventario/movimiento';
import { exigeReferencia } from '../../../domain/caja/cobro';
import { fallo, type Id, type Resultado } from '../../../domain/shared/tipos-base';
import type {
  CambiosDeArticulo,
  DatosDeArticuloNuevo,
  DatosDeBaja,
  DatosDeCompra,
  DatosDeUso,
  DocumentoAnulable,
  InventarioPort,
  LineaContada,
  LineaDeSaldoInicial,
} from '../../ports/inventario.port';

type Res<T> = Promise<Resultado<T, readonly string[]>>;

/** Las notas de compra y los conteos llegan por línea; 30 por vez (como la base). */
export const MAXIMO_DE_LINEAS = 30;

function comoLista<T>(r: Resultado<T>): Resultado<T, readonly string[]> {
  return r.exito ? r : fallo([r.error]);
}

function sinRepetir(ids: readonly Id[]): boolean {
  return new Set(ids).size === ids.length;
}

function opcionalLimpio(texto: string | undefined): string | undefined {
  const limpio = texto?.trim().replace(/\s+/g, ' ');
  return limpio && limpio.length > 0 ? limpio : undefined;
}

// ---------------------------------------------------------------- catálogo

/** Alta de un artículo (administración): forma del dominio y tallas. */
export async function crearArticulo(
  port: InventarioPort,
  clave: string,
  datos: DatosDeArticuloNuevo,
  variantes: readonly string[],
): Res<{ readonly codigo: string }> {
  const errores: string[] = [];
  const articulo = validarArticulo({ ...datos, categoria: opcionalLimpio(datos.categoria), activo: true });
  if (!articulo.exito) errores.push(...articulo.error);
  const tallas = validarVariantes(datos.tipo, datos.tipo === 'uniforme' ? variantes : []);
  if (!tallas.exito) errores.push(...tallas.error);
  if (errores.length > 0 || !articulo.exito || !tallas.exito) return fallo(errores);
  const { activo: _activo, ...limpio } = articulo.valor;
  return comoLista(await port.guardarArticulo(clave, limpio, tallas.valor));
}

/** Editar nombre, mínimo, icono, precio o desactivar. El tipo y la unidad no se tocan aquí. */
export async function editarArticulo(
  port: InventarioPort,
  id: Id,
  actual: { readonly tipo: TipoDeArticulo; readonly unidad: DatosDeArticuloNuevo['unidad'] },
  cambios: CambiosDeArticulo,
): Res<void> {
  const r = validarArticulo({ ...cambios, tipo: actual.tipo, unidad: actual.unidad, categoria: opcionalLimpio(cambios.categoria) });
  if (!r.exito) return fallo(r.error);
  return comoLista(await port.editarArticulo(id, { ...cambios, nombre: r.valor.nombre, categoria: r.valor.categoria }));
}

/** Una talla nueva para un uniforme que ya existe. */
export async function agregarTalla(port: InventarioPort, articuloId: Id, existentes: readonly string[], etiqueta: string): Res<void> {
  const limpia = etiqueta.trim();
  if (limpia.length === 0) return fallo(['Escribe la talla nueva.']);
  const r = validarVariantes('uniforme', [...existentes, limpia]);
  if (!r.exito) return fallo(r.error.map((e) => (e === 'Hay variantes repetidas.' ? 'Esa talla ya existe.' : e)));
  return comoLista(await port.agregarVariante(articuloId, limpia, existentes.length + 1));
}

// ---------------------------------------------------------------- puesta en marcha

/** Saldo inicial (§6.18): lo que hay en el estante y cuánto vale, una sola vez por artículo y sede. */
export async function registrarSaldoInicial(port: InventarioPort, clave: string, sedeId: Id, lineas: readonly LineaDeSaldoInicial[]): Res<void> {
  const errores: string[] = [];
  if (lineas.length === 0) errores.push('Escribe al menos un artículo con su cantidad.');
  if (lineas.length > MAXIMO_DE_LINEAS * 4) errores.push('Son demasiados artículos de una vez: guárdalos por partes.');
  if (lineas.some((l) => l.cantidad <= 0n)) errores.push('Cada cantidad debe ser mayor que cero.');
  if (lineas.some((l) => !Number.isSafeInteger(l.valor) || l.valor < 0)) errores.push('Revisa los valores: solo números con hasta dos decimales.');
  if (!sinRepetir(lineas.map((l) => l.varianteId))) errores.push('Un artículo aparece dos veces.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(await port.registrarSaldoInicial(clave, sedeId, lineas));
}

// ---------------------------------------------------------------- compra

/** Registrar una compra (§6.1): líneas de la nota, cómo se pagó y el número de operación si no fue efectivo. */
export async function registrarCompra(port: InventarioPort, clave: string, datos: DatosDeCompra): Res<void> {
  const errores: string[] = [];
  if (datos.lineas.length === 0) errores.push('Agrega al menos un artículo con su cantidad y lo que pagaste.');
  if (datos.lineas.length > MAXIMO_DE_LINEAS) errores.push(`Son demasiados artículos para una sola nota: hasta ${MAXIMO_DE_LINEAS}.`);
  if (datos.lineas.some((l) => l.cantidad <= 0n)) errores.push('Cada cantidad debe ser mayor que cero.');
  if (datos.lineas.some((l) => !Number.isSafeInteger(l.costoTotal) || l.costoTotal <= 0)) errores.push('Escribe cuánto pagaste por cada línea.');
  const referencia = opcionalLimpio(datos.referencia);
  if (exigeReferencia(datos.medio) && (!referencia || referencia.length < 3)) {
    errores.push('Escribe el número de operación del QR o de la transferencia.');
  }
  const proveedor = opcionalLimpio(datos.proveedor);
  if (proveedor && proveedor.length < 2) errores.push('El nombre del proveedor es muy corto.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(
    await port.registrarCompra(clave, {
      ...datos,
      proveedor,
      referencia: exigeReferencia(datos.medio) ? referencia : undefined,
      numeroComprobante: datos.comprobante === 'sin_comprobante' ? undefined : opcionalLimpio(datos.numeroComprobante),
    }),
  );
}

// ---------------------------------------------------------------- uso en clase

/** Usar insumos (§6.2): para qué y cuánto de cada uno. PEPS lo resuelve la base. */
export async function usarInsumos(port: InventarioPort, clave: string, datos: DatosDeUso): Res<void> {
  const errores: string[] = [];
  const detalle = opcionalLimpio(datos.detalle);
  if (datos.lineas.length === 0) errores.push('Escribe cuánto usaste de al menos un insumo.');
  if (datos.lineas.some((l) => l.cantidad <= 0n)) errores.push('Cada cantidad debe ser mayor que cero.');
  if (datos.destino === 'clase' && !datos.grupoId) errores.push('Elige el grupo de la clase.');
  if (datos.destino === 'otro' && (!detalle || detalle.length < 3)) errores.push('Escribe para qué se usó.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(await port.usarInsumos(clave, { ...datos, detalle }));
}

// ---------------------------------------------------------------- baja

/** Motivos que exigen una frase: todos menos el vencimiento (el lote ya lo dice). */
export function bajaPideExplicacion(motivo: MotivoDeBaja): boolean {
  return motivo !== 'vencimiento';
}

/** Dar de baja (§6.7): motivo, cantidad y explicación; lo vencido, por su lote. */
export async function darDeBaja(port: InventarioPort, clave: string, datos: DatosDeBaja): Res<void> {
  const errores: string[] = [];
  const detalle = opcionalLimpio(datos.detalle);
  if (datos.cantidad <= 0n) errores.push('Escribe cuánto sale del inventario.');
  if (datos.motivo === 'vencimiento' && !datos.loteId) errores.push('Elige la compra vencida.');
  if (bajaPideExplicacion(datos.motivo) && (!detalle || detalle.length < 3)) errores.push('Explica en una frase qué pasó.');
  if (errores.length > 0) return fallo(errores);
  return comoLista(await port.darDeBaja(clave, { ...datos, detalle, loteId: datos.motivo === 'vencimiento' ? datos.loteId : undefined }));
}

// ---------------------------------------------------------------- conteo

export function hayDiferencia(linea: Pick<LineaContada, 'existenciaVista' | 'contado'>): boolean {
  return linea.contado !== linea.existenciaVista;
}

/** Contar (§6.8): solo las filas contadas; cada diferencia, con su motivo. */
export async function registrarConteo(
  port: InventarioPort,
  clave: string,
  sedeId: Id,
  lineas: readonly (LineaContada & { readonly nombre: string })[],
): Res<{ readonly diferencias: number }> {
  const errores: string[] = [];
  if (lineas.length === 0) errores.push('Escribe lo que contaste en al menos una fila.');
  if (lineas.some((l) => l.contado < 0n)) errores.push('Lo contado no puede ser negativo.');
  for (const l of lineas) {
    if (hayDiferencia(l) && (opcionalLimpio(l.motivo)?.length ?? 0) < 3) errores.push(`${l.nombre}: escribe por qué no coincide.`);
  }
  if (errores.length > 0) return fallo(errores);
  return comoLista(
    await port.registrarConteo(
      clave,
      sedeId,
      lineas.map(({ nombre: _nombre, ...l }) => ({ ...l, motivo: opcionalLimpio(l.motivo) })),
    ),
  );
}

// ---------------------------------------------------------------- anular

/** Anular una compra, un uso, una baja o un saldo inicial (administración, con motivo). */
export async function anularDocumento(port: InventarioPort, clave: string, tipo: DocumentoAnulable, id: Id, motivo: string): Res<void> {
  const limpio = motivo.trim();
  if (limpio.length < 3) return fallo(['Escribe el motivo de la anulación: queda registrado.']);
  return comoLista(await port.anular(clave, tipo, id, limpio));
}
