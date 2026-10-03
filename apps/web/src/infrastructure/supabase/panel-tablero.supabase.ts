/**
 * CAPA: Infrastructure / Supabase
 *
 * Tablero de administración (especificación §7.7) con el cliente de ESTA
 * petición. Lo que ningún otro puerto da (efectivo sin arqueo, arqueos con
 * diferencia, bajas de la semana, lo que quedó sin precio y el dinero del mes
 * y de las últimas 8 semanas) lo suma la base en una sola llamada:
 * `tablero_de_administracion`, que corre bajo RLS y exige
 * `contabilidad.leer`. Una sola ida y vuelta mantiene liviano el inicio del
 * panel, que es la página que más se abre.
 *
 * Los dos tableros muestran además cifras que una lista recortada daría
 * mal (la API devuelve como mucho las filas que se piden): lo que deben los
 * alumnos (`resumen_de_deudores`) y los lotes con alerta (conteo exacto).
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exito, fallo, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type { LotesConAlertaContados, ResumenDeDeudores, TableroDeAdministracionEnBase, TableroPort } from '@core/application/ports/tablero.port';
import { traducirErrorDePanel } from './errores-del-panel';
import { argsDe } from './rpc';
import { deudoresDesdeBase, tableroDesdeBase } from './tablero-desde-base';
import type { Database } from './tipos-de-base.generados';

export class PanelTableroSupabase implements TableroPort {
  private readonly cliente: SupabaseClient<Database>;

  constructor(cliente: SupabaseClient<Database>) {
    this.cliente = cliente;
  }

  /** Sin sede = todas (la base filtra con `p_sede is null or ...`). */
  async tableroDeAdministracion(sedeId?: Id): Promise<Resultado<TableroDeAdministracionEnBase>> {
    const { data, error } = await this.cliente.rpc(
      'tablero_de_administracion',
      argsDe<'tablero_de_administracion'>({ p_sede: sedeId ?? null }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(tableroDesdeBase(data));
  }

  async resumenDeDeudores(sedeId?: Id): Promise<Resultado<ResumenDeDeudores>> {
    const { data, error } = await this.cliente.rpc('resumen_de_deudores', argsDe<'resumen_de_deudores'>({ p_sede: sedeId ?? null }));
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(deudoresDesdeBase(data));
  }

  /** Dos conteos exactos (`head: true` no trae filas): vencidos y por vencer. */
  async contarLotesConAlerta(sedeId?: Id): Promise<Resultado<LotesConAlertaContados>> {
    const contar = (estado: 'vencido' | 'por_vencer') => {
      let consulta = this.cliente.from('v_lotes_vigentes').select('id', { count: 'exact', head: true }).eq('estado', estado);
      if (sedeId) consulta = consulta.eq('sede_id', sedeId);
      return consulta;
    };
    const [vencidos, porVencer] = await Promise.all([contar('vencido'), contar('por_vencer')]);
    const error = vencidos.error ?? porVencer.error;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ vencidos: vencidos.count ?? 0, porVencer: porVencer.count ?? 0 });
  }
}
