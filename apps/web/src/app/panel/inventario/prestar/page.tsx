/**
 * CAPA: Presentation / App — Prestar utensilios (especificación §6.5).
 *
 * ¿A quién? (un alumno por su código, un grupo para la clase u otra persona,
 * como un docente), ¿qué? (cada utensilio con lo que hay en el estante) y
 * ¿hasta cuándo? (hoy por defecto). Prestar no cambia el valor: los
 * utensilios siguen siendo del instituto.
 */

import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso, CampoDeTexto, CLASE_DE_CAMPO, Etiquetado, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, type Parametros } from '../../caja/_componentes';
import { prestarAccion } from '../actions';
import { ConfirmacionDeOperacion, ElegirSede, EnlaceDeAccion, InsigniaDeArticulo } from '../_componentes';

export const metadata: Metadata = { title: 'Prestar utensilios' };

function Paso({ numero, titulo }: { readonly numero: number; readonly titulo: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold text-estructural">
      <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sobre-estructural">{numero}</span>
      {titulo}
    </h2>
  );
}

export default async function Prestar({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.prestar), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.operar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const repo = await inventarioRepository();
  const hecho = parametro(valores, 'hecho');

  if (hecho) {
    return (
      <ConfirmacionDeOperacion
        repo={repo}
        operacionId={hecho}
        palabra="¡Prestado!"
        titulo="Los utensilios salieron del estante y quedan como prestados."
        conValor={false}
        cerrarHref={RUTAS_INVENTARIO.prestar}
        acciones={
          <>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.prestamos} icono="reloj">
              Ver préstamos
            </EnlaceDeAccion>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.prestar} icono="cubiertos" variante="suave">
              Prestar otra vez
            </EnlaceDeAccion>
          </>
        }
      />
    );
  }

  if (!sede) return <EstadoVacio frase="Sin sede" detalle="Pide a administración que te asigne una sede." />;
  const [utensilios, grupos] = await Promise.all([repo.existencias({ tipo: 'utensilio' }), repo.gruposParaUso(sede.id)]);
  const alumno = parametro(valores, 'alumno').toUpperCase();

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Prestar" resaltado="utensilios" descripcion={`Sede ${sede.nombre}. Siguen siendo del instituto: vuelven al estante cuando los devuelven.`} />
      <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.prestar} consulta={alumno ? `alumno=${encodeURIComponent(alumno)}` : ''} />
      {!utensilios.exito || !grupos.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los utensilios">
          <p>{!utensilios.exito ? utensilios.error : !grupos.exito ? grupos.error : ''}</p>
        </Aviso>
      ) : utensilios.valor.length === 0 ? (
        <EstadoVacio frase="Aún no hay utensilios" detalle="Administración los agrega al inventario y registra lo que hay." />
      ) : (
        <FormularioDelPanel accion={prestarAccion} etiqueta="Prestar utensilios">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={1} titulo="¿A quién?" />
            <GrupoDeOpciones
              nombre="destino"
              leyenda="Se presta a"
              columnas={3}
              valor={alumno ? 'alumno' : 'grupo'}
              opciones={[
                { valor: 'alumno', etiqueta: 'Un alumno', detalle: 'Por su código' },
                { valor: 'grupo', etiqueta: 'Un grupo', detalle: 'Para la clase' },
                { valor: 'persona', etiqueta: 'Otra persona', detalle: 'Un docente, por su nombre' },
              ]}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <CampoDeTexto id="alumno" etiqueta="Código del alumno" opcional defaultValue={alumno} autoComplete="off" placeholder="BG-2026-0001" />
              <Etiquetado id="grupo" etiqueta="Grupo" opcional>
                <select id="grupo" name="grupo" className={CLASE_DE_CAMPO} defaultValue="">
                  <option value="">— Elige el grupo —</option>
                  {grupos.valor.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </select>
              </Etiquetado>
              <CampoDeTexto id="persona" etiqueta="Nombre de la persona" opcional maxLength={120} autoComplete="off" />
            </div>
          </section>

          <section className="grid gap-3 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={2} titulo="¿Qué se presta?" />
            <ul className="grid gap-2">
              {utensilios.valor.map((u) => {
                const v = u.variantes[0];
                const s = v?.sedes.find((x) => x.sedeId === sede.id);
                if (!v || !s) return null;
                const hay = Number(s.disponible / 1000n);
                const id = `cantidad-${v.id}`;
                return (
                  <li key={u.id} className={cn('grid gap-3 rounded-md border-2 border-linea p-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center', hay === 0 && 'opacity-70')}>
                    <input type="hidden" name={`nombre-${v.id}`} value={u.nombre} />
                    <span className="flex items-center gap-3">
                      <InsigniaDeArticulo icono={u.icono} />
                      <span>
                        <label htmlFor={id} className="block font-semibold text-tinta">
                          {u.nombre}
                        </label>
                        <span className="text-sm text-tinta-suave">
                          {hay === 0 ? 'No queda en el estante' : `En el estante: ${hay}`}
                          {s.prestado > 0n ? ` · prestados: ${Number(s.prestado / 1000n)}` : ''}
                        </span>
                      </span>
                    </span>
                    <input id={id} name={id} inputMode="numeric" autoComplete="off" disabled={hay === 0} placeholder="0" className={`${CLASE_DE_CAMPO} text-right`} />
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={3} titulo="¿Hasta cuándo?" />
            <CampoDeTexto id="devolverEl" etiqueta="Devolver el" type="date" defaultValue={ctx.hoy} min={ctx.hoy} className="max-w-56" ayuda="Por defecto, hoy al terminar la clase." />
          </section>

          <div>
            <BotonGuardar icono="cubiertos" enviando="Prestando…">
              Prestar
            </BotonGuardar>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}
