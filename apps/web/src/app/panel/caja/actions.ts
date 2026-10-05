'use server';

/**
 * CAPA: Presentation / App — Server Actions de la caja (panel interno).
 *
 * Cada acción vuelve a exigir sesión y permiso, lee el formulario (montos con
 * `parsearMonto`, en centavos enteros), llama al caso de uso con el
 * repositorio de ESTA petición y, si sale bien, lleva a la página que lo
 * confirma (el recibo con «¡Cobrado!», el arqueo cerrado…).
 */

import { redirect } from 'next/navigation';
import type { MedioDePago } from '@core/domain/caja/cobro';
import { tienePermiso, type Permiso } from '@core/domain/identidad/contexto-de-panel';
import { parsearMonto } from '@core/domain/shared/dinero';
import type { Centavos, Id } from '@core/domain/shared/tipos-base';
import { anular, aplicacionesElegidas, cerrarCaja, cobrar, crearCargoManual, revisarArqueo } from '@core/application/panel/caja/caja.usecase';
import { cajaRepository } from '@infra/config/composition-root';
import { RUTAS_CAJA, rutaDeAlumno, rutaDeGrupo, rutaDeRecibo } from '@/lib/rutas';
import { campo, type EstadoDeFormulario } from '@/presentation/formularios/estado';
import { exigirPersonal } from '../_sesion';

const SIN_SESION: EstadoDeFormulario = { estado: 'error', mensaje: 'No pudimos comprobar tu sesión. Vuelve a entrar e inténtalo otra vez.' };
const SIN_PERMISO: EstadoDeFormulario = { estado: 'error', mensaje: 'Esta acción la hace administración. Si la necesitas, pídesela.' };

async function conPermiso(...permisos: Permiso[]): Promise<EstadoDeFormulario | null> {
  const lectura = await exigirPersonal();
  if (lectura.estado !== 'ok') return SIN_SESION;
  return permisos.every((p) => tienePermiso(lectura.contexto, p)) ? null : SIN_PERMISO;
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

/** Monto escrito → centavos; vacío o «0» = 0; texto inválido = null. */
function montoOCero(texto: string): number | null {
  if (texto.trim() === '' || /^0+([.,]0+)?$/.test(texto.trim())) return 0;
  const r = parsearMonto(texto);
  return r.exito ? r.valor : null;
}

// ---------------------------------------------------------------- cobrar

export async function cobrarAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('caja.cobrar');
  if (bloqueo) return bloqueo;
  const elegido = medio(campo(datos, 'medio'));
  if (!elegido) return errores(['Elige cómo pagó: efectivo, QR o transferencia.']);

  const marcados: { cargoId: Id; monto: Centavos; pendiente: Centavos }[] = [];
  for (const valor of datos.getAll('cargo')) {
    if (typeof valor !== 'string') continue;
    const monto = montoOCero(campo(datos, `monto-${valor}`));
    if (monto === null) return errores(['Revisa los montos: solo números con hasta dos decimales (por ejemplo 650 o 650,50).']);
    const pendiente = Number.parseInt(campo(datos, `pendiente-${valor}`), 10);
    marcados.push({ cargoId: valor as Id, monto: monto as Centavos, pendiente: (Number.isFinite(pendiente) ? pendiente : Number.MAX_SAFE_INTEGER) as Centavos });
  }
  const aplicaciones = aplicacionesElegidas(marcados);
  if (!aplicaciones.exito) return errores(aplicaciones.error);

  let venta;
  if (campo(datos, 'modo') === 'venta') {
    const monto = parsearMonto(campo(datos, 'montoVenta'));
    if (!monto.exito) return errores([monto.error]);
    venta = {
      conceptoCodigo: campo(datos, 'concepto'),
      descripcion: campo(datos, 'descripcion'),
      monto: monto.valor,
      cliente: opcional(campo(datos, 'cliente')),
    };
  }

  const r = await cobrar(await cajaRepository(), campo(datos, 'clave'), {
    sedeId: campo(datos, 'sede') as Id,
    estudianteId: opcional(campo(datos, 'alumno')) as Id | undefined,
    medio: elegido,
    referencia: opcional(campo(datos, 'referencia')),
    aplicaciones: aplicaciones.valor,
    venta,
    nota: opcional(campo(datos, 'nota')),
  });
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeRecibo(r.valor.pagoId)}?nuevo=1`);
}

// ---------------------------------------------------------------- cerrar caja

export async function cerrarCajaAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('caja.cerrar');
  if (bloqueo) return bloqueo;
  const primer = campo(datos, 'primer') === 'si';
  const contado = montoOCero(campo(datos, 'contado'));
  const queda = montoOCero(campo(datos, 'queda'));
  const saldoInicial = primer ? montoOCero(campo(datos, 'saldoInicial')) : 0;
  if (campo(datos, 'contado') === '') return errores(['Escribe cuánto contaste.']);
  if (contado === null || queda === null || saldoInicial === null) return errores(['Revisa los montos: solo números con hasta dos decimales.']);
  if (queda > contado) return errores(['No puedes dejar para el cambio más de lo que contaste.']);
  const base = Number.parseInt(campo(datos, 'esperado'), 10);
  const esperadoMostrado = ((Number.isFinite(base) ? base : 0) + saldoInicial) as Centavos;

  const sede = campo(datos, 'sede') as Id;
  const r = await cerrarCaja(
    await cajaRepository(),
    campo(datos, 'clave'),
    {
      sedeId: sede,
      contado: contado as Centavos,
      retiro: (contado - queda) as Centavos,
      observacion: opcional(campo(datos, 'observacion')),
      saldoInicial: primer ? (saldoInicial as Centavos) : undefined,
    },
    esperadoMostrado,
  );
  if (!r.exito) return errores(r.error);
  redirect(`${RUTAS_CAJA.arqueos}?cerrado=${r.valor.numero}&diferencia=${r.valor.diferencia}&sede=${sede}`);
}

// ---------------------------------------------------------------- anular y corregir (administración)

/** Administración marca revisado un arqueo con diferencia; la diferencia no cambia. */
export async function revisarArqueoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('caja.supervisar');
  if (bloqueo) return bloqueo;
  const cierre = campo(datos, 'cierre');
  if (!cierre) return errores(['Elige el arqueo que revisas.']);
  const r = await revisarArqueo(await cajaRepository(), campo(datos, 'clave'), cierre as Id, campo(datos, 'nota'));
  if (!r.exito) return errores(r.error);
  const sede = campo(datos, 'sede');
  redirect(`${RUTAS_CAJA.arqueos}?revisado=${r.valor.numero}${sede ? `&sede=${encodeURIComponent(sede)}` : ''}`);
}

export async function anularCobroAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('caja.anular');
  if (bloqueo) return bloqueo;
  const id = campo(datos, 'id') as Id;
  const r = await anular(await cajaRepository(), campo(datos, 'clave'), 'cobro', id, campo(datos, 'motivo'));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeRecibo(id)}?anulado=1`);
}

export async function anularCargoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('caja.anular');
  if (bloqueo) return bloqueo;
  const cargo = campo(datos, 'cargo');
  if (!cargo) return errores(['Elige el cargo que se anula.']);
  const r = await anular(await cajaRepository(), campo(datos, 'clave'), 'cargo', cargo as Id, campo(datos, 'motivo'));
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(campo(datos, 'codigo'))}?cargo=anulado`);
}

export async function crearCargoAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('contabilidad.gestionar');
  if (bloqueo) return bloqueo;
  const monto = parsearMonto(campo(datos, 'monto'));
  if (!monto.exito) return errores([monto.error]);
  const r = await crearCargoManual(await cajaRepository(), campo(datos, 'clave'), {
    estudianteId: campo(datos, 'alumno') as Id,
    inscripcionId: opcional(campo(datos, 'inscripcion')) as Id | undefined,
    conceptoId: campo(datos, 'concepto') as Id,
    descripcion: campo(datos, 'descripcion'),
    monto: monto.valor,
    venceEl: opcional(campo(datos, 'venceEl')),
  });
  if (!r.exito) return errores(r.error);
  redirect(`${rutaDeAlumno(campo(datos, 'codigo'))}?cargo=creado`);
}

export async function generarCuotasAccion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const bloqueo = await conPermiso('contabilidad.gestionar');
  if (bloqueo) return bloqueo;
  const grupo = campo(datos, 'grupo') as Id;
  const r = await (await cajaRepository()).generarCuotasDeGrupo(campo(datos, 'clave'), grupo);
  if (!r.exito) return errores([r.error]);
  redirect(`${rutaDeGrupo(grupo)}?cuotas=${r.valor.cuotas}&alumnos=${r.valor.inscripciones}`);
}
