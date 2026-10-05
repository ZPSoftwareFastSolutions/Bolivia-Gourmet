/**
 * CAPA: Presentation / App — Caja · Arqueos.
 *
 * Cada cierre: cuándo, quién, debería haber, se contó, la diferencia (en
 * palabras: «¡La caja cuadra!», «Faltan Bs 5,00») y cuánto quedó. Recién
 * cerrado, el sello confirma el resultado.
 *
 * Un arqueo con diferencia queda «Por revisar» hasta que administración lo
 * revisa: habla con quien cerró, corrige lo que estaba mal (anulando el cobro
 * o el gasto: la anulación entra en el próximo arqueo) y deja una nota. La
 * diferencia no cambia: es dinero que faltó o sobró de verdad. Revisado, deja
 * de aparecer en el aviso del inicio.
 */

import type { Metadata } from 'next';
import { describirDiferencia } from '@core/domain/caja/arqueo';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { cajaRepository } from '@infra/config/composition-root';
import { RUTAS_CAJA } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Confirmacion, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, PestanasDeCaja, sedeDeCaja, SelectorDeSede, type Parametros } from '../_componentes';
import { ArqueoEnLista } from './_arqueo';

export const metadata: Metadata = { title: 'Arqueos' };

export default async function Arqueos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CAJA.arqueos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'caja.leer');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const q = ctx.sedes.length > 1 && sede ? sede.id : undefined;
  const lista = await (await cajaRepository()).arqueos(sede?.id);
  const cerrado = parametro(valores, 'cerrado');
  const revisado = parametro(valores, 'revisado');
  const puedeRevisar = tienePermiso(ctx, 'caja.supervisar');
  const porRevisar = lista.exito ? lista.valor.filter((a) => a.diferencia !== 0 && !a.revision).length : 0;
  const diferencia = Number.parseInt(parametro(valores, 'diferencia'), 10);

  return (
    <div className="grid gap-6">
      {cerrado ? (
        <Confirmacion
          palabra={diferencia === 0 ? '¡Cuadra!' : 'Caja cerrada'}
          titulo={`Arqueo n.º ${cerrado}: ${describirDiferencia((Number.isFinite(diferencia) ? diferencia : 0) as Centavos)}`}
          cerrarHref={`${RUTAS_CAJA.arqueos}${q ? `?sede=${q}` : ''}`}
        >
          <p>Lo que se cobre desde ahora entra en el próximo cierre.</p>
        </Confirmacion>
      ) : null}
      {revisado ? (
        <Confirmacion palabra="¡Revisado!" titulo={`Arqueo n.º ${revisado} revisado`} cerrarHref={`${RUTAS_CAJA.arqueos}${q ? `?sede=${q}` : ''}`}>
          <p>Ya no aparece en el aviso del inicio. La diferencia sigue en el resumen del mes.</p>
        </Confirmacion>
      ) : null}
      <EncabezadoDePanel
        titulo="Arqueos"
        descripcion={[sede ? `Sede ${sede.nombre}` : null, porRevisar > 0 ? `${porRevisar === 1 ? '1 arqueo con diferencia por revisar' : `${porRevisar} arqueos con diferencia por revisar`}` : null].filter(Boolean).join(' · ') || undefined}
      />
      <PestanasDeCaja activa={RUTAS_CAJA.arqueos} sede={q} />
      <SelectorDeSede ctx={ctx} actual={sede?.id ?? ''} base={RUTAS_CAJA.arqueos} />
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los arqueos">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio frase="Aún sin cierres" detalle="Al final del turno, cierra la caja: cuenta el dinero y escríbelo." />
      ) : (
        <ul className="grid gap-3">
          {lista.valor.map((a) => (
            <ArqueoEnLista key={a.id} arqueo={a} nuevo={String(a.numero) === cerrado} puedeRevisar={puedeRevisar} sede={q} />
          ))}
        </ul>
      )}
    </div>
  );
}
