/**
 * CAPA: Presentation / App — precio del grupo (plan de pagos, administración).
 *
 * En la carrera, un precio por paquete (Económico y Ahorrador); en los
 * cursos, uno solo. Cada uno: cuánto por cuota, cuántas cuotas, cuándo vence
 * la primera y cada cuántos meses. Si el monto no coincide con el publicado
 * en el catálogo, se avisa (no bloquea, B.12 28). Las cuotas se cargan a cada
 * alumno al inscribirlo (con la caja, R3).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { describirPlan } from '@core/domain/academico/programa';
import { montoParaCampo } from '@core/domain/shared/dinero';
import { esPendiente, type Id } from '@core/domain/shared/tipos-base';
import type { Paquete } from '@core/domain/estudiantes/estudiante';
import type { PlanDeGrupo } from '@core/application/ports/alumnos.port';
import { alumnosRepository, catalogoAcademico } from '@infra/config/composition-root';
import { rutaDeGrupo } from '@/lib/rutas';
import { AreaDeTexto, Aviso, CampoDeTexto } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../../_sesion';
import { borrarPlanAccion, guardarPlanAccion } from '../../../actions';
import { ETIQUETA_DE_PAQUETE } from '../../../_componentes';

export const metadata: Metadata = { title: 'Precio del grupo' };

function FormularioDePlan({
  grupoId,
  programaCodigo,
  paquete,
  plan,
  fechaSugerida,
  referencia,
}: {
  readonly grupoId: string;
  readonly programaCodigo: string;
  readonly paquete: Paquete | null;
  readonly plan: PlanDeGrupo | undefined;
  readonly fechaSugerida: string;
  readonly referencia: string | null;
}) {
  const sufijo = paquete ?? 'unico';
  return (
    <section aria-labelledby={`plan-${sufijo}`} className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
      <h2 id={`plan-${sufijo}`} className="t-display text-2xl text-estructural">
        {paquete ? ETIQUETA_DE_PAQUETE[paquete] : 'Precio del curso'}
      </h2>
      {plan ? <p className="text-tinta-suave">Ahora: {describirPlan(plan)}</p> : <p className="text-tinta-suave">Sin precio: quien pregunta escucha «Consultar».</p>}
      {referencia ? <p className="text-sm text-tinta-suave">Precio publicado en la web: {referencia}.</p> : null}
      <FormularioDelPanel accion={guardarPlanAccion} etiqueta={paquete ? ETIQUETA_DE_PAQUETE[paquete] : 'Precio del curso'}>
        <input type="hidden" name="grupo" value={grupoId} />
        <input type="hidden" name="programa" value={programaCodigo} />
        {paquete ? <input type="hidden" name="paquete" value={paquete} /> : null}
        {plan ? <input type="hidden" name="plan" value={plan.id} /> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoDeTexto id={`monto-${sufijo}`} name="monto" etiqueta="Monto de cada cuota (Bs)" inputMode="decimal" maxLength={14} defaultValue={plan ? montoParaCampo(plan.montoCuota) : ''} ayuda="Por ejemplo 650 o 650,50." />
          <CampoDeTexto id={`cuotas-${sufijo}`} name="cuotas" etiqueta="Número de cuotas" inputMode="numeric" maxLength={2} defaultValue={String(plan?.cuotas ?? 1)} />
          <CampoDeTexto id={`primer-${sufijo}`} name="primerVencimiento" etiqueta="La primera cuota vence el" type="date" defaultValue={plan?.primerVencimiento ?? fechaSugerida} />
          <CampoDeTexto id={`cada-${sufijo}`} name="cadaMeses" etiqueta="Cada cuántos meses" inputMode="numeric" maxLength={2} defaultValue={String(plan?.cadaMeses ?? 1)} ayuda="1 = una cuota por mes." />
        </div>
        <AreaDeTexto id={`nota-${sufijo}`} name="nota" etiqueta="Nota" opcional maxLength={200} defaultValue={plan?.nota ?? ''} ayuda="Por ejemplo «Periodicidad por confirmar». Sale en el recibo." />
        <BotonGuardar icono="monedas" className="justify-self-start">
          {plan ? 'Guardar precio' : 'Definir precio'}
        </BotonGuardar>
      </FormularioDelPanel>
      {plan ? (
        <FormularioDelPanel accion={borrarPlanAccion} etiqueta="Quitar precio">
          <input type="hidden" name="grupo" value={grupoId} />
          <input type="hidden" name="plan" value={plan.id} />
          <BotonGuardar variante="peligro" icono="papelera" enviando="Quitando…" className="justify-self-start">
            Quitar este precio
          </BotonGuardar>
        </FormularioDelPanel>
      ) : null}
    </section>
  );
}

export default async function PrecioDelGrupo({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await params;
  const lectura = await exigirPersonal(`${rutaDeGrupo(id)}/precio`);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'contabilidad.gestionar');

  const leida = await (await alumnosRepository()).fichaDeGrupo(id as Id);
  if (!leida.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el grupo">
        <p>{leida.error}</p>
      </Aviso>
    );
  }
  if (!leida.valor) notFound();
  const { grupo: g, planes } = leida.valor;
  const programa = await catalogoAcademico().programaPorCodigo(g.programaCodigo);
  const publicado = programa && !esPendiente(programa.costo) ? programa.costo : [];
  const referenciaDe = (paquete: Paquete | null): string | null => {
    const etiqueta = paquete ? ETIQUETA_DE_PAQUETE[paquete].toLowerCase() : null;
    const p = publicado.find((x) => (etiqueta ? x.etiqueta.toLowerCase().includes(etiqueta.replace('paquete ', '')) : true));
    return p && !esPendiente(p.monto) ? `Bs ${montoParaCampo(p.monto)}` : null;
  };
  const paquetes: readonly (Paquete | null)[] = g.programaTipo === 'carrera' ? ['economico', 'ahorrador'] : [null];

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={rutaDeGrupo(g.id)} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Volver al grupo
      </Link>
      <EncabezadoDePanel titulo="Precio del" resaltado="grupo" descripcion={g.nombre} />
      {g.estado === 'cerrado' ? (
        <Aviso tono="info" titulo="El grupo está cerrado">
          <p>Su precio ya no se puede cambiar.</p>
        </Aviso>
      ) : (
        paquetes.map((p) => (
          <FormularioDePlan
            key={p ?? 'unico'}
            grupoId={g.id}
            programaCodigo={g.programaCodigo}
            paquete={p}
            plan={planes.find((x) => x.paquete === p)}
            fechaSugerida={g.fechaInicio}
            referencia={referenciaDe(p)}
          />
        ))
      )}
    </div>
  );
}
