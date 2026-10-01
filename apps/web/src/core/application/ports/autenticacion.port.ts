/**
 * CAPA: Application / Ports
 *
 * Puerto de autenticación del portal. Lo implementa Supabase Auth en
 * `infrastructure/supabase`; en pruebas, un doble en memoria. Ningún caso de
 * uso sabe que existe Supabase.
 *
 * Las operaciones devuelven `Resultado` con mensajes ya legibles: el
 * adaptador traduce los códigos del proveedor y nunca deja pasar un mensaje
 * técnico a la pantalla.
 */

import type { DatosDeEstudiante } from '../../domain/estudiantes/estudiante';
import type { Id, Resultado } from '../../domain/shared/tipos-base';

export interface UsuarioAutenticado {
  readonly id: Id;
  readonly correo: string;
}

/**
 * Tres estados y no dos: «no se pudo comprobar» no es «no hay sesión». Un
 * corte de red al validar el token no debe echar al estudiante del portal.
 */
export type EstadoDeSesion =
  | { readonly estado: 'autenticado'; readonly usuario: UsuarioAutenticado }
  | { readonly estado: 'anonimo' }
  | { readonly estado: 'indisponible' };

/**
 * `requiere_confirmacion`: la cuenta se creó (o ya existía: el proveedor no
 * lo distingue a propósito, para no revelar qué correos están registrados) y
 * hay que confirmar el correo. `sesion_iniciada`: la confirmación está
 * desactivada en el proyecto y la sesión ya está abierta.
 */
export type ResultadoDeRegistro = 'requiere_confirmacion' | 'sesion_iniciada';

export interface SolicitudDeRegistro {
  readonly correo: string;
  readonly clave: string;
  readonly estudiante: DatosDeEstudiante;
  /** Adónde vuelve el enlace del correo de confirmación. */
  readonly urlDeRetorno: string;
}

export type TipoDeEnlace = 'signup' | 'recovery' | 'email' | 'invite' | 'magiclink' | 'email_change';

export interface AutenticacionPort {
  estadoDeSesion(): Promise<EstadoDeSesion>;
  registrar(solicitud: SolicitudDeRegistro): Promise<Resultado<ResultadoDeRegistro>>;
  iniciarSesion(correo: string, clave: string): Promise<Resultado<UsuarioAutenticado>>;
  cerrarSesion(): Promise<void>;
  /** Siempre «éxito» hacia fuera salvo fallo técnico: no revela si el correo existe. */
  enviarRecuperacion(correo: string, urlDeRetorno: string): Promise<Resultado<void>>;
  cambiarClave(clave: string): Promise<Resultado<void>>;
  /** Canjea el código PKCE del enlace del correo por una sesión. */
  canjearCodigo(codigo: string): Promise<Resultado<void>>;
  /** Verifica un enlace con `token_hash` (plantillas de correo personalizadas). */
  verificarEnlace(tokenHash: string, tipo: TipoDeEnlace): Promise<Resultado<void>>;
}
