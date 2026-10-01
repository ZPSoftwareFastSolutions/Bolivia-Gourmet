/**
 * CAPA: Application / Portal
 *
 * Casos de uso de acceso: registro, inicio de sesión, recuperación y cambio
 * de contraseña. Validan con el dominio y solo entonces llaman al puerto: un
 * dato inválido nunca llega al proveedor de identidad.
 */

import {
  validarClave,
  validarCorreo,
  validarRegistro,
  type DatosDeRegistro,
  type ErroresDeRegistro,
} from '../../domain/identidad/credenciales';
import { exito, fallo, type Resultado } from '../../domain/shared/tipos-base';
import type { AutenticacionPort, ResultadoDeRegistro, UsuarioAutenticado } from '../ports/autenticacion.port';

export async function registrarEstudiante(
  autenticacion: AutenticacionPort,
  datos: DatosDeRegistro,
  urlDeRetorno: string,
): Promise<Resultado<ResultadoDeRegistro, ErroresDeRegistro>> {
  const validacion = validarRegistro(datos);
  if (!validacion.exito) return validacion;

  const registro = await autenticacion.registrar({ ...validacion.valor, urlDeRetorno });
  if (!registro.exito) return fallo({ general: registro.error });
  return registro;
}

export async function iniciarSesion(
  autenticacion: AutenticacionPort,
  correo: string,
  clave: string,
): Promise<Resultado<UsuarioAutenticado>> {
  const correoValido = validarCorreo(correo);
  if (!correoValido.exito) return correoValido;
  if (clave.length === 0) return fallo('Escribe tu contraseña.');
  return autenticacion.iniciarSesion(correoValido.valor, clave);
}

/**
 * Siempre responde lo mismo si el correo tiene formato válido: decir «ese
 * correo no existe» le enseña a cualquiera qué correos están registrados.
 */
export async function solicitarRecuperacion(
  autenticacion: AutenticacionPort,
  correo: string,
  urlDeRetorno: string,
): Promise<Resultado<void>> {
  const correoValido = validarCorreo(correo);
  if (!correoValido.exito) return correoValido;
  const envio = await autenticacion.enviarRecuperacion(correoValido.valor, urlDeRetorno);
  return envio.exito ? exito(undefined) : envio;
}

export async function cambiarClave(
  autenticacion: AutenticacionPort,
  clave: string,
  confirmacion: string,
): Promise<Resultado<void>> {
  const sesion = await autenticacion.estadoDeSesion();
  if (sesion.estado !== 'autenticado') {
    return fallo('El enlace caducó o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».');
  }
  const validacion = validarClave(clave, sesion.usuario.correo);
  if (!validacion.exito) return validacion;
  if (clave !== confirmacion) return fallo('Las contraseñas no coinciden.');
  return autenticacion.cambiarClave(clave);
}
