/**
 * CAPA: Application / Portal
 *
 * Casos de uso de las solicitudes del estudiante. Orquestan: traen el
 * programa del catálogo, la oferta abierta, lo que la persona cursa y lo que
 * ya pidió, dejan que el dominio valide y solo entonces escriben. La base
 * repite las reglas (RLS y disparadores) por si alguien llama a la API
 * saltándose la web.
 */

import { gruposPara, type GrupoDelPortal, type MisGrupos } from '../../domain/portal/convocatoria';
import { puedeCancelar, validarSolicitud, type DatosDeSolicitud, type Solicitud, type TipoDeSolicitud } from '../../domain/portal/solicitud';
import { exito, fallo, type Id, type Resultado } from '../../domain/shared/tipos-base';
import type { CatalogoAcademicoPort } from '../ports/catalogo-academico.port';
import type { PerfilDelPortal, PortalRepositoryPort } from '../ports/portal-repository.port';

export async function crearSolicitud(
  catalogo: CatalogoAcademicoPort,
  portal: PortalRepositoryPort,
  datos: DatosDeSolicitud,
): Promise<Resultado<Id, readonly string[]>> {
  const [programa, oferta, misGrupos, solicitudes] = await Promise.all([
    catalogo.programaPorCodigo(datos.programaCodigo),
    portal.ofertaAbierta(),
    portal.misGrupos(),
    portal.misSolicitudes(),
  ]);
  if (!oferta.exito) return fallo([oferta.error]);
  if (!misGrupos.exito) return fallo([misGrupos.error]);
  if (!solicitudes.exito) return fallo([solicitudes.error]);

  const validacion = validarSolicitud(datos, {
    programa,
    oferta: oferta.valor,
    misGrupos: misGrupos.valor,
    solicitudes: solicitudes.valor,
  });
  if (!validacion.exito) return validacion;

  const creada = await portal.crearSolicitud(validacion.valor);
  return creada.exito ? creada : fallo([creada.error]);
}

export async function cancelarSolicitud(portal: PortalRepositoryPort, id: Id): Promise<Resultado<void>> {
  const solicitudes = await portal.misSolicitudes();
  if (!solicitudes.exito) return solicitudes;
  const propia = solicitudes.valor.find((s) => s.id === id);
  if (!propia) return fallo('No encontramos esa solicitud.');
  if (!puedeCancelar(propia)) return fallo('Solo puedes cancelar una solicitud que todavía está pendiente.');
  return portal.cancelarSolicitud(id);
}

export interface PanelDelEstudiante {
  readonly perfil: PerfilDelPortal;
  readonly solicitudes: readonly Solicitud[];
  /** Sus cursos (para «Mis cursos» y «Mi horario») y el grupo de cada solicitud. */
  readonly misGrupos: MisGrupos;
}

export async function obtenerPanel(portal: PortalRepositoryPort): Promise<Resultado<PanelDelEstudiante>> {
  const [perfil, solicitudes, misGrupos] = await Promise.all([portal.miPerfil(), portal.misSolicitudes(), portal.misGrupos()]);
  if (!perfil.exito) return perfil;
  if (!solicitudes.exito) return solicitudes;
  if (!misGrupos.exito) return misGrupos;
  if (!perfil.valor) return fallo('Tu cuenta no tiene perfil todavía. Cierra sesión y vuelve a entrar; si persiste, escríbenos.');
  return exito({ perfil: perfil.valor, solicitudes: solicitudes.valor, misGrupos: misGrupos.valor });
}

/** Lo que muestran «Nueva inscripción» y «Renovar gestión». */
export interface Convocatoria {
  readonly tipo: TipoDeSolicitud;
  /** Los grupos en convocatoria de ESTA página: cursos y 1.er año, o 2.º y 3.er año. */
  readonly grupos: readonly GrupoDelPortal[];
  readonly misGrupos: MisGrupos;
  readonly solicitudes: readonly Solicitud[];
}

export async function obtenerConvocatoria(portal: PortalRepositoryPort, tipo: TipoDeSolicitud): Promise<Resultado<Convocatoria>> {
  const [oferta, misGrupos, solicitudes] = await Promise.all([portal.ofertaAbierta(), portal.misGrupos(), portal.misSolicitudes()]);
  if (!oferta.exito) return oferta;
  if (!misGrupos.exito) return misGrupos;
  if (!solicitudes.exito) return solicitudes;
  return exito({ tipo, grupos: gruposPara(tipo, oferta.valor), misGrupos: misGrupos.valor, solicitudes: solicitudes.valor });
}
