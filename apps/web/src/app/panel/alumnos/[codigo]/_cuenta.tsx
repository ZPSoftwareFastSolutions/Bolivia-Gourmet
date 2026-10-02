/**
 * CAPA: Presentation / App — la cuenta del alumno dentro de su ficha.
 *
 * Cuánto debe (y cuánto ya venció), sus cargos con su estado y «Cobrar».
 * Administración corrige: cargo manual (reposición de un utensilio, una
 * corrección) o anular un cargo que no tiene cobros. Todo plegado.
 */

import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { ETIQUETA_DE_ESTADO_DE_CARGO } from '@core/domain/caja/cargo';
import { tienePermiso, type ContextoDePanel } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { ConceptoDeCaja, CuentaDeAlumno } from '@core/application/ports/caja.port';
import type { InscripcionDeAlumno } from '@core/application/ports/alumnos.port';
import { RUTAS_CAJA } from '@/lib/rutas';
import { AreaDeTexto, CampoDeTexto, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Desplegable } from '@/presentation/panel/Piezas';
import { anularCargoAccion, crearCargoAccion } from '../../caja/actions';

export function CuentaDelAlumno({
  ctx,
  cuenta,
  conceptos,
  vigentes,
}: {
  readonly ctx: ContextoDePanel;
  readonly cuenta: CuentaDeAlumno;
  readonly conceptos: readonly ConceptoDeCaja[];
  readonly vigentes: readonly InscripcionDeAlumno[];
}) {
  const pendientes = cuenta.cargos.filter((c) => c.pendiente > 0);
  const corrige = tienePermiso(ctx, 'contabilidad.gestionar') || tienePermiso(ctx, 'caja.anular');
  return (
    <section aria-labelledby="cuenta" className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cuenta" className="t-display text-3xl text-estructural">
          Cuenta
        </h2>
        {cuenta.totalPendiente > 0 && tienePermiso(ctx, 'caja.cobrar') ? (
          <Link
            href={`${RUTAS_CAJA.cobrar}?alumno=${encodeURIComponent(cuenta.codigo)}`}
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion hover:bg-accion-fuerte"
          >
            <Icono nombre="monedas" tamano={20} />
            Cobrar
          </Link>
        ) : null}
      </div>
      {cuenta.totalPendiente > 0 ? (
        <p className="text-lg">
          Debe <strong className="t-display text-3xl text-estructural">{formatearMontoExacto(cuenta.totalPendiente)}</strong>
          {cuenta.totalVencido > 0 ? <span className="ms-2 font-semibold text-peligro">· vencido {formatearMontoExacto(cuenta.totalVencido)}</span> : null}
        </p>
      ) : (
        <p>
          <Chip tono="verde" icono="check">
            Al día
          </Chip>
        </p>
      )}
      {cuenta.cargos.length > 0 ? (
        <ul className="grid gap-2">
          {cuenta.cargos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linea p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-tinta">{c.descripcion}</span>
                <span className={c.vencido ? 'text-sm font-semibold text-peligro' : 'text-sm text-tinta-suave'}>
                  {c.vencido ? `Vencido hace ${c.diasDeAtraso} ${c.diasDeAtraso === 1 ? 'día' : 'días'}` : `Vence el ${c.venceEl.split('-').reverse().join('/')}`}
                </span>
              </span>
              <Chip tono={c.estado === 'pagado' ? 'verde' : c.estado === 'parcial' ? 'amarillo' : 'gris'}>{ETIQUETA_DE_ESTADO_DE_CARGO[c.estado]}</Chip>
              <span className="font-bold text-estructural">{c.pendiente > 0 ? formatearMontoExacto(c.pendiente) : formatearMontoExacto(c.monto)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-tinta-suave">Sin cargos todavía.</p>
      )}

      {corrige ? (
        <div className="grid gap-3">
          {tienePermiso(ctx, 'contabilidad.gestionar') ? (
            <Desplegable titulo="Agregar un cargo" icono="mas">
              <FormularioDelPanel accion={crearCargoAccion} etiqueta="Agregar un cargo">
                <input type="hidden" name="clave" value={randomUUID()} />
                <input type="hidden" name="alumno" value={cuenta.estudianteId} />
                <input type="hidden" name="codigo" value={cuenta.codigo} />
                <GrupoDeOpciones nombre="concepto" leyenda="Concepto" valor={conceptos[0]?.id} opciones={conceptos.map((k) => ({ valor: k.id, etiqueta: k.nombre }))} />
                {vigentes.length > 0 ? (
                  <GrupoDeOpciones
                    nombre="inscripcion"
                    leyenda="¿De qué inscripción?"
                    valor=""
                    opciones={[{ valor: '', etiqueta: 'De ninguna en particular' }, ...vigentes.map((i) => ({ valor: i.id, etiqueta: i.grupoNombre }))]}
                  />
                ) : null}
                <div className="grid gap-5 sm:grid-cols-2">
                  <CampoDeTexto id="descripcion" etiqueta="Detalle" maxLength={200} ayuda="Por ejemplo: «Reposición de cuchillo perdido»." />
                  <CampoDeTexto id="monto" etiqueta="Monto (Bs)" inputMode="decimal" maxLength={14} />
                  <CampoDeTexto id="venceEl" etiqueta="Vence el" opcional type="date" ayuda="Vacío = hoy." />
                </div>
                <BotonGuardar icono="mas" className="justify-self-start">
                  Agregar cargo
                </BotonGuardar>
              </FormularioDelPanel>
            </Desplegable>
          ) : null}
          {tienePermiso(ctx, 'caja.anular') && pendientes.length > 0 ? (
            <Desplegable titulo="Anular un cargo" icono="papelera" peligro>
              <FormularioDelPanel accion={anularCargoAccion} etiqueta="Anular un cargo">
                <input type="hidden" name="clave" value={randomUUID()} />
                <input type="hidden" name="codigo" value={cuenta.codigo} />
                <GrupoDeOpciones
                  nombre="cargo"
                  leyenda="¿Qué cargo?"
                  opciones={pendientes.map((c) => ({ valor: c.id, etiqueta: c.descripcion, detalle: `Debe ${formatearMontoExacto(c.pendiente)}` }))}
                />
                <p className="text-sm text-tinta-suave">Solo se anula un cargo sin cobros. Si ya pagó una parte, anula primero ese cobro.</p>
                <AreaDeTexto id="motivo-cargo" name="motivo" etiqueta="¿Por qué se anula?" maxLength={300} />
                <BotonGuardar variante="peligro" icono="papelera" enviando="Anulando…" className="justify-self-start">
                  Sí, anular el cargo
                </BotonGuardar>
              </FormularioDelPanel>
            </Desplegable>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
