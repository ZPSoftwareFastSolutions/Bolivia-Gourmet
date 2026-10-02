/**
 * CAPA: Infrastructure / Supabase
 *
 * Contexto del panel interno: llama a `public.mi_contexto()` (INVOKER, bajo
 * RLS) con el cliente de ESTA petición y lo convierte al tipo del dominio. No
 * decide nada: si la base dice que no hay permisos, no los hay.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PanelPort } from '@core/application/ports/panel.port';
import type { ContextoDePanel, SedeOperable } from '@core/domain/identidad/contexto-de-panel';
import { esRol } from '@core/domain/identidad/rol';
import { exito, fallo, type FechaISO, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import { traducirErrorDePanel } from './errores-del-panel';
import type { Database } from './tipos-de-base.generados';

interface ContextoCrudo {
  readonly id?: string;
  readonly rol?: string;
  readonly nombres?: string;
  readonly apellidos?: string;
  readonly correo?: string | null;
  readonly activo?: boolean;
  readonly sede_id?: string | null;
  readonly hoy?: string;
  readonly permisos?: readonly string[];
  readonly sedes?: readonly { id: string; codigo: string; nombre: string; zona: string }[];
}

export class PanelSupabase implements PanelPort {
  private readonly cliente: SupabaseClient<Database>;

  constructor(cliente: SupabaseClient<Database>) {
    this.cliente = cliente;
  }

  async contexto(): Promise<Resultado<ContextoDePanel | null>> {
    const { data, error } = await this.cliente.rpc('mi_contexto');
    if (error) return fallo(traducirErrorDePanel(error));
    const crudo = (data ?? null) as ContextoCrudo | null;
    if (!crudo || !crudo.id) return exito(null);
    if (!esRol(crudo.rol)) return fallo('El perfil tiene un rol desconocido.');

    const sedes: SedeOperable[] = (crudo.sedes ?? []).map((s) => ({
      id: s.id as Id,
      codigo: s.codigo,
      nombre: s.nombre,
      zona: s.zona,
    }));
    return exito({
      id: crudo.id as Id,
      rol: crudo.rol,
      nombres: crudo.nombres ?? '',
      apellidos: crudo.apellidos ?? '',
      correo: crudo.correo ?? '',
      activo: crudo.activo === true,
      sedeId: (crudo.sede_id ?? null) as Id | null,
      hoy: (crudo.hoy ?? '') as FechaISO,
      permisos: new Set(crudo.permisos ?? []),
      sedes,
    });
  }
}
