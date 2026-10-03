/**
 * CAPA: Presentation / App — Préstamos (especificación §6.6 y §7.5).
 *
 * Los atrasados primero, en rojo con reloj y la palabra «Atrasado». En cada
 * préstamo: ¿cuántos volvieron? y ¿falta o volvió roto alguno? (con motivo).
 * Lo que no vuelve sale del inventario como baja en el mismo acto.
 */

import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import type { PrestamoAbierto } from '@core/application/ports/inventario.port';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { inventarioRepository } from '@infra/config/composition-root';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso, CLASE_DE_CAMPO, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Desplegable, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, type Parametros } from '../../caja/_componentes';
import { recibirPrestamoAccion } from '../actions';
import { ConfirmacionDeOperacion, EnlaceDeAccion, InsigniaDeArticulo, PestanasDeInventario } from '../_componentes';

export const metadata: Metadata = { title: 'Préstamos' };

function ChipDeDevolucion({ p, hoy }: { readonly p: PrestamoAbierto; readonly hoy: string }) {
  if (p.atrasado) {
    return (
      <Chip tono="rojo" icono="reloj">
        Atrasado {p.diasDeAtraso === 1 ? '1 día' : `${p.diasDeAtraso} días`}
      </Chip>
    );
  }
  if (p.devolverEl === hoy) {
    return (
      <Chip tono="amarillo" icono="reloj">
        Hoy
      </Chip>
    );
  }
  return (
    <Chip tono="gris" icono="calendario">
      Hasta el {formatearDiaCorto(p.devolverEl)}
    </Chip>
  );
}

export default async function Prestamos({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.prestamos), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.leer');
  const repo = await inventarioRepository();
  const lista = await repo.prestamosAbiertos({});
  const recibido = parametro(valores, 'recibido');
  const puedeRecibir = tienePermiso(ctx, 'inventario.operar');
  const ordenados = lista.exito ? [...lista.valor].sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || a.devolverEl.localeCompare(b.devolverEl)) : [];
  const operables = new Set(ctx.sedes.map((s) => s.id as string));

  return (
    <div className="grid gap-6">
      {recibido ? (
        <ConfirmacionDeOperacion
          repo={repo}
          operacionId={recibido}
          palabra="¡Recibido!"
          titulo="Lo que volvió ya está en el estante."
          conValor={false}
          cerrarHref={RUTAS_INVENTARIO.prestamos}
        >
          <p>Si algo faltó, salió del inventario como baja. Si el instituto cobra la reposición, administración agrega un cargo en la ficha del alumno.</p>
        </ConfirmacionDeOperacion>
      ) : null}
      <EncabezadoDePanel
        titulo="Préstamos"
        descripcion="Lo que está fuera del estante. Los atrasados, primero."
        acciones={
          puedeRecibir ? (
            <EnlaceDeAccion href={RUTAS_INVENTARIO.prestar} icono="cubiertos">
              Prestar
            </EnlaceDeAccion>
          ) : null
        }
      />
      <PestanasDeInventario activa="prestamos" />
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los préstamos">
          <p>{lista.error}</p>
        </Aviso>
      ) : ordenados.length === 0 ? (
        <EstadoVacio frase="Todo en su lugar" detalle="No hay utensilios prestados en este momento." />
      ) : (
        <ul className="grid gap-3">
          {ordenados.map((p) => (
            <li key={p.id} className={p.atrasado ? 'rounded-[var(--t-radio-lg)] border-2 border-peligro/50 bg-tarjeta p-4' : 'rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4'}>
              <div className="flex flex-wrap items-center gap-3">
                <InsigniaDeArticulo icono={p.icono} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-estructural">
                    {p.destinatario}
                    {p.estudianteCodigo ? <span className="font-normal text-tinta-suave"> · {p.estudianteCodigo}</span> : null}
                  </span>
                  <span className="text-sm text-tinta">
                    {p.articuloNombre}: {p.pendiente === 1 ? '1 pieza' : `${p.pendiente} piezas`} por devolver · {p.sedeNombre}
                  </span>
                </span>
                <ChipDeDevolucion p={p} hoy={ctx.hoy} />
                {p.telefono ? (
                  <a
                    href={`https://wa.me/591${p.telefono}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold text-estructural hover:bg-superficie-alterna"
                  >
                    <Icono nombre="whatsapp" tamano={18} />
                    WhatsApp
                  </a>
                ) : null}
              </div>
              {puedeRecibir && operables.has(p.sedeId) ? (
                <div className="mt-3">
                  <Desplegable titulo="Recibir devolución" icono="renovar">
                    <FormularioDelPanel accion={recibirPrestamoAccion} etiqueta={`Recibir ${p.articuloNombre} de ${p.destinatario}`}>
                      <input type="hidden" name="clave" value={randomUUID()} />
                      <input type="hidden" name="prestamo" value={p.id} />
                      <input type="hidden" name="nombre" value={p.articuloNombre} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="font-semibold text-tinta">¿Cuántos volvieron bien?</span>
                          <input name="devueltos" inputMode="numeric" defaultValue={String(p.pendiente)} autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-semibold text-tinta">¿Cuántos faltan o volvieron rotos?</span>
                          <input name="perdidos" inputMode="numeric" defaultValue="0" autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
                        </label>
                      </div>
                      <GrupoDeOpciones
                        nombre="motivoBaja"
                        leyenda="Lo que falta…"
                        valor="perdida"
                        opciones={[
                          { valor: 'perdida', etiqueta: 'Se perdió' },
                          { valor: 'rotura', etiqueta: 'Se rompió' },
                        ]}
                      />
                      <label className="grid gap-1">
                        <span className="font-semibold text-tinta">¿Qué pasó? (si falta algo)</span>
                        <input name="motivo" maxLength={300} autoComplete="off" className={CLASE_DE_CAMPO} />
                      </label>
                      <div>
                        <BotonGuardar icono="check" enviando="Recibiendo…">
                          Recibir
                        </BotonGuardar>
                      </div>
                    </FormularioDelPanel>
                  </Desplegable>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
