/**
 * CAPA: Presentation / App — «Uniforme y préstamos» en la ficha del alumno
 * (especificación §6.3–6.6).
 *
 * Lo que tiene en su poder (talla, desde cuándo y por qué) con «Cambiar
 * talla o devolver» plegado, y lo que tiene prestado con su fecha. Las
 * entregas no se anulan: se devuelven, y la historia queda completa. Cuando
 * el alumno devuelve todas las piezas de una entrega, contando las tallas
 * por las que la cambió, la base anula el cargo que no se cobró y la
 * confirmación lo dice (o pide anular el cobro y después el cargo; enmiendas
 * B.12, crítica 14).
 */

import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { fraseDelCargoDevuelto } from '@core/application/panel/inventario/inventario.usecase';
import type { ContextoDeEntrega } from '@core/application/ports/inventario.port';
import { tienePermiso, type ContextoDePanel } from '@core/domain/identidad/contexto-de-panel';
import type { Id } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_INVENTARIO, rutaDeAlumno } from '@/lib/rutas';
import { Aviso, CLASE_DE_CAMPO } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Desplegable } from '@/presentation/panel/Piezas';
import { devolverUniformeAccion } from '../../inventario/actions';
import { ConfirmacionDeOperacion } from '../../inventario/_componentes';

const POR_QUE: Record<ContextoDeEntrega, string> = {
  inscripcion: 'por su inscripción',
  reposicion: 'reposición',
  cambio_de_talla: 'cambio de talla',
  otro: 'otro motivo',
};

export async function UniformeYPrestamos({
  ctx,
  estudianteId,
  codigo,
  tieneInscripcion,
  confirmar,
  cargoDevuelto,
}: {
  readonly ctx: ContextoDePanel;
  readonly estudianteId: Id;
  readonly codigo: string;
  readonly tieneInscripcion: boolean;
  /** Clave de una devolución recién guardada (para confirmarla). */
  readonly confirmar: string;
  /** Qué pasó con el cargo en esa devolución, tal como llegó en la dirección (se valida al leerlo). */
  readonly cargoDevuelto: { readonly estado: string; readonly monto: string };
}) {
  const repo = await inventarioRepository();
  const [entregas, prestamos, uniformes] = await Promise.all([repo.entregas(estudianteId), repo.prestamosAbiertos({ estudianteId }), repo.existencias({ tipo: 'uniforme' })]);
  const puedeOperar = tienePermiso(ctx, 'inventario.operar');
  const operables = new Set(ctx.sedes.map((s) => s.id as string));
  const aqui = rutaDeAlumno(codigo);
  const fraseDelCargo = fraseDelCargoDevuelto(cargoDevuelto.estado, cargoDevuelto.monto);

  return (
    <section aria-labelledby="uniforme" className="grid gap-4">
      {confirmar ? (
        <ConfirmacionDeOperacion repo={repo} operacionId={confirmar} palabra="¡Listo!" titulo="Se registró la devolución." conValor={false} cerrarHref={aqui}>
          {fraseDelCargo ? <p className={cargoDevuelto.estado === 'cobrado' ? 'font-semibold text-tinta' : undefined}>{fraseDelCargo}</p> : null}
        </ConfirmacionDeOperacion>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="uniforme" className="t-display text-3xl text-estructural">
          Uniforme y préstamos
        </h2>
        {puedeOperar ? (
          <div className="flex flex-wrap gap-2">
            {tieneInscripcion ? (
              <Link href={`${RUTAS_INVENTARIO.entregar}?alumno=${encodeURIComponent(codigo)}`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-estructural px-4 font-semibold text-sobre-estructural hover:bg-estructural-profundo">
                <Icono nombre="chaqueta" tamano={18} />
                Entregar uniforme
              </Link>
            ) : null}
            <Link href={`${RUTAS_INVENTARIO.prestar}?alumno=${encodeURIComponent(codigo)}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-linea bg-tarjeta px-4 font-semibold text-estructural hover:border-estructural">
              <Icono nombre="cubiertos" tamano={18} />
              Prestar
            </Link>
          </div>
        ) : null}
      </div>
      {!entregas.exito || !prestamos.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el uniforme y los préstamos">
          <p>{!entregas.exito ? entregas.error : !prestamos.exito ? prestamos.error : ''}</p>
        </Aviso>
      ) : entregas.valor.length === 0 && prestamos.valor.length === 0 ? (
        <p className="text-tinta-suave">Todavía no recibió uniforme ni tiene nada prestado.</p>
      ) : (
        <ul className="grid gap-2">
          {entregas.valor.map((e) => {
            const otras = uniformes.exito ? (uniformes.valor.find((u) => u.id === e.articuloId)?.variantes.filter((v) => v.id !== e.varianteId) ?? []) : [];
            return (
              <li key={e.id} className="grid gap-3 rounded-md border border-linea bg-tarjeta p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Icono nombre="chaqueta" tamano={22} className="text-estructural" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-tinta">
                      {e.articuloNombre}
                      {e.etiqueta !== 'Única' ? ` · talla ${e.etiqueta}` : ''}
                    </span>
                    <span className="text-sm text-tinta-suave">
                      Entregado el {formatearDiaCorto(e.fecha)} ({POR_QUE[e.contexto]}) · {e.sedeNombre}
                    </span>
                  </span>
                  {e.enPoder > 0 ? (
                    <Chip tono="verde" icono="check">
                      {e.enPoder === 1 ? 'Lo tiene' : `Tiene ${e.enPoder}`}
                    </Chip>
                  ) : (
                    <Chip tono="gris">Devuelto</Chip>
                  )}
                </div>
                {e.enPoder > 0 && puedeOperar && operables.has(e.sedeId) ? (
                  <Desplegable titulo="Cambiar talla o recibir devolución" icono="intercambio">
                    <FormularioDelPanel accion={devolverUniformeAccion} etiqueta={`Cambiar o devolver ${e.articuloNombre}`}>
                      <input type="hidden" name="clave" value={randomUUID()} />
                      <input type="hidden" name="entrega" value={e.id} />
                      <input type="hidden" name="alumno" value={codigo} />
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                        <label className="grid gap-1">
                          <span className="font-semibold text-tinta">¿Qué hacemos?</span>
                          <select name="cambiarPor" className={CLASE_DE_CAMPO} defaultValue={otras[0]?.id ?? ''}>
                            {otras.map((v) => (
                              <option key={v.id} value={v.id}>
                                Cambiar por la talla {v.etiqueta}
                              </option>
                            ))}
                            <option value="">Solo recibir la devolución</option>
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="font-semibold text-tinta">Piezas</span>
                          <input name="cantidad" inputMode="numeric" defaultValue="1" autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="font-semibold text-tinta">¿Por qué?</span>
                        <input name="motivo" maxLength={300} autoComplete="off" placeholder="Le queda grande" className={CLASE_DE_CAMPO} />
                      </label>
                      <p className="text-sm text-tinta-suave">
                        El cambio de talla no se cobra de nuevo. Si devuelve todo, aunque haya cambiado de talla, su cargo se anula solo; si ya se le cobró, administración tiene que anular el cobro y después el cargo.
                      </p>
                      <div>
                        <BotonGuardar icono="intercambio" enviando="Guardando…">
                          Guardar
                        </BotonGuardar>
                      </div>
                    </FormularioDelPanel>
                  </Desplegable>
                ) : null}
              </li>
            );
          })}
          {prestamos.valor.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linea bg-tarjeta p-3">
              <Icono nombre="cubiertos" tamano={22} className="text-estructural" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-tinta">
                  Prestado: {p.articuloNombre} ({p.pendiente === 1 ? '1 pieza' : `${p.pendiente} piezas`})
                </span>
                <span className="text-sm text-tinta-suave">
                  Desde el {formatearDiaCorto(p.fecha)} · devolver el {formatearDiaCorto(p.devolverEl)}
                </span>
              </span>
              {p.atrasado ? (
                <Chip tono="rojo" icono="reloj">
                  Atrasado
                </Chip>
              ) : null}
              <Link href={RUTAS_INVENTARIO.prestamos} className="enlace inline-flex min-h-11 items-center font-semibold">
                Recibir
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
