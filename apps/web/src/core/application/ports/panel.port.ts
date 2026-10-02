/**
 * CAPA: Application / Puertos
 *
 * Lo que el panel interno necesita saber de la sesión. Lo implementa un
 * adaptador de Supabase creado POR PETICIÓN con la cookie de quien pregunta
 * (`infrastructure/supabase/panel.supabase.ts`).
 */

import type { ContextoDePanel } from '@core/domain/identidad/contexto-de-panel';
import type { Resultado } from '@core/domain/shared/tipos-base';

export interface PanelPort {
  /** Contexto de la sesión; `null` si la cuenta no tiene perfil. */
  contexto(): Promise<Resultado<ContextoDePanel | null>>;
}
