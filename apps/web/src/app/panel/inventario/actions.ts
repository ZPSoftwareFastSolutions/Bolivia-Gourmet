'use server';

/**
 * CAPA: Presentation / App — Server Actions del inventario (panel interno).
 *
 * Cada acción vuelve a exigir sesión y permiso, lee el formulario (cantidades
 * con `parsearCantidad` en milésimas; montos con `parsearMonto` en centavos),
 * llama al caso de uso con el repositorio de ESTA petición y, si sale bien,
 * lleva a la página que lo confirma con la clave del formulario: la
 * confirmación se lee del propio libro («Harina: 25 kg → 20 kg»).
 */

import { redirect } from 'next/navigation';
import type { MedioDePago } from '@core/domain/caja/cobro';
import { tienePermiso, type Permiso } from '@core/domain/identidad/contexto-de-panel';
import { ICONOS_DE_ARTICULO, TIPOS_DE_ARTICULO, UNIDADES, type IconoDeArticulo, type TipoDeArticulo, type Unidad } from '@core/domain/inventario/articulo';
import type { DestinoDeUso, MotivoDeBaja } from '@core/domain/inventario/movimiento';
import { parsearCantidad, type Milesimas } from '@core/domain/shared/cantidad';
import { parsearMonto } from '@core/domain/shared/dinero';
import { fechaISO, type Centavos, type FechaISO, type Id } from '@core/domain/shared/tipos-base';
import type { ContextoDeEntrega, DocumentoAnulable, LineaContada, LineaDeCompra, LineaDeSaldoInicial, LineaDeUso, TipoDeComprobante } from '@core/application/ports/inventario.port';
import {
  agregarTalla,
  anularDocumento,
  crearArticulo,
  darDeBaja,
  devolverUniforme,
  editarArticulo,
  entregarUniforme,
  prestarUtensilios,
  recibirDevolucion,
  registrarCompra,
  registrarConteo,
  registrarSaldoInicial,
  usarInsumos,
} from '@core/application/panel/inventario/inventario.usecase';
import { alumnosRepository, inventarioRepository } from '@infra/config/composition-root';
import { RUTAS_INVENTARIO, rutaDeAlumno, rutaDeArticulo } from '@/lib/rutas';
import { campo, type EstadoDeFormulario } from '@/presentation/formularios/estado';
import { exigirPersonal } from '../_sesion';

const SIN_SESION: EstadoDeFormulario = { estado: 'error', mensaje: 'No pudimos comprobar tu sesión. Vuelve a entrar e inténtalo otra vez.' };
const SIN_PERMISO: EstadoDeFormulario = { estado: 'error', mensaje: 'Esta acción la hace administración. Si la necesitas, pídesela.' };

const DESTINOS: readonly DestinoDeUso[] = ['clase', 'practica', 'evento', 'degustacion', 'uso_interno', 'otro'];
const MOTIVOS: readonly MotivoDeBaja[] = ['vencimiento', 'dano', 'rotura', 'perdida', 'merma', 'otro'];
const COMPROBANTES: readonly TipoDeComprobante[] = ['factura', 'recibo', 'nota_de_venta', 'sin_comprobante'];
const DOCUMENTOS: readonly DocumentoAnulable[] = ['compra', 'uso', 'baja', 'saldo_inicial'];

async function conPermiso(...permisos: Permiso[]): Promise<EstadoDeFormulario | null> {
  const lectura = await exigirPersonal();
  if (lectura.estado !== 'ok') return SIN_SESION;
  return permisos.every((p) => tienePermiso(lectura.contexto, p)) ? null : SIN_PERMISO;
}

function errores(lista: readonly string[]): EstadoDeFormulario {
  return { estado: 'error', mensaje: lista.join(' ') };
}

function opcional(texto: string): string | undefined {
  return texto.length > 0 ? texto : undefined;
}

function medio(texto: string): MedioDePago | null {
  return texto === 'efectivo' || texto === 'qr' || texto === 'transferencia' ? texto : null;
}

function uno<T extends string>(lista: readonly T[], valor: string): T | null {
  return (lista as readonly string[]).includes(valor) ? (valor as T) : null;
}

/** Fecha opcional de un `<input type="date">`; texto inválido = null. */
function fechaOpcional(texto: string): FechaISO | undefined | null {
  if (texto === '') return undefined;
  const r = fechaISO(texto);
  return r.exito ? r.valor : null;
}

/** Cantidad escrita; vacío = sin línea (undefined); inválida = la frase del dominio. */
function cantidadDe(texto: string): { valor?: Milesimas; error?: string } {
  if (texto === '') return {};
  const r = parsearCantidad(texto);
  return r.exito ? { valor: r.valor } : { error: r.error };
}

/** Los ids de las filas que trae el formulario: `cantidad-<id>`, `contado-<id>`… */
function idsCon(datos: FormData, prefijo: string): Id[] {
  const ids: Id[] = [];
  for (const nombre of datos.keys()) {
    if (nombre.startsWith(prefijo) && !ids.includes(nombre.slice(prefijo.length) as Id)) ids.push(nombre.slice(prefijo.length) as Id);
  }
  return ids;
}

// ---------------------------------------------------------------- catálogo

function leerDatosDeArticulo(datos: FormData): { errores: string[]; minimo: Milesimas; precio?: Centavos } {
  const lista: string[] = [];
  const minimo = campo(datos, 'stockMinimo') === '' ? { valor: 0n as Milesimas } : cantidadDe(campo(datos, 'stockMinimo'));
  if (minimo.error) lista.push(`Avísame cuando queden menos de: ${minimo.error}`);
  let precio: Centavos | undefined;
  if (campo(datos, 'precioVenta') !== '') {
    const r = parsearMonto(campo(datos, 'precioVenta'));
    if (r.exito) precio = r.valor;
    else lista.push(`Precio: ${r.error}`);
  }
  return { errores: lista, minimo: minimo.valor ?? (0n as Milesimas), precio };
}

export async function crearArticuloAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.catalogo');
  if (bloqueo) return bloqueo;
  const tipo = uno<TipoDeArticulo>(TIPOS_DE_ARTICULO, campo(datos, 'tipo'));
  if (!tipo) return errores(['Elige qué tipo de artículo es.']);
  const unidad = uno<Unidad>(UNIDADES, campo(datos, 'unidad')) ?? 'unidad';
  const icono = uno<IconoDeArticulo>(ICONOS_DE_ARTICULO, campo(datos, 'icono')) ?? 'almacen';
  const leidos = leerDatosDeArticulo(datos);
  if (leidos.errores.length > 0) return errores(leidos.errores);
  const tallas = campo(datos, 'tallas')
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const r = await crearArticulo(
    await inventarioRepository(),
    campo(datos, 'clave'),
    {
      nombre: campo(datos, 'nombre'),
      tipo,
      unidad,
      categoria: opcional(campo(datos, 'categoria')),
      icono,
      controlaVencimiento: tipo === 'insumo' && campo(datos, 'controlaVencimiento') === 'si',
      stockMinimo: leidos.minimo,
      precioVenta: tipo === 'uniforme' ? leidos.precio : undefined,
    },
    tallas,
  );
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeArticulo(r.valor.codigo)}?nuevo=1`);
}

export async function editarArticuloAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.catalogo');
  if (bloqueo) return bloqueo;
  const tipo = uno<TipoDeArticulo>(TIPOS_DE_ARTICULO, campo(datos, 'tipo'));
  const unidad = uno<Unidad>(UNIDADES, campo(datos, 'unidad'));
  if (!tipo || !unidad) return errores(['Vuelve a abrir el artículo e inténtalo otra vez.']);
  const leidos = leerDatosDeArticulo(datos);
  if (leidos.errores.length > 0) return errores(leidos.errores);
  const r = await editarArticulo(
    await inventarioRepository(),
    campo(datos, 'id') as Id,
    { tipo, unidad },
    {
      nombre: campo(datos, 'nombre'),
      categoria: opcional(campo(datos, 'categoria')),
      icono: uno<IconoDeArticulo>(ICONOS_DE_ARTICULO, campo(datos, 'icono')) ?? 'almacen',
      stockMinimo: leidos.minimo,
      controlaVencimiento: tipo === 'insumo' && campo(datos, 'controlaVencimiento') === 'si',
      precioVenta: tipo === 'uniforme' ? leidos.precio : undefined,
      activo: campo(datos, 'activo') === 'si',
    },
  );
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeArticulo(campo(datos, 'codigo'))}?editado=1`);
}

export async function agregarTallaAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.catalogo');
  if (bloqueo) return bloqueo;
  const existentes = campo(datos, 'existentes').split('|').filter((t) => t.length > 0);
  const r = await agregarTalla(await inventarioRepository(), campo(datos, 'id') as Id, existentes, campo(datos, 'talla'));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeArticulo(campo(datos, 'codigo'))}?talla=1`);
}

// ---------------------------------------------------------------- usar en clase

export async function usarAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.operar');
  if (bloqueo) return bloqueo;
  const destino = uno<DestinoDeUso>(DESTINOS, campo(datos, 'destino'));
  if (!destino) return errores(['Elige para qué se usó.']);
  const lineas: LineaDeUso[] = [];
  const problemas: string[] = [];
  for (const id of idsCon(datos, 'cantidad-')) {
    const c = cantidadDe(campo(datos, `cantidad-${id}`));
    if (c.error) problemas.push(`${campo(datos, `nombre-${id}`) || 'Un insumo'}: ${c.error}`);
    else if (c.valor !== undefined && c.valor > 0n) lineas.push({ varianteId: id, cantidad: c.valor });
  }
  if (problemas.length > 0) return errores(problemas);
  const sede = campo(datos, 'sede') as Id;
  const clave = campo(datos, 'clave');
  const r = await usarInsumos(await inventarioRepository(), clave, {
    sedeId: sede,
    destino,
    grupoId: opcional(campo(datos, 'grupo')) as Id | undefined,
    detalle: opcional(campo(datos, 'detalle')),
    lineas,
  });
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_INVENTARIO.usar}?hecho=${clave}&sede=${sede}`);
}

// ---------------------------------------------------------------- baja

export async function bajaAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.operar');
  if (bloqueo) return bloqueo;
  const motivo = uno<MotivoDeBaja>(MOTIVOS, campo(datos, 'motivo'));
  if (!motivo) return errores(['Elige por qué sale del inventario.']);
  const c = cantidadDe(campo(datos, 'cantidad'));
  if (c.error || c.valor === undefined) return errores([c.error ?? 'Escribe cuánto sale del inventario.']);
  const clave = campo(datos, 'clave');
  const r = await darDeBaja(await inventarioRepository(), clave, {
    sedeId: campo(datos, 'sede') as Id,
    varianteId: campo(datos, 'variante') as Id,
    cantidad: c.valor,
    motivo,
    detalle: opcional(campo(datos, 'detalle')),
    loteId: opcional(campo(datos, 'lote')) as Id | undefined,
  });
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeArticulo(campo(datos, 'codigo'))}?hecho=${clave}`);
}

// ---------------------------------------------------------------- compra

export async function compraAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.comprar');
  if (bloqueo) return bloqueo;
  const elegido = medio(campo(datos, 'medio'));
  if (!elegido) return errores(['Elige cómo pagaste: efectivo, QR o transferencia.']);
  const comprobante = uno<TipoDeComprobante>(COMPROBANTES, campo(datos, 'comprobante')) ?? 'sin_comprobante';
  const fechaDocumento = fechaOpcional(campo(datos, 'fechaDocumento'));
  const problemas: string[] = [];
  if (fechaDocumento === null) problemas.push('Revisa la fecha de la nota.');

  const lineas: LineaDeCompra[] = [];
  const filas = Number.parseInt(campo(datos, 'filas'), 10);
  for (let i = 0; i < (Number.isFinite(filas) ? Math.min(filas, 30) : 0); i += 1) {
    const variante = campo(datos, `variante-${i}`);
    const textoCantidad = campo(datos, `cantidad-${i}`);
    const textoCosto = campo(datos, `costo-${i}`);
    if (variante === '' && textoCantidad === '' && textoCosto === '') continue;
    const n = `Fila ${i + 1}`;
    if (variante === '') {
      problemas.push(`${n}: elige el artículo.`);
      continue;
    }
    const c = cantidadDe(textoCantidad);
    if (c.error || c.valor === undefined) problemas.push(`${n}: ${c.error ?? 'escribe la cantidad.'}`);
    const costo = parsearMonto(textoCosto);
    if (!costo.exito) problemas.push(`${n}: escribe cuánto pagaste por esa línea.`);
    const vence = fechaOpcional(campo(datos, `vence-${i}`));
    if (vence === null) problemas.push(`${n}: revisa la fecha de vencimiento.`);
    if (c.valor !== undefined && costo.exito && vence !== null) {
      lineas.push({ varianteId: variante as Id, cantidad: c.valor, costoTotal: costo.valor, venceEl: vence });
    }
  }
  if (problemas.length > 0) return errores(problemas);
  const clave = campo(datos, 'clave');
  const r = await registrarCompra(await inventarioRepository(), clave, {
    sedeId: campo(datos, 'sede') as Id,
    fechaDocumento: fechaDocumento ?? undefined,
    proveedor: opcional(campo(datos, 'proveedor')),
    comprobante,
    numeroComprobante: opcional(campo(datos, 'numeroComprobante')),
    medio: elegido,
    referencia: opcional(campo(datos, 'referencia')),
    lineas,
  });
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_INVENTARIO.compra}?hecho=${clave}`);
}

// ---------------------------------------------------------------- conteo y saldo inicial

export async function contarAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.ajustar');
  if (bloqueo) return bloqueo;
  const lineas: (LineaContada & { nombre: string })[] = [];
  const problemas: string[] = [];
  for (const id of idsCon(datos, 'contado-')) {
    const nombre = campo(datos, `nombre-${id}`) || 'Un artículo';
    const contado = cantidadDe(campo(datos, `contado-${id}`));
    if (contado.error) {
      problemas.push(`${nombre}: ${contado.error}`);
      continue;
    }
    if (contado.valor === undefined) continue;
    const vista = cantidadDe(campo(datos, `vista-${id}`));
    let valor: Centavos | undefined;
    if (campo(datos, `valor-${id}`) !== '') {
      const v = parsearMonto(campo(datos, `valor-${id}`));
      if (v.exito) valor = v.valor;
      else problemas.push(`${nombre}: revisa el valor.`);
    }
    const vence = fechaOpcional(campo(datos, `vence-${id}`));
    if (vence === null) problemas.push(`${nombre}: revisa la fecha de vencimiento.`);
    lineas.push({
      varianteId: id,
      nombre,
      existenciaVista: vista.valor ?? (0n as Milesimas),
      contado: contado.valor,
      motivo: opcional(campo(datos, `motivo-${id}`)),
      valor,
      venceEl: vence ?? undefined,
    });
  }
  if (problemas.length > 0) return errores(problemas);
  const clave = campo(datos, 'clave');
  const sede = campo(datos, 'sede') as Id;
  const r = await registrarConteo(await inventarioRepository(), clave, sede, lineas);
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_INVENTARIO.contar}?hecho=${clave}&sede=${sede}&contadas=${lineas.length}&diferencias=${r.valor.diferencias}`);
}

export async function saldoInicialAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.ajustar');
  if (bloqueo) return bloqueo;
  const lineas: LineaDeSaldoInicial[] = [];
  const problemas: string[] = [];
  for (const id of idsCon(datos, 'cantidad-')) {
    const nombre = campo(datos, `nombre-${id}`) || 'Un artículo';
    const c = cantidadDe(campo(datos, `cantidad-${id}`));
    if (c.error) {
      problemas.push(`${nombre}: ${c.error}`);
      continue;
    }
    if (c.valor === undefined || c.valor === 0n) continue;
    const valor = parsearMonto(campo(datos, `valor-${id}`));
    if (!valor.exito) problemas.push(`${nombre}: escribe cuánto vale lo que hay (lo que costó).`);
    const vence = fechaOpcional(campo(datos, `vence-${id}`));
    if (vence === null) problemas.push(`${nombre}: revisa la fecha de vencimiento.`);
    if (valor.exito && vence !== null) lineas.push({ varianteId: id, cantidad: c.valor, valor: valor.valor, venceEl: vence });
  }
  if (problemas.length > 0) return errores(problemas);
  const clave = campo(datos, 'clave');
  const sede = campo(datos, 'sede') as Id;
  const r = await registrarSaldoInicial(await inventarioRepository(), clave, sede, lineas);
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_INVENTARIO.saldoInicial}?hecho=${clave}&sede=${sede}`);
}

// ---------------------------------------------------------------- anular

export async function anularAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.anular');
  if (bloqueo) return bloqueo;
  const tipo = uno<DocumentoAnulable>(DOCUMENTOS, campo(datos, 'tipo'));
  if (!tipo) return errores(['Vuelve al historial y elige qué anular.']);
  const r = await anularDocumento(await inventarioRepository(), campo(datos, 'clave'), tipo, campo(datos, 'id') as Id, campo(datos, 'motivo'));
  if (!r.exito) return errores(r.error);
  const volver = campo(datos, 'volver');
  redirect(`${volver.startsWith(`${RUTAS_INVENTARIO.inicio}/`) || volver === RUTAS_INVENTARIO.inicio ? volver : RUTAS_INVENTARIO.historial}?anulado=${tipo}`);
}

// ---------------------------------------------------------------- uniformes y préstamos (R5)

const CONTEXTOS: readonly ContextoDeEntrega[] = ['inscripcion', 'reposicion', 'otro'];

/** Piezas escritas: vacío = `vacio`; texto que no es un entero ≥ 0 = NaN. */
function piezas(texto: string, vacio = 0): number {
  if (texto === '') return vacio;
  return /^\d{1,4}$/.test(texto) ? Number.parseInt(texto, 10) : Number.NaN;
}

export async function entregarAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.operar');
  if (bloqueo) return bloqueo;
  const variante = campo(datos, 'variante');
  if (variante === '') return errores(['Elige la talla.']);
  const cantidad = piezas(campo(datos, 'cantidad'), 1);
  if (Number.isNaN(cantidad)) return errores(['Se entregan piezas enteras: 1, 2, 3…']);
  const cargar = campo(datos, 'cargar') === 'si';
  const elegido = medio(campo(datos, 'cobro'));
  if (cargar && campo(datos, 'cobro') === '') return errores(['Elige si se cobra ahora (y cómo) o si queda pendiente.']);
  const clave = campo(datos, 'clave');
  const r = await entregarUniforme(await inventarioRepository(), clave, {
    inscripcionId: campo(datos, 'inscripcion') as Id,
    sedeId: campo(datos, 'sede') as Id,
    contexto: uno<ContextoDeEntrega>(CONTEXTOS, campo(datos, 'contexto')) ?? 'inscripcion',
    detalle: opcional(campo(datos, 'detalle')),
    lineas: [{ varianteId: variante as Id, cantidad }],
    cargar,
    cobro: cargar && elegido ? { medio: elegido, referencia: opcional(campo(datos, 'referencia')) } : undefined,
  });
  if (!r.exito) return errores(r.error);
  const alumno = encodeURIComponent(campo(datos, 'alumno'));
  redirect(`${RUTAS_INVENTARIO.entregar}?hecho=${clave}&alumno=${alumno}${r.valor.pagoId ? `&pago=${r.valor.pagoId}` : ''}${r.valor.cargado > 0 ? `&cargado=${r.valor.cargado}` : ''}`);
}

export async function devolverUniformeAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.operar');
  if (bloqueo) return bloqueo;
  const cantidad = piezas(campo(datos, 'cantidad'), 1);
  if (Number.isNaN(cantidad)) return errores(['Escribe cuántas piezas vuelven: 1, 2, 3…']);
  const clave = campo(datos, 'clave');
  const r = await devolverUniforme(await inventarioRepository(), clave, {
    entregaId: campo(datos, 'entrega') as Id,
    cantidad,
    motivo: campo(datos, 'motivo'),
    cambiarPor: opcional(campo(datos, 'cambiarPor')) as Id | undefined,
  });
  if (!r.exito) return errores(r.error);
  // Qué pasó con el cargo, para la confirmación (enmiendas B.12, crítica 14).
  // No `cargo=`: la ficha ya lo usa para «Se anuló el cargo» de la caja.
  const cargo = r.valor.cargo;
  redirect(`${rutaDeAlumno(campo(datos, 'alumno'))}?uniforme=${clave}${cargo ? `&cargouniforme=${cargo.estado}&montouniforme=${cargo.monto}` : ''}`);
}

export async function prestarAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.operar');
  if (bloqueo) return bloqueo;
  const destino = campo(datos, 'destino');
  let estudianteId: Id | undefined;
  if (destino === 'alumno') {
    const codigo = campo(datos, 'alumno').toUpperCase();
    if (codigo === '') return errores(['Escribe el código del alumno (por ejemplo BG-2026-0001).']);
    const ficha = await (await alumnosRepository()).fichaDeAlumno(codigo);
    if (!ficha.exito) return errores([ficha.error]);
    if (!ficha.valor) return errores([`No encontramos al alumno ${codigo}. Revisa el código en su ficha.`]);
    estudianteId = ficha.valor.id;
  }
  const devolverEl = fechaOpcional(campo(datos, 'devolverEl'));
  if (devolverEl === null) return errores(['Revisa la fecha de devolución.']);
  const lineas: { varianteId: Id; cantidad: number }[] = [];
  const problemas: string[] = [];
  for (const id of idsCon(datos, 'cantidad-')) {
    const n = piezas(campo(datos, `cantidad-${id}`));
    if (Number.isNaN(n)) problemas.push(`${campo(datos, `nombre-${id}`) || 'Un utensilio'}: solo piezas enteras.`);
    else if (n > 0) lineas.push({ varianteId: id, cantidad: n });
  }
  if (problemas.length > 0) return errores(problemas);
  const clave = campo(datos, 'clave');
  const r = await prestarUtensilios(await inventarioRepository(), clave, {
    sedeId: campo(datos, 'sede') as Id,
    estudianteId,
    grupoId: destino === 'grupo' ? (opcional(campo(datos, 'grupo')) as Id | undefined) : undefined,
    persona: destino === 'persona' ? campo(datos, 'persona') : undefined,
    devolverEl,
    lineas,
  });
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_INVENTARIO.prestar}?hecho=${clave}`);
}

export async function recibirPrestamoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('inventario.operar');
  if (bloqueo) return bloqueo;
  const devueltos = piezas(campo(datos, 'devueltos'));
  const perdidos = piezas(campo(datos, 'perdidos'));
  if (Number.isNaN(devueltos) || Number.isNaN(perdidos)) return errores(['Escribe piezas enteras: 0, 1, 2…']);
  const clave = campo(datos, 'clave');
  const r = await recibirDevolucion(await inventarioRepository(), clave, [
    {
      prestamoId: campo(datos, 'prestamo') as Id,
      nombre: campo(datos, 'nombre') || 'El préstamo',
      devueltos,
      perdidos,
      motivoBaja: campo(datos, 'motivoBaja') === 'rotura' ? 'rotura' : 'perdida',
      motivo: opcional(campo(datos, 'motivo')),
    },
  ]);
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_INVENTARIO.prestamos}?recibido=${clave}`);
}
