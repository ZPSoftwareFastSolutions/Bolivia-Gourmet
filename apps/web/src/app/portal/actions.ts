'use server';

/**
 * CAPA: Presentation / App — Server Actions del portal.
 *
 * Cada acción: lee el formulario → llama a UN caso de uso → traduce el
 * resultado a un estado de formulario o a una redirección. No decide reglas
 * (las decide el dominio) ni toca Supabase (lo hace el adaptador).
 *
 * Seguridad:
 *   - Next rechaza acciones cuyo Origin no coincide con el Host (CSRF).
 *   - Cada acción vuelve a comprobar la sesión: una acción es un endpoint
 *     público, no hereda la guarda de la página que la muestra.
 *   - La contraseña nunca vuelve en el estado del formulario.
 *   - Los destinos de redirección pasan por `destinoSeguro`.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  cambiarClave as casoCambiarClave,
  iniciarSesion as casoIniciarSesion,
  registrarEstudiante,
  solicitarRecuperacion as casoSolicitarRecuperacion,
} from '@core/application/portal/acceso.usecase';
import { cancelarSolicitud as casoCancelarSolicitud, crearSolicitud as casoCrearSolicitud } from '@core/application/portal/solicitudes.usecase';
import type { Paquete } from '@core/domain/estudiantes/estudiante';
import type { TipoDeSolicitud } from '@core/domain/portal/solicitud';
import type { Id } from '@core/domain/shared/tipos-base';
import { autenticacion, catalogoAcademico, portalRepository } from '@infra/config/composition-root';
import { destinoSeguro } from '@/lib/redirecciones';
import { RUTAS } from '@/lib/rutas';
import { campo, campoCrudo, type EstadoDeFormulario } from '@/presentation/formularios/estado';

/** Origen del sitio para los enlaces de los correos. */
async function origenDelSitio(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurado) return configurado.replace(/\/$/, '');
  const cabeceras = await headers();
  const origen = cabeceras.get('origin');
  if (origen && /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origen)) return origen;
  const host = cabeceras.get('host') ?? 'localhost:3000';
  return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
}

// ---------------------------------------------------------------- acceso

export async function registrarse(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const valores = {
    nombres: campo(datos, 'nombres'),
    apellidos: campo(datos, 'apellidos'),
    telefono: campo(datos, 'telefono'),
    documento: campo(datos, 'documento'),
    correo: campo(datos, 'correo'),
  };
  const origen = await origenDelSitio();
  const resultado = await registrarEstudiante(
    await autenticacion(),
    {
      ...valores,
      telefono: valores.telefono || undefined,
      documento: valores.documento || undefined,
      clave: campoCrudo(datos, 'clave'),
      confirmacion: campoCrudo(datos, 'confirmacion'),
      aceptaPrivacidad: datos.get('aceptaPrivacidad') === 'si',
    },
    `${origen}${RUTAS.confirmar}?siguiente=${encodeURIComponent(RUTAS.portal)}`,
  );

  if (!resultado.exito) return { estado: 'error', errores: resultado.error, valores };
  if (resultado.valor === 'sesion_iniciada') redirect(`${RUTAS.portal}?bienvenida=1`);
  return {
    estado: 'exito',
    mensaje: `Te enviamos un correo a ${valores.correo}. Abre el enlace para confirmar tu cuenta y luego inicia sesión.`,
  };
}

export async function iniciarSesion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const correo = campo(datos, 'correo');
  const resultado = await casoIniciarSesion(await autenticacion(), correo, campoCrudo(datos, 'clave'));
  if (!resultado.exito) return { estado: 'error', mensaje: resultado.error, valores: { correo } };
  redirect(destinoSeguro(campo(datos, 'siguiente')));
}

export async function solicitarRecuperacion(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const correo = campo(datos, 'correo');
  const origen = await origenDelSitio();
  const resultado = await casoSolicitarRecuperacion(
    await autenticacion(),
    correo,
    `${origen}${RUTAS.confirmar}?siguiente=${encodeURIComponent(RUTAS.nuevaClave)}`,
  );
  if (!resultado.exito) return { estado: 'error', mensaje: resultado.error, valores: { correo } };
  // Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados.
  return { estado: 'exito', mensaje: 'Si existe una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva.' };
}

export async function cambiarClave(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const resultado = await casoCambiarClave(await autenticacion(), campoCrudo(datos, 'clave'), campoCrudo(datos, 'confirmacion'));
  if (!resultado.exito) return { estado: 'error', mensaje: resultado.error };
  redirect(`${RUTAS.portal}?clave=actualizada`);
}

export async function cerrarSesion(): Promise<void> {
  await (await autenticacion()).cerrarSesion();
  redirect(RUTAS.inicio);
}

// ---------------------------------------------------------------- solicitudes

async function usuarioDeLaSesion() {
  const sesion = await (await autenticacion()).estadoDeSesion();
  return sesion.estado === 'autenticado' ? sesion.usuario : null;
}

export async function crearSolicitud(_previo: EstadoDeFormulario, datos: FormData): Promise<EstadoDeFormulario> {
  const renovacion = campo(datos, 'tipo') === 'renovacion';
  const usuario = await usuarioDeLaSesion();
  if (!usuario) redirect(`${RUTAS.acceso}?siguiente=${encodeURIComponent(renovacion ? RUTAS.renovacion : RUTAS.solicitud)}`);

  const valores = {
    tipo: renovacion ? 'renovacion' : 'inscripcion',
    programa: campo(datos, 'programa'),
    grupo: campo(datos, 'grupo'),
    paquete: campo(datos, 'paquete'),
    gestionAnterior: campo(datos, 'gestionAnterior'),
    mensaje: campo(datos, 'mensaje'),
  };

  // El grupo es lo único que se elige (ADR 0009): el dominio comprueba que
  // esté en la oferta abierta de hoy y que no se cruce con lo de la persona.
  const resultado = await casoCrearSolicitud(catalogoAcademico(), await portalRepository(usuario.id), {
    tipo: (renovacion ? 'renovacion' : 'inscripcion') satisfies TipoDeSolicitud,
    programaCodigo: valores.programa,
    grupoId: valores.grupo,
    paquete: (valores.paquete || undefined) as Paquete | undefined,
    gestionAnterior: valores.gestionAnterior || undefined,
    mensaje: valores.mensaje || undefined,
  });
  // El paquete sin validar se convierte arriba solo para tiparlo: el dominio
  // lo contrasta con los paquetes reales y rechaza lo que no esté entre ellos.

  if (!resultado.exito) return { estado: 'error', mensaje: resultado.error.join(' '), valores };
  redirect(`${RUTAS.portal}?enviada=${valores.tipo}`);
}

export async function cancelarSolicitud(datos: FormData): Promise<void> {
  const usuario = await usuarioDeLaSesion();
  if (!usuario) redirect(RUTAS.acceso);
  const id = campo(datos, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`${RUTAS.portal}?error=cancelacion`);
  const resultado = await casoCancelarSolicitud(await portalRepository(usuario.id), id as Id);
  redirect(resultado.exito ? `${RUTAS.portal}?cancelada=1` : `${RUTAS.portal}?error=cancelacion`);
}
