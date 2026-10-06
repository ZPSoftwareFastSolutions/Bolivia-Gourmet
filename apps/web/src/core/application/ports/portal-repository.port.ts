/**
 * CAPA: Application / Ports
 *
 * Lo que el portal lee y escribe en la base. Lo implementa un repositorio
 * Supabase creado POR PETICIÓN con el cliente que lleva la cookie del
 * estudiante: así RLS decide con SU identidad. Cachearlo serviría los datos
 * del primer estudiante a todos.
 */

import type { Rol } from '../../domain/identidad/rol';
import type { GrupoDelPortal, MisGrupos } from '../../domain/portal/convocatoria';
import type { Solicitud, SolicitudValidada } from '../../domain/portal/solicitud';
import type { Id, Resultado } from '../../domain/shared/tipos-base';

export interface PerfilDelPortal {
  readonly id: Id;
  readonly rol: Rol;
  readonly nombres: string;
  readonly apellidos: string;
  readonly correo: string;
  readonly telefono?: string;
  readonly documento?: string;
}

export interface PortalRepositoryPort {
  /** `null` si la sesión no tiene perfil (no debería pasar: lo crea un disparador). */
  miPerfil(): Promise<Resultado<PerfilDelPortal | null>>;
  /** Las del estudiante de la sesión, más recientes primero. */
  misSolicitudes(): Promise<Resultado<readonly Solicitud[]>>;
  /** Los grupos con inscripciones abiertas hoy (ADR 0009). */
  ofertaAbierta(): Promise<Resultado<readonly GrupoDelPortal[]>>;
  /** Sus inscripciones vigentes y concluidas, y el grupo de cada solicitud que nombra uno. */
  misGrupos(): Promise<Resultado<MisGrupos>>;
  crearSolicitud(datos: SolicitudValidada): Promise<Resultado<Id>>;
  cancelarSolicitud(id: Id): Promise<Resultado<void>>;
}
