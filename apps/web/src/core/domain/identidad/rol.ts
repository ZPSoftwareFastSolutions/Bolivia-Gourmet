/**
 * CAPA: Domain / Identidad
 *
 * Los tres roles fijos (ADR 0005). La base guarda el mismo enum
 * (`rol_de_usuario`); los permisos de cada uno viven en `permisos_de_rol`.
 */

export type Rol = 'administrador' | 'recepcion' | 'estudiante';

export const ROLES: readonly Rol[] = ['administrador', 'recepcion', 'estudiante'];

export const ETIQUETA_DE_ROL: Record<Rol, string> = {
  administrador: 'Administración',
  recepcion: 'Recepción',
  estudiante: 'Estudiante',
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

/** El personal trabaja en el sistema interno; el portal web es del estudiante. */
export function esPersonal(rol: Rol): boolean {
  return rol === 'administrador' || rol === 'recepcion';
}
