/**
 * CAPA: Infrastructure / Supabase
 *
 * Implementa `PortalRepositoryPort` con el cliente de la sesión del
 * estudiante. RLS limita cada consulta a sus filas; además se filtra por su
 * id, porque el personal (que también puede entrar al portal) ve todas.
 *
 * Lo que llega de la base se valida antes de entrar al dominio: TypeScript
 * garantiza la forma esperada, no lo que de verdad devolvió la red.
 */

import type { PerfilDelPortal, PortalRepositoryPort } from '@core/application/ports/portal-repository.port';
import type { Modalidad, Turno } from '@core/domain/academico/programa';
import type { Paquete } from '@core/domain/estudiantes/estudiante';
import { esRol } from '@core/domain/identidad/rol';
import type { DatosDeSolicitud, EstadoDeSolicitud, Solicitud, TipoDeSolicitud } from '@core/domain/portal/solicitud';
import { exito, fallo, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type { ClienteSupabase } from './cliente-servidor';
import { traducirErrorDeBase } from './errores';

const TURNOS: readonly string[] = ['manana', 'tarde', 'noche', 'especial', 'unico'];
const MODALIDADES: readonly string[] = ['practico', 'magistral', 'virtual'];

/** El nombre embebido puede venir como objeto o, según la relación, como lista. */
function nombreEmbebido(valor: unknown): string {
  const fila = Array.isArray(valor) ? valor[0] : valor;
  if (fila && typeof fila === 'object' && 'nombre' in fila && typeof fila.nombre === 'string') return fila.nombre;
  return '—';
}

export class PortalSupabase implements PortalRepositoryPort {
  private readonly cliente: ClienteSupabase;
  private readonly usuarioId: Id;

  constructor(cliente: ClienteSupabase, usuarioId: Id) {
    this.cliente = cliente;
    this.usuarioId = usuarioId;
  }

  async miPerfil(): Promise<Resultado<PerfilDelPortal | null>> {
    const { data, error } = await this.cliente
      .from('perfiles')
      .select('id, rol, nombres, apellidos, correo, telefono, documento')
      .eq('id', this.usuarioId)
      .maybeSingle();
    if (error) return fallo(traducirErrorDeBase(error));
    if (!data) return exito(null);
    if (!esRol(data.rol)) return fallo('El perfil tiene un rol desconocido.');
    return exito({
      id: data.id as Id,
      rol: data.rol,
      nombres: data.nombres,
      apellidos: data.apellidos,
      correo: data.correo ?? '',
      telefono: data.telefono ?? undefined,
      documento: data.documento ?? undefined,
    });
  }

  async misSolicitudes(): Promise<Resultado<readonly Solicitud[]>> {
    const { data, error } = await this.cliente
      .from('solicitudes')
      .select(
        'id, tipo, programa_codigo, turno, dias, duracion, modalidad, paquete, gestion_anterior, mensaje, estado, respuesta, created_at, programa:programas(nombre), sede:sedes(nombre)',
      )
      .eq('estudiante_id', this.usuarioId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return fallo(traducirErrorDeBase(error));

    return exito(
      (data ?? []).map((fila) => ({
        id: fila.id as Id,
        tipo: fila.tipo as TipoDeSolicitud,
        programaCodigo: fila.programa_codigo,
        programaNombre: nombreEmbebido(fila.programa),
        sedeNombre: nombreEmbebido(fila.sede),
        turno: fila.turno && TURNOS.includes(fila.turno) ? (fila.turno as Turno) : undefined,
        dias: fila.dias ?? undefined,
        duracion: fila.duracion ?? undefined,
        modalidad: fila.modalidad && MODALIDADES.includes(fila.modalidad) ? (fila.modalidad as Modalidad) : undefined,
        paquete: (fila.paquete as Paquete | null) ?? undefined,
        gestionAnterior: fila.gestion_anterior ?? undefined,
        mensaje: fila.mensaje ?? undefined,
        estado: fila.estado as EstadoDeSolicitud,
        respuesta: fila.respuesta ?? undefined,
        creadaEn: fila.created_at,
      })),
    );
  }

  async crearSolicitud(datos: DatosDeSolicitud): Promise<Resultado<Id>> {
    const sede = await this.cliente.from('sedes').select('id').eq('codigo', datos.sedeCodigo).maybeSingle();
    if (sede.error) return fallo(traducirErrorDeBase(sede.error));
    if (!sede.data) return fallo('La sede elegida no está disponible.');

    // Ni el autor ni el estado viajan: los fija la base (grants por columna).
    const { data, error } = await this.cliente
      .from('solicitudes')
      .insert({
        tipo: datos.tipo,
        programa_codigo: datos.programaCodigo,
        sede_id: sede.data.id,
        turno: datos.turno ?? null,
        dias: datos.dias ?? null,
        duracion: datos.duracion ?? null,
        modalidad: datos.modalidad ?? null,
        paquete: datos.paquete ?? null,
        gestion_anterior: datos.gestionAnterior ?? null,
        mensaje: datos.mensaje ?? null,
      })
      .select('id')
      .single();
    if (error) return fallo(traducirErrorDeBase(error));
    return exito(data.id as Id);
  }

  async cancelarSolicitud(id: Id): Promise<Resultado<void>> {
    // `.select('id')` distingue «RLS lo bloqueó» (0 filas) de «se guardó».
    const { data, error } = await this.cliente
      .from('solicitudes')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .eq('estudiante_id', this.usuarioId)
      .select('id');
    if (error) return fallo(traducirErrorDeBase(error));
    if (!data || data.length === 0) return fallo('No encontramos esa solicitud o ya no puede cancelarse.');
    return exito(undefined);
  }
}
