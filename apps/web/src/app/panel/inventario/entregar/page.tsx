/**
 * CAPA: Presentation / App — Entregar uniforme (especificación §6.3).
 *
 * Sin alumno elegido: la lista «Alumnos de carrera sin uniforme» y un
 * buscador por código. Con alumno: la talla en botones grandes («quedan 4»;
 * la agotada no se puede elegir y avisa si la otra sede tiene), cargar el
 * precio a su cuenta y, si paga en el acto, cómo. La confirmación muestra el
 * saldo «antes → ahora» y el recibo si se cobró.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import type { ArticuloConExistencias } from '@core/application/ports/inventario.port';
import { ETIQUETA_DE_MEDIO } from '@core/domain/caja/cobro';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos } from '@core/domain/shared/tipos-base';
import { alumnosRepository, inventarioRepository } from '@infra/config/composition-root';
import { RUTAS_INVENTARIO, rutaDeAlumno, rutaDeRecibo } from '@/lib/rutas';
import { Aviso, CampoDeTexto, CLASE_DE_CAMPO, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, type Parametros } from '../../caja/_componentes';
import { entregarAccion } from '../actions';
import { ConfirmacionDeOperacion, ElegirSede, EnlaceDeAccion } from '../_componentes';

export const metadata: Metadata = { title: 'Entregar uniforme' };

function Paso({ numero, titulo }: { readonly numero: number; readonly titulo: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold text-estructural">
      <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sobre-estructural">{numero}</span>
      {titulo}
    </h2>
  );
}

export default async function EntregarUniforme({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.entregar), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.operar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const repo = await inventarioRepository();
  const codigo = parametro(valores, 'alumno').toUpperCase();
  const hecho = parametro(valores, 'hecho');

  if (hecho) {
    const pago = parametro(valores, 'pago');
    const cargado = Number.parseInt(parametro(valores, 'cargado'), 10);
    return (
      <ConfirmacionDeOperacion
        repo={repo}
        operacionId={hecho}
        palabra="¡Entregado!"
        titulo={
          Number.isFinite(cargado) && cargado > 0
            ? `Se cargó ${formatearMontoExacto(cargado as Centavos)} a su cuenta${pago ? ' y se cobró' : ''}.`
            : 'Se entregó sin cargo.'
        }
        conValor={false}
        cerrarHref={RUTAS_INVENTARIO.entregar}
        acciones={
          <>
            {pago ? (
              <EnlaceDeAccion href={rutaDeRecibo(pago)} icono="recibo">
                Ver el recibo
              </EnlaceDeAccion>
            ) : null}
            {codigo ? (
              <EnlaceDeAccion href={rutaDeAlumno(codigo)} icono="usuario" variante={pago ? 'suave' : 'primario'}>
                Ver la ficha del alumno
              </EnlaceDeAccion>
            ) : null}
            <EnlaceDeAccion href={RUTAS_INVENTARIO.entregar} icono="chaqueta" variante="suave">
              Entregar otro
            </EnlaceDeAccion>
          </>
        }
      />
    );
  }

  if (!sede) return <EstadoVacio frase="Sin sede" detalle="Pide a administración que te asigne una sede." />;

  if (!codigo) {
    const pendientes = await repo.sinUniforme(ctx.sedes.length > 1 ? undefined : sede.id);
    return (
      <div className="grid gap-6">
        <EncabezadoDePanel titulo="Entregar" resaltado="uniforme" descripcion="Elige al alumno. Arriba, los de la carrera que aún no lo recibieron." />
        <form method="get" action={RUTAS_INVENTARIO.entregar} className="flex flex-wrap items-end gap-3 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4">
          <label className="grid flex-1 gap-1">
            <span className="font-semibold text-tinta">Código del alumno</span>
            <input name="alumno" autoComplete="off" placeholder="BG-2026-0001" className={CLASE_DE_CAMPO} />
          </label>
          <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-estructural px-5 font-bold text-sobre-estructural hover:bg-estructural-profundo">
            <Icono nombre="buscar" tamano={20} />
            Buscar
          </button>
        </form>
        <section aria-labelledby="sin-uniforme" className="grid gap-3">
          <h2 id="sin-uniforme" className="t-display text-3xl text-estructural">
            De la carrera, sin uniforme
          </h2>
          {!pendientes.exito ? (
            <Aviso tono="error" titulo="No pudimos cargar la lista">
              <p>{pendientes.error}</p>
            </Aviso>
          ) : pendientes.valor.length === 0 ? (
            <EstadoVacio frase="¡Todos con uniforme!" detalle="Cada alumno inscrito en la carrera ya tiene el suyo." />
          ) : (
            <ul className="grid gap-2">
              {pendientes.valor.map((p) => (
                <li key={p.inscripcionId} className="flex flex-wrap items-center gap-3 rounded-md border border-linea bg-tarjeta p-3">
                  <Iniciales nombres={p.nombres} apellidos={p.apellidos} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-tinta">
                      {p.nombres} {p.apellidos}
                    </span>
                    <span className="text-sm text-tinta-suave">
                      {p.codigo} · {p.grupoNombre}
                    </span>
                  </span>
                  <Link
                    href={`${RUTAS_INVENTARIO.entregar}?alumno=${encodeURIComponent(p.codigo)}&inscripcion=${p.inscripcionId}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accion px-4 font-bold text-sobre-accion hover:bg-accion-fuerte"
                  >
                    <Icono nombre="chaqueta" tamano={18} />
                    Entregar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const [ficha, uniformes] = await Promise.all([(await alumnosRepository()).fichaDeAlumno(codigo), repo.existencias({ tipo: 'uniforme' })]);
  if (!ficha.exito || !uniformes.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos preparar la entrega">
        <p>{!ficha.exito ? ficha.error : !uniformes.exito ? uniformes.error : ''}</p>
      </Aviso>
    );
  }
  const a = ficha.valor;
  if (!a) {
    return (
      <EstadoVacio
        frase="No encontramos ese código"
        detalle={`Revisa el código ${codigo} en la ficha del alumno.`}
        accion={
          <Link href={RUTAS_INVENTARIO.entregar} className="enlace font-semibold">
            Buscar de nuevo
          </Link>
        }
      />
    );
  }
  const vigentes = a.inscripciones.filter((i) => i.estado === 'inscrito');
  const elegida = vigentes.find((i) => i.id === parametro(valores, 'inscripcion')) ?? vigentes.find((i) => i.programaTipo === 'carrera') ?? vigentes[0];
  const puedeCobrar = tienePermiso(ctx, 'caja.cobrar');

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Entregar" resaltado="uniforme" descripcion={`Sede ${sede.nombre}.`} />
      <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.entregar} consulta={`alumno=${encodeURIComponent(a.codigo)}`} />
      <div className="flex items-center gap-3 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4">
        <Iniciales nombres={a.nombres} apellidos={a.apellidos} />
        <span className="min-w-0">
          <span className="block font-bold text-estructural">
            {a.nombres} {a.apellidos}
          </span>
          <span className="text-sm text-tinta-suave">{a.codigo}</span>
        </span>
      </div>
      {!elegida ? (
        <Aviso tono="info" titulo="Sin inscripción vigente">
          <p>El uniforme se entrega a quien está inscrito. Inscríbelo primero.</p>
        </Aviso>
      ) : uniformes.valor.length === 0 ? (
        <EstadoVacio frase="Aún no hay uniformes" detalle="Administración agrega el juego de uniforme al inventario y registra la compra." />
      ) : (
        <FormularioDelPanel accion={entregarAccion} etiqueta="Entregar el uniforme">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />
          <input type="hidden" name="alumno" value={a.codigo} />
          {vigentes.length > 1 ? (
            <GrupoDeOpciones
              nombre="inscripcion"
              leyenda="¿Para qué inscripción?"
              valor={elegida.id}
              opciones={vigentes.map((i) => ({ valor: i.id, etiqueta: i.grupoNombre }))}
            />
          ) : (
            <input type="hidden" name="inscripcion" value={elegida.id} />
          )}

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={1} titulo="¿Qué talla?" />
            {uniformes.valor.map((u) => (
              <Tallas key={u.id} uniforme={u} sedeId={sede.id} />
            ))}
            <label className="grid max-w-40 gap-1">
              <span className="font-semibold text-tinta">Cuántos juegos</span>
              <input name="cantidad" inputMode="numeric" defaultValue="1" autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
            </label>
            <GrupoDeOpciones
              nombre="contexto"
              leyenda="¿Por qué se entrega?"
              columnas={3}
              valor="inscripcion"
              opciones={[
                { valor: 'inscripcion', etiqueta: 'Por su inscripción' },
                { valor: 'reposicion', etiqueta: 'Reposición', detalle: 'Se le dañó o lo perdió' },
                { valor: 'otro', etiqueta: 'Otro', detalle: 'Cuéntalo abajo' },
              ]}
            />
            <CampoDeTexto id="detalle" etiqueta="Detalle" opcional maxLength={300} autoComplete="off" />
          </section>

          {puedeCobrar ? (
            <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
              <Paso numero={2} titulo="¿Se cobra?" />
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-2 border-linea p-3 has-[:checked]:border-estructural">
                <input type="checkbox" name="cargar" value="si" defaultChecked className="size-5 accent-[var(--t-estructural)]" />
                <span>
                  <span className="block font-semibold text-tinta">Cargar el precio a su cuenta</span>
                  <span className="text-sm text-tinta-suave">Si el uniforme aún no tiene precio, desmárcalo: se entrega sin cargo.</span>
                </span>
              </label>
              <GrupoDeOpciones
                nombre="cobro"
                leyenda="¿Paga ahora?"
                columnas={2}
                valor="pendiente"
                opciones={[
                  { valor: 'pendiente', etiqueta: 'Queda pendiente', detalle: 'Se cobra después desde Caja' },
                  { valor: 'efectivo', etiqueta: ETIQUETA_DE_MEDIO.efectivo },
                  { valor: 'qr', etiqueta: ETIQUETA_DE_MEDIO.qr, detalle: 'Pide el número de operación' },
                  { valor: 'transferencia', etiqueta: ETIQUETA_DE_MEDIO.transferencia, detalle: 'Pide el número de operación' },
                ]}
              />
              <CampoDeTexto id="referencia" etiqueta="Número de operación" opcional maxLength={60} autoComplete="off" ayuda="Solo para QR o transferencia." />
            </section>
          ) : (
            <input type="hidden" name="cargar" value="" />
          )}

          <div>
            <BotonGuardar icono="chaqueta" enviando="Entregando…">
              Entregar
            </BotonGuardar>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}

/** Tallas de un uniforme como tarjetas: «quedan 4»; la agotada no se elige y dice si la otra sede tiene. */
function Tallas({ uniforme: u, sedeId }: { readonly uniforme: ArticuloConExistencias; readonly sedeId: string }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-tinta">
        {u.nombre} · {u.precioVenta ? formatearMontoExacto(u.precioVenta) : 'Precio por definir'}
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {u.variantes.map((v) => {
          const aqui = v.sedes.find((s) => s.sedeId === sedeId)?.disponible ?? 0n;
          const otra = v.sedes.find((s) => s.sedeId !== sedeId && s.disponible > 0n);
          const hay = Number(aqui / 1000n);
          return (
            <label
              key={v.id}
              className="grid min-h-20 cursor-pointer place-items-center gap-0.5 rounded-md border-2 border-linea bg-tarjeta p-3 text-center has-[:checked]:border-estructural has-[:checked]:bg-superficie-alterna has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accion/60"
            >
              <input type="radio" name="variante" value={v.id} disabled={hay === 0} className="sr-only" />
              <span className="t-display text-3xl leading-none text-estructural">{v.etiqueta}</span>
              <span className="text-sm text-tinta-suave">
                {hay === 0 ? (otra ? `Agotada · en ${otra.sedeNombre} hay ${Number(otra.disponible / 1000n)}` : 'Agotada') : hay === 1 ? 'Queda 1' : `Quedan ${hay}`}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
