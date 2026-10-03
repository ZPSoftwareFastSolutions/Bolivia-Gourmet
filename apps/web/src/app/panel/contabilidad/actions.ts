'use server';

/**
 * CAPA: Presentation / App — Server Actions de la contabilidad (panel interno).
 *
 * Registrar y anular un gasto. Van por la caja (`CajaPort` y sus casos de
 * uso) porque un gasto en efectivo sale del cajón y entra en su arqueo; aquí
 * solo se lee el formulario (monto con `parsearMonto`, en centavos enteros),
 * se vuelve a exigir sesión y permiso y, si sale bien, se lleva a la lista de
 * gastos del mes que corresponde con su confirmación.
 */

import { redirect } from 'next/navigation';
import type { TipoDeComprobante } from '@core/application/ports/inventario.port';
import { anular, registrarGasto } from '@core/application/panel/caja/caja.usecase';
import type { MedioDePago } from '@core/domain/caja/cobro';
import { tienePermiso, type ContextoDePanel, type Permiso } from '@core/domain/identidad/contexto-de-panel';
import { parsearMonto } from '@core/domain/shared/dinero';
import { fechaISO, type FechaISO, type Id } from '@core/domain/shared/tipos-base';
import { cajaRepository } from '@infra/config/composition-root';
import { RUTAS_CONTABILIDAD } from '@/lib/rutas';
import { campo, type EstadoDeFormulario } from '@/presentation/formularios/estado';
import { exigirPersonal } from '../_sesion';
import { enlaceContable } from './_componentes';

const SIN_SESION: EstadoDeFormulario = { estado: 'error', mensaje: 'No pudimos comprobar tu sesión. Vuelve a entrar e inténtalo otra vez.' };
const SIN_PERMISO: EstadoDeFormulario = { estado: 'error', mensaje: 'Esta acción la hace administración. Si la necesitas, pídesela.' };

const COMPROBANTES: readonly TipoDeComprobante[] = ['factura', 'recibo', 'nota_de_venta', 'sin_comprobante'];

type Acceso = { readonly ok: true; readonly ctx: ContextoDePanel } | { readonly ok: false; readonly bloqueo: EstadoDeFormulario };

/**
 * Como en la caja, pero devuelve el contexto: el gasto necesita la fecha de
 * negocio de la base (`hoy`) y las sedes en que se puede operar.
 */
async function conPermiso(...permisos: Permiso[]): Promise<Acceso> {
  const lectura = await exigirPersonal();
  if (lectura.estado !== 'ok') return { ok: false, bloqueo: SIN_SESION };
  const ctx = lectura.contexto;
  return permisos.every((p) => tienePermiso(ctx, p)) ? { ok: true, ctx } : { ok: false, bloqueo: SIN_PERMISO };
}

function errores(lista: readonly string[]): EstadoDeFormulario {
  return { estado: 'error', mensaje: lista.join(' ') };
}

function medio(texto: string): MedioDePago | null {
  return texto === 'efectivo' || texto === 'qr' || texto === 'transferencia' ? texto : null;
}

function opcional(texto: string): string | undefined {
  return texto.length > 0 ? texto : undefined;
}

function uno<T extends string>(lista: readonly T[], valor: string): T | null {
  return (lista as readonly string[]).includes(valor) ? (valor as T) : null;
}

/** Fecha opcional de un `<input type="date">`; vacío = undefined; texto inválido = null. */
function fechaOpcional(texto: string): FechaISO | undefined | null {
  if (texto === '') return undefined;
  const r = fechaISO(texto);
  return r.exito ? r.valor : null;
}

/** El mes de un campo oculto solo vuelve a la URL si tiene forma `AAAA-MM`. */
function mesValido(texto: string): string | undefined {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto) ? texto : undefined;
}

// ---------------------------------------------------------------- registrar

export async function registrarGastoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const acceso = await conPermiso('contabilidad.gestionar');
  if (!acceso.ok) return acceso.bloqueo;
  const ctx = acceso.ctx;

  const problemas: string[] = [];
  const sede = ctx.sedes.find((s) => s.id === campo(datos, 'sede'));
  if (!sede) problemas.push('Elige la sede donde se pagó.');
  const concepto = campo(datos, 'concepto');
  if (concepto === '') problemas.push('Elige el concepto del gasto.');
  const monto = parsearMonto(campo(datos, 'monto'));
  if (!monto.exito) problemas.push(monto.error);
  const elegido = medio(campo(datos, 'medio'));
  if (!elegido) problemas.push('Elige cómo pagaste: efectivo, QR o transferencia.');
  const fecha = fechaOpcional(campo(datos, 'fecha'));
  if (fecha === null) problemas.push('Revisa la fecha del pago.');
  // La base pide entre 2 y 120 letras: mejor decirlo aquí que mostrar un error técnico.
  const proveedor = opcional(campo(datos, 'proveedor'));
  if (proveedor !== undefined && proveedor.length < 2) problemas.push('Escribe el nombre del proveedor (al menos 2 letras) o déjalo vacío.');
  if (problemas.length > 0 || !sede || !monto.exito || !elegido || fecha === null) return errores(problemas);

  const r = await registrarGasto(
    await cajaRepository(),
    campo(datos, 'clave'),
    {
      sedeId: sede.id,
      fecha,
      conceptoId: concepto as Id,
      descripcion: campo(datos, 'descripcion'),
      monto: monto.valor,
      medio: elegido,
      referencia: elegido === 'efectivo' ? undefined : opcional(campo(datos, 'referencia')),
      comprobante: uno<TipoDeComprobante>(COMPROBANTES, campo(datos, 'comprobante')) ?? 'sin_comprobante',
      numeroComprobante: opcional(campo(datos, 'numeroComprobante')),
      proveedor,
    },
    ctx.hoy,
  );
  if (!r.exito) return errores(r.error);
  // Al mes del gasto: un pago por banco de fin de mes registrado días después
  // aparece en la lista del mes en que se pagó.
  redirect(enlaceContable(RUTAS_CONTABILIDAD.gastos, (fecha ?? ctx.hoy).slice(0, 7), undefined, { registrado: String(r.valor.numero) }));
}

// ---------------------------------------------------------------- anular

export async function anularGastoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const acceso = await conPermiso('caja.anular');
  if (!acceso.ok) return acceso.bloqueo;
  const ctx = acceso.ctx;
  const id = campo(datos, 'id');
  if (id === '') return errores(['Elige el gasto que se anula.']);
  const r = await anular(await cajaRepository(), campo(datos, 'clave'), 'gasto', id as Id, campo(datos, 'motivo'));
  if (!r.exito) return errores(r.error);
  // De vuelta a la misma vista (mes y sede) en que estaba la persona.
  const sede = ctx.sedes.find((s) => s.id === campo(datos, 'sede'))?.id;
  redirect(enlaceContable(RUTAS_CONTABILIDAD.gastos, mesValido(campo(datos, 'mes')), sede, { anulado: '1' }));
}
