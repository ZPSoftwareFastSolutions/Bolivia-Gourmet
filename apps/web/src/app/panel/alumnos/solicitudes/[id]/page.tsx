/**
 * CAPA: Presentation / App — atender una solicitud del portal (§6.11).
 *
 * A la izquierda, lo que pidió el alumno y cómo contactarlo. A la derecha, el
 * formulario «Aprobar e inscribir»: grupo (primero los que coinciden con lo
 * pedido), ficha (B.8: si el alumno no tiene ficha, el personal elige entre
 * una nueva o una existente SIN cuenta; la base nunca enlaza sola), paquete,
 * requisitos y la respuesta que el alumno leerá en su portal. «Pedir más
 * datos» y «Rechazar» quedan plegados y exigen respuesta.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { describirPlan, ETIQUETA_DE_MODALIDAD, ETIQUETA_DE_TURNO, etiquetaCortaDeDias, type Modalidad, type Turno } from '@core/domain/academico/programa';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { GrupoEnLista } from '@core/application/ports/alumnos.port';
import type { Id } from '@core/domain/shared/tipos-base';
import { alumnosRepository, catalogoAcademico } from '@infra/config/composition-root';
import { formatearFecha, haceCuanto } from '@/lib/fechas';
import { RUTAS_ALUMNOS, rutaDeAlumno, rutaDeSolicitudDelPanel } from '@/lib/rutas';
import { AreaDeTexto, Aviso, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Dato, Desplegable, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { aprobarSolicitudAccion, responderSolicitudAccion } from '../../actions';
import { CasillasDeRequisitos, ETIQUETA_DE_ESTADO_DE_SOLICITUD, ETIQUETA_DE_PAQUETE, TONO_DE_SOLICITUD } from '../../_componentes';

export const metadata: Metadata = { title: 'Atender solicitud' };

function duracionEnTexto(duracion: number | null, carrera: boolean): string | null {
  if (duracion === null) return null;
  if (carrera) return `${duracion} años`;
  return duracion === 1 ? '1 mes' : `${duracion} meses`;
}

export default async function AtenderSolicitud({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await params;
  const lectura = await exigirPersonal(rutaDeSolicitudDelPanel(id));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'solicitudes.leer');

  const repo = await alumnosRepository();
  const leida = await repo.solicitud(id as Id);
  if (!leida.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir la solicitud">
        <p>{leida.error}</p>
      </Aviso>
    );
  }
  const s = leida.valor;
  if (!s) notFound();

  const [programa, fichaDelPedido] = await Promise.all([
    catalogoAcademico().programaPorCodigo(s.programaCodigo),
    s.grupoId ? repo.fichaDeGrupo(s.grupoId) : Promise.resolve(null),
  ]);
  // El grupo que eligió en el portal (ADR 0009); las solicitudes viejas no tienen.
  const grupoPedido = fichaDelPedido && fichaDelPedido.exito ? (fichaDelPedido.valor?.grupo ?? null) : null;
  const esCarrera = programa?.tipo === 'carrera';
  const abierta = s.estado === 'pendiente' || s.estado === 'en_revision';
  const puedeAtender = abierta && tienePermiso(ctx, 'solicitudes.gestionar') && tienePermiso(ctx, 'inscripciones.gestionar');
  const nombre = [s.nombres, s.apellidos].filter(Boolean).join(' ') || s.correo || 'Alumno del portal';

  let grupos: readonly GrupoEnLista[] = [];
  let sugeridas: readonly { readonly id: Id; readonly codigo: string; readonly nombre: string; readonly documento: string | null; readonly porDocumento: boolean }[] = [];
  let errorDeCarga: string | null = null;
  if (puedeAtender) {
    const sedes = new Set(ctx.sedes.map((x) => x.id));
    const [lista, fichas] = await Promise.all([
      repo.listarGrupos({ programaCodigo: s.programaCodigo, estados: ['abierto', 'en_curso'] }),
      s.fichaCodigo ? Promise.resolve(null) : repo.sugerirFichas(s.documento, s.nombres, s.apellidos),
    ]);
    if (!lista.exito) errorDeCarga = lista.error;
    else {
      const puntaje = (g: GrupoEnLista) => (g.id === s.grupoId ? 10 : 0) + (g.sedeId === s.sedeId ? 2 : 0) + (s.turno && g.turno === s.turno ? 1 : 0);
      grupos = lista.valor.filter((g) => sedes.has(g.sedeId)).sort((a, b) => puntaje(b) - puntaje(a));
    }
    if (fichas && fichas.exito) sugeridas = fichas.valor;
  }
  const respuestaSugerida = `Te damos la bienvenida a ${programa?.nombre ?? 'Bolivia Gourmet'}. Tu inscripción quedó registrada; te esperamos en la sede ${s.sedeNombre}.`;

  return (
    <div className="grid gap-6">
      <Link href={RUTAS_ALUMNOS.solicitudes} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Solicitudes
      </Link>
      <EncabezadoDePanel
        gancho={s.tipo === 'renovacion' ? 'Renovación de' : 'Solicitud de'}
        titulo={nombre}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tono={TONO_DE_SOLICITUD[s.estado]}>{ETIQUETA_DE_ESTADO_DE_SOLICITUD[s.estado]}</Chip>
            <span>Espera desde {haceCuanto(s.creadaEn)}</span>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ------------------------------------------------ lo que pidió */}
        <section aria-labelledby="pidio" className="grid content-start gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
          <h2 id="pidio" className="t-display text-2xl text-estructural">
            Lo que pidió
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Dato etiqueta="Programa">{programa?.nombre ?? s.programaCodigo}</Dato>
            {grupoPedido ? <Dato etiqueta="Grupo elegido en el portal">{grupoPedido.nombre}</Dato> : null}
            <Dato etiqueta="Sede">{s.sedeNombre}</Dato>
            {s.turno ? <Dato etiqueta="Turno">{ETIQUETA_DE_TURNO[s.turno as Turno] ?? s.turno}</Dato> : null}
            {s.dias ? <Dato etiqueta="Días">{etiquetaCortaDeDias(s.dias)}</Dato> : null}
            {s.duracion ? <Dato etiqueta="Duración">{duracionEnTexto(s.duracion, esCarrera)}</Dato> : null}
            {s.modalidad ? <Dato etiqueta="Modalidad">{ETIQUETA_DE_MODALIDAD[s.modalidad as Modalidad] ?? s.modalidad}</Dato> : null}
            {s.paquete ? <Dato etiqueta="Paquete">{ETIQUETA_DE_PAQUETE[s.paquete]}</Dato> : null}
            {s.gestionAnterior ? <Dato etiqueta="Viene de">{s.gestionAnterior}</Dato> : null}
            <Dato etiqueta="Enviada">{formatearFecha(s.creadaEn)}</Dato>
            {s.documento ? <Dato etiqueta="Carnet">{s.documento}</Dato> : null}
          </dl>
          {s.mensaje ? <blockquote className="border-s-4 border-accion ps-3 text-tinta-suave">«{s.mensaje}»</blockquote> : null}
          <div className="flex flex-wrap gap-2">
            {s.telefono ? (
              <a
                href={`https://wa.me/591${s.telefono}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-linea px-4 font-semibold text-estructural hover:border-estructural"
              >
                <Icono nombre="whatsapp" tamano={18} />
                {s.telefono}
              </a>
            ) : null}
            {s.correo ? (
              <a href={`mailto:${s.correo}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-linea px-4 font-semibold text-estructural hover:border-estructural">
                <Icono nombre="correo" tamano={18} />
                Correo
              </a>
            ) : null}
          </div>
          {s.respuesta ? (
            <p className="rounded-md bg-superficie-alterna p-3 text-sm text-tinta-suave">
              <span className="font-semibold text-tinta">Respuesta enviada: </span>
              {s.respuesta}
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------------ aprobar e inscribir */}
        {!puedeAtender ? (
          <Aviso tono="info" titulo={abierta ? 'Solo lectura' : 'Esta solicitud ya fue atendida'}>
            <p>{abierta ? 'Tu cuenta puede ver la bandeja pero no atenderla.' : `Estado: ${ETIQUETA_DE_ESTADO_DE_SOLICITUD[s.estado]}.`}</p>
            {s.fichaCodigo ? (
              <Link href={rutaDeAlumno(s.fichaCodigo)} className="enlace mt-2 inline-flex min-h-11 items-center">
                Ver la ficha del alumno
              </Link>
            ) : null}
          </Aviso>
        ) : errorDeCarga ? (
          <Aviso tono="error" titulo="No pudimos cargar los grupos">
            <p>{errorDeCarga}</p>
          </Aviso>
        ) : grupos.length === 0 ? (
          <EstadoVacio
            frase="Aún no hay grupo"
            detalle={
              tienePermiso(ctx, 'cohortes.gestionar')
                ? `No hay grupos abiertos de ${programa?.nombre ?? 'este programa'}. Abre uno y vuelve aquí.`
                : `No hay grupos abiertos de ${programa?.nombre ?? 'este programa'}. Pide a administración que abra el grupo.`
            }
            accion={
              tienePermiso(ctx, 'cohortes.gestionar') ? (
                <Link href={`${RUTAS_ALUMNOS.grupoNuevo}?programa=${s.programaCodigo}`} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion">
                  <Icono nombre="mas" tamano={20} />
                  Abrir grupo
                </Link>
              ) : undefined
            }
          />
        ) : (
          <section aria-labelledby="aprobar" className="grid content-start gap-4">
            <h2 id="aprobar" className="t-display text-2xl text-estructural">
              Aprobar e inscribir
            </h2>
            <FormularioDelPanel accion={aprobarSolicitudAccion} etiqueta="Aprobar e inscribir" className="rounded-[var(--t-radio-lg)] border-2 border-estructural/30 bg-tarjeta p-5">
              <input type="hidden" name="clave" value={randomUUID()} />
              <input type="hidden" name="solicitud" value={s.id} />
              <input type="hidden" name="esCarrera" value={esCarrera ? 'si' : 'no'} />

              <GrupoDeOpciones
                nombre="grupo"
                leyenda="Grupo"
                valor={grupos[0]?.id}
                columnas={2}
                opciones={grupos.map((g) => {
                  const libres = g.capacidad === null ? 'sin límite' : `${Math.max(0, g.capacidad - g.inscritos)} libres`;
                  const pedido = g.id === s.grupoId;
                  const coincide = g.sedeId === s.sedeId && (!s.turno || g.turno === s.turno);
                  const precio = g.precios.length > 0 ? describirPlan(g.precios[0]!) : 'precio: Consultar';
                  return { valor: g.id, etiqueta: g.nombre, detalle: `${pedido ? 'El grupo que eligió · ' : coincide ? 'Coincide con lo pedido · ' : 'Distinto de lo pedido · '}${libres} · ${precio}` };
                })}
              />

              {s.fichaCodigo ? (
                <p className="flex items-center gap-2 rounded-md bg-superficie-alterna p-3 text-tinta-suave">
                  <Icono nombre="usuario" tamano={18} />
                  Ya tiene ficha:{' '}
                  <Link href={rutaDeAlumno(s.fichaCodigo)} className="enlace">
                    {s.fichaCodigo}
                  </Link>
                </p>
              ) : (
                <GrupoDeOpciones
                  nombre="ficha"
                  leyenda="Ficha del alumno"
                  ayuda={sugeridas.length > 0 ? 'Encontramos fichas parecidas sin cuenta del portal. Si es la misma persona, elígela.' : undefined}
                  valor="nueva"
                  opciones={[
                    { valor: 'nueva', etiqueta: 'Crear ficha nueva', detalle: 'Con los datos de su cuenta del portal.' },
                    ...sugeridas.map((f) => ({
                      valor: f.id,
                      etiqueta: `Usar ${f.nombre}`,
                      detalle: `${f.codigo}${f.documento ? ` · CI ${f.documento}` : ''}${f.porDocumento ? ' · mismo carnet' : ' · nombre parecido'}`,
                    })),
                  ]}
                />
              )}

              {esCarrera ? (
                <GrupoDeOpciones
                  nombre="paquete"
                  leyenda="Paquete"
                  valor={s.paquete ?? undefined}
                  opciones={[
                    { valor: 'economico', etiqueta: ETIQUETA_DE_PAQUETE.economico },
                    { valor: 'ahorrador', etiqueta: ETIQUETA_DE_PAQUETE.ahorrador },
                  ]}
                />
              ) : null}

              <CasillasDeRequisitos requisitos={programa?.requisitos ?? []} />
              <AreaDeTexto id="respuesta" etiqueta="Respuesta para el alumno" maxLength={500} defaultValue={respuestaSugerida} ayuda="La verá en su portal. Puedes cambiarla." />
              <BotonGuardar icono="check" enviando="Inscribiendo…" className="justify-self-start">
                Aprobar e inscribir
              </BotonGuardar>
            </FormularioDelPanel>

            <Desplegable titulo="Pedir más datos" icono="info">
              <FormularioDelPanel accion={responderSolicitudAccion} etiqueta="Pedir más datos">
                <input type="hidden" name="solicitud" value={s.id} />
                <input type="hidden" name="estado" value="en_revision" />
                <AreaDeTexto id="respuesta-revision" name="respuesta" etiqueta="¿Qué datos faltan?" maxLength={500} />
                <BotonGuardar variante="secundario" icono="correo" enviando="Enviando…" className="justify-self-start">
                  Enviar al alumno
                </BotonGuardar>
              </FormularioDelPanel>
            </Desplegable>
            <Desplegable titulo="Rechazar la solicitud" icono="cerrar" peligro>
              <FormularioDelPanel accion={responderSolicitudAccion} etiqueta="Rechazar">
                <input type="hidden" name="solicitud" value={s.id} />
                <input type="hidden" name="estado" value="rechazada" />
                <AreaDeTexto id="respuesta-rechazo" name="respuesta" etiqueta="¿Por qué se rechaza?" maxLength={500} ayuda="El alumno lo verá. Sé claro y amable." />
                <BotonGuardar variante="peligro" icono="cerrar" enviando="Enviando…" className="justify-self-start">
                  Sí, rechazar
                </BotonGuardar>
              </FormularioDelPanel>
            </Desplegable>
          </section>
        )}
      </div>
    </div>
  );
}
