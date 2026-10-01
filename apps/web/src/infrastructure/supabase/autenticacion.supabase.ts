/**
 * CAPA: Infrastructure / Supabase
 *
 * Implementa `AutenticacionPort` sobre Supabase Auth. Traduce cada error a un
 * mensaje legible (`errores.ts`) y nunca lanza hacia el caso de uso.
 */

import type {
  AutenticacionPort,
  EstadoDeSesion,
  ResultadoDeRegistro,
  SolicitudDeRegistro,
  TipoDeEnlace,
  UsuarioAutenticado,
} from '@core/application/ports/autenticacion.port';
import { exito, fallo, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type { ClienteSupabase } from './cliente-servidor';
import { traducirErrorDeAuth } from './errores';

export class AutenticacionSupabase implements AutenticacionPort {
  private readonly cliente: ClienteSupabase;
  private readonly conCookieDeSesion: boolean;

  constructor(cliente: ClienteSupabase, conCookieDeSesion: boolean) {
    this.cliente = cliente;
    this.conCookieDeSesion = conCookieDeSesion;
  }

  /**
   * `getUser()` y NO `getSession()`: `getSession()` devuelve lo que diga la
   * cookie sin validar la firma. Sirve para pintar, no para decidir.
   */
  async estadoDeSesion(): Promise<EstadoDeSesion> {
    // Sin cookie no hay nada que validar: visitante, no fallo, y sin
    // consultar al servidor de autenticación.
    if (!this.conCookieDeSesion) return { estado: 'anonimo' };
    try {
      const { data, error } = await this.cliente.auth.getUser();
      if (!error && data.user) {
        return { estado: 'autenticado', usuario: { id: data.user.id as Id, correo: data.user.email ?? '' } };
      }
      // Solo el fallo de transporte es indisponibilidad; un token rechazado
      // por el servidor es una sesión que de verdad terminó.
      const transporte = error?.name === 'AuthRetryableFetchError' || error?.status === undefined || error?.status === 0;
      return transporte ? { estado: 'indisponible' } : { estado: 'anonimo' };
    } catch {
      return { estado: 'indisponible' };
    }
  }

  async registrar(solicitud: SolicitudDeRegistro): Promise<Resultado<ResultadoDeRegistro>> {
    const { estudiante } = solicitud;
    const { data, error } = await this.cliente.auth.signUp({
      email: solicitud.correo,
      password: solicitud.clave,
      options: {
        emailRedirectTo: solicitud.urlDeRetorno,
        // Solo datos de contacto. El rol NO viaja: lo asigna la base (ADR 0005).
        data: {
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          telefono: estudiante.telefono ?? '',
          documento: estudiante.documento ?? '',
        },
      },
    });
    if (error) return fallo(traducirErrorDeAuth(error));
    return exito(data.session ? 'sesion_iniciada' : 'requiere_confirmacion');
  }

  async iniciarSesion(correo: string, clave: string): Promise<Resultado<UsuarioAutenticado>> {
    const { data, error } = await this.cliente.auth.signInWithPassword({ email: correo, password: clave });
    if (error || !data.user) return fallo(traducirErrorDeAuth(error));
    return exito({ id: data.user.id as Id, correo: data.user.email ?? correo });
  }

  async cerrarSesion(): Promise<void> {
    // `local`: cierra ESTE dispositivo, no todas las sesiones del estudiante.
    await this.cliente.auth.signOut({ scope: 'local' });
  }

  async enviarRecuperacion(correo: string, urlDeRetorno: string): Promise<Resultado<void>> {
    const { error } = await this.cliente.auth.resetPasswordForEmail(correo, { redirectTo: urlDeRetorno });
    // Solo se informa el límite de envíos; cualquier otro error se calla para
    // no revelar si el correo existe.
    if (error && (error.code === 'over_email_send_rate_limit' || error.status === 429)) {
      return fallo(traducirErrorDeAuth(error));
    }
    return exito(undefined);
  }

  async cambiarClave(clave: string): Promise<Resultado<void>> {
    const { error } = await this.cliente.auth.updateUser({ password: clave });
    return error ? fallo(traducirErrorDeAuth(error)) : exito(undefined);
  }

  async canjearCodigo(codigo: string): Promise<Resultado<void>> {
    const { error } = await this.cliente.auth.exchangeCodeForSession(codigo);
    return error ? fallo(traducirErrorDeAuth(error)) : exito(undefined);
  }

  async verificarEnlace(tokenHash: string, tipo: TipoDeEnlace): Promise<Resultado<void>> {
    const { error } = await this.cliente.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    return error ? fallo(traducirErrorDeAuth(error)) : exito(undefined);
  }
}
