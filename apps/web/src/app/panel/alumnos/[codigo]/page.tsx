/**
 * CAPA: Presentation / App — ficha del alumno.
 *
 * Arriba, quién es (nombre grande, carnet, celular con WhatsApp, código y
 * sede). Debajo, sus inscripciones con lo que se puede hacer en cada una:
 * renovar al año siguiente, marcar requisitos, retirar. Lo irreversible
 * (retirar, archivar) queda plegado y pide motivo. Después de cada acción, la
 * página muestra el sello de confirmación con lo que cambió.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { InscripcionDeAlumno } from '@core/application/ports/alumnos.port';
import { alumnosRepository, cajaRepository, catalogoAcademico } from '@infra/config/composition-root';
import { formatearFecha } from '@/lib/fechas';
import { RUTAS_ALUMNOS, RUTAS_PANEL, rutaDeAlumno, rutaDeGrupo } from '@/lib/rutas';
import { AreaDeTexto, Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Chip, Confirmacion, Dato, Desplegable, EncabezadoDePanel, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { archivarAlumnoAccion, cambiarEstadoAccion, guardarRequisitosAccion } from '../actions';
import { CasillasDeRequisitos, ChipDeInscripcion, ETIQUETA_DE_PAQUETE, parametro, type Parametros } from '../_componentes';
import { CuentaDelAlumno } from './_cuenta';
import { UniformeYPrestamos } from './_uniforme';

export const metadata: Metadata = { title: 'Ficha del alumno' };

type Props = { readonly params: Promise<{ readonly codigo: string }>; readonly searchParams: Parametros };

function puedeRenovarse(i: InscripcionDeAlumno): boolean {
  return i.estado === 'inscrito' && i.programaTipo === 'carrera' && !i.renovada && (i.anioDeCarrera ?? 3) < 3;
}

export default async function FichaDelAlumno({ params, searchParams }: Props) {
  const [{ codigo }, valores] = await Promise.all([params, searchParams]);
  const lectura = await exigirPersonal(rutaDeAlumno(codigo));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'estudiantes.leer');

  const ficha = await (await alumnosRepository()).fichaDeAlumno(decodeURIComponent(codigo));
  if (!ficha.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir la ficha">
        <p>{ficha.error}</p>
      </Aviso>
    );
  }
  const a = ficha.valor;
  if (!a) notFound();

  const caja = tienePermiso(ctx, 'caja.leer') ? await cajaRepository() : null;
  const [programas, cuenta, conceptos] = await Promise.all([
    catalogoAcademico().listarProgramas(),
    caja ? caja.cuentaDeAlumno(a.id) : Promise.resolve(null),
    caja && tienePermiso(ctx, 'contabilidad.gestionar') ? caja.conceptos('ingreso') : Promise.resolve(null),
  ]);
  const requisitosDe = (codigoPrograma: string) => programas.find((p) => p.codigo === codigoPrograma)?.requisitos ?? [];
  const puedeInscribir = tienePermiso(ctx, 'inscripciones.gestionar');
  const puedeEditar = tienePermiso(ctx, 'estudiantes.gestionar');
  const puedeArchivar = tienePermiso(ctx, 'estudiantes.archivar');
  const vigentes = a.inscripciones.filter((i) => i.estado === 'inscrito');
  const nombre = `${a.nombres} ${a.apellidos}`;
  const aqui = rutaDeAlumno(a.codigo);

  const inscrito = parametro(valores, 'inscrito');
  const nueva = a.inscripciones.find((i) => String(i.numero) === inscrito);
  const retirada = a.inscripciones.find((i) => String(i.numero) === parametro(valores, 'retirado'));
  const concluida = a.inscripciones.find((i) => String(i.numero) === parametro(valores, 'concluido'));

  return (
    <div className="grid gap-8">
      <nav aria-label="Migas" className="panel-sin-imprimir text-sm">
        <Link href={RUTAS_PANEL.alumnos} className="enlace inline-flex min-h-11 items-center gap-1">
          <Icono nombre="flechaIzquierda" tamano={16} />
          Alumnos
        </Link>
      </nav>

      {nueva ? (
        <Confirmacion
          palabra="¡Inscrito!"
          titulo={`${nombre} quedó en ${nueva.grupoNombre}`}
          cerrarHref={aqui}
          acciones={
            <>
              <Link href={RUTAS_ALUMNOS.inscribir} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-estructural px-4 font-semibold text-sobre-estructural">
                <Icono nombre="mas" tamano={18} />
                Inscribir a otra persona
              </Link>
              <Link href={rutaDeGrupo(nueva.grupoId)} className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold text-estructural hover:bg-superficie-alterna">
                <Icono nombre="grupo" tamano={18} />
                Ver el grupo
              </Link>
            </>
          }
        >
          <p>
            Inscripción n.º {nueva.numero}
            {nueva.paquete ? ` · ${ETIQUETA_DE_PAQUETE[nueva.paquete]}` : ''}
            {parametro(valores, 'solicitud') ? ' · La solicitud del portal quedó aprobada y el alumno ya ve la respuesta.' : ''}
          </p>
          {parametro(valores, 'sinprecio') ? <p className="mt-1">Este grupo aún no tiene precio: no se cargaron cuotas. Administración puede definirlo después.</p> : null}
        </Confirmacion>
      ) : null}
      {retirada ? (
        <Confirmacion
          palabra="Listo"
          titulo={`Se registró el retiro de ${retirada.grupoNombre}`}
          cerrarHref={aqui}
          cambios={[{ etiqueta: 'Estado', antes: 'Inscrito', despues: 'Retirado' }]}
        />
      ) : null}
      {concluida ? (
        <Confirmacion
          palabra="¡Felicidades!"
          titulo={`${concluida.grupoNombre} quedó como concluido`}
          cerrarHref={aqui}
          cambios={[{ etiqueta: 'Estado', antes: 'Inscrito', despues: 'Concluido' }]}
        />
      ) : null}
      {parametro(valores, 'creado') ? <Confirmacion palabra="¡Listo!" titulo={`Ficha creada: ${a.codigo}`} cerrarHref={aqui} /> : null}
      {parametro(valores, 'editado') ? <Confirmacion palabra="¡Guardado!" titulo="Los datos de la ficha se actualizaron" cerrarHref={aqui} /> : null}
      {parametro(valores, 'requisitos') ? <Confirmacion palabra="¡Guardado!" titulo="Requisitos actualizados" cerrarHref={aqui} /> : null}
      {parametro(valores, 'cargo') === 'creado' ? <Confirmacion palabra="¡Listo!" titulo="Se agregó el cargo a la cuenta" cerrarHref={aqui} /> : null}
      {parametro(valores, 'cargo') === 'anulado' ? (
        <Confirmacion palabra="Listo" titulo="El cargo quedó anulado" cerrarHref={aqui} cambios={[{ etiqueta: 'Cargo', antes: 'Pendiente', despues: 'Anulado' }]} />
      ) : null}
      {parametro(valores, 'archivado') ? (
        <Confirmacion palabra="Listo" titulo="La ficha quedó archivada" cerrarHref={aqui} cambios={[{ etiqueta: 'Ficha', antes: 'Activa', despues: 'Archivada' }]} />
      ) : null}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Iniciales nombres={a.nombres} apellidos={a.apellidos} tamano="lg" />
        <div className="min-w-0 flex-1">
          <EncabezadoDePanel titulo={nombre} />
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tono="gris">{a.codigo}</Chip>
            {a.documento ? <Chip tono="gris">CI {a.documento}</Chip> : null}
            <Chip tono="gris" icono="pin">
              {a.sedeNombre}
            </Chip>
            {a.conCuenta ? (
              <Chip tono="azul" icono="usuario" contorno>
                Usa el portal
              </Chip>
            ) : null}
            {a.archivadoEn ? (
              <Chip tono="rojo" icono="alerta">
                Archivada
              </Chip>
            ) : null}
          </p>
        </div>
        <div className="panel-sin-imprimir flex flex-wrap gap-2">
          {a.telefono ? (
            <a
              href={`https://wa.me/591${a.telefono}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-md border-2 border-linea bg-tarjeta px-4 font-semibold text-estructural hover:border-estructural"
            >
              <Icono nombre="whatsapp" tamano={20} />
              {a.telefono}
            </a>
          ) : null}
          {puedeInscribir && !a.archivadoEn ? (
            <Link href={`${RUTAS_ALUMNOS.inscribir}?alumno=${encodeURIComponent(a.codigo)}`} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion hover:bg-accion-fuerte">
              <Icono nombre="mas" tamano={20} />
              Inscribir
            </Link>
          ) : null}
        </div>
      </header>

      {a.archivadoEn ? (
        <Aviso tono="info" titulo="Ficha archivada">
          <p>{a.archivadoMotivo ?? 'Sin motivo registrado.'} No se puede inscribir mientras siga archivada.</p>
        </Aviso>
      ) : null}

      {cuenta && cuenta.exito && cuenta.valor ? (
        <CuentaDelAlumno ctx={ctx} cuenta={cuenta.valor} conceptos={conceptos && conceptos.exito ? conceptos.valor : []} vigentes={vigentes} />
      ) : cuenta && !cuenta.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar la cuenta">
          <p>{cuenta.error}</p>
        </Aviso>
      ) : null}

      <section aria-labelledby="inscripciones" className="grid gap-4">
        <h2 id="inscripciones" className="t-display text-3xl text-estructural">
          Inscripciones
        </h2>
        {a.inscripciones.length === 0 ? (
          <p className="text-tinta-suave">Todavía no tiene inscripciones.</p>
        ) : (
          <ul className="grid gap-4">
            {a.inscripciones.map((i) => (
              <li key={i.id} data-nuevo={String(i.numero) === inscrito ? 'si' : undefined} className="grid gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={rutaDeGrupo(i.grupoId)} className="text-lg font-bold text-estructural hover:underline">
                      {i.grupoNombre}
                    </Link>
                    <p className="mt-0.5 text-sm text-tinta-suave">
                      N.º {i.numero} · desde {formatearFecha(`${i.fecha}T12:00:00Z`)}
                      {i.paquete ? ` · ${ETIQUETA_DE_PAQUETE[i.paquete]}` : ''}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-2">
                    <ChipDeInscripcion estado={i.estado} />
                    {i.desdeElPortal ? (
                      <Chip tono="gris" icono="documento">
                        Desde el portal
                      </Chip>
                    ) : null}
                    {i.renovada ? (
                      <Chip tono="azul" icono="renovar" contorno>
                        Ya renovó
                      </Chip>
                    ) : null}
                  </span>
                </div>

                {i.estado === 'retirado' && i.motivoDeRetiro ? <p className="text-sm text-tinta-suave">Motivo del retiro: {i.motivoDeRetiro}</p> : null}

                {i.estado === 'inscrito' && puedeInscribir ? (
                  <div className="grid gap-3">
                    {puedeRenovarse(i) ? (
                      <Link
                        href={`${RUTAS_ALUMNOS.inscribir}?alumno=${encodeURIComponent(a.codigo)}&renueva=${i.id}`}
                        className="inline-flex min-h-12 items-center gap-2 justify-self-start rounded-md bg-estructural px-5 font-bold text-sobre-estructural hover:bg-estructural-profundo"
                      >
                        <Icono nombre="renovar" tamano={20} />
                        Renovar al {(i.anioDeCarrera ?? 0) + 1 === 3 ? '3.er' : '2.º'} año
                      </Link>
                    ) : null}
                    {requisitosDe(i.programaCodigo).length > 0 ? (
                      <Desplegable titulo={`Requisitos (${i.documentosEntregados.length} de ${requisitosDe(i.programaCodigo).length})`} icono="documento">
                        <FormularioDelPanel accion={guardarRequisitosAccion} etiqueta="Requisitos entregados">
                          <input type="hidden" name="inscripcion" value={i.id} />
                          <input type="hidden" name="codigo" value={a.codigo} />
                          <input type="hidden" name="numero" value={i.numero} />
                          <CasillasDeRequisitos requisitos={requisitosDe(i.programaCodigo)} marcados={i.documentosEntregados} />
                          <BotonGuardar className="justify-self-start">Guardar requisitos</BotonGuardar>
                        </FormularioDelPanel>
                      </Desplegable>
                    ) : null}
                    <Desplegable titulo="Retirar de este grupo" icono="salir" peligro>
                      <FormularioDelPanel accion={cambiarEstadoAccion} etiqueta="Retirar">
                        <input type="hidden" name="clave" value={randomUUID()} />
                        <input type="hidden" name="inscripcion" value={i.id} />
                        <input type="hidden" name="codigo" value={a.codigo} />
                        <input type="hidden" name="numero" value={i.numero} />
                        <input type="hidden" name="estado" value="retirado" />
                        <p className="text-tinta-suave">El alumno deja de contar en los cupos del grupo. Queda registrado quién lo hizo y por qué.</p>
                        <AreaDeTexto id={`motivo-${i.numero}`} name="motivo" etiqueta="¿Por qué se retira?" maxLength={500} />
                        <BotonGuardar variante="peligro" icono="salir" enviando="Registrando…" className="justify-self-start">
                          Sí, registrar el retiro
                        </BotonGuardar>
                      </FormularioDelPanel>
                    </Desplegable>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {tienePermiso(ctx, 'inventario.leer') ? (
        <UniformeYPrestamos
          ctx={ctx}
          estudianteId={a.id}
          codigo={a.codigo}
          tieneInscripcion={vigentes.length > 0}
          confirmar={parametro(valores, 'uniforme')}
          cargoDevuelto={{ estado: parametro(valores, 'cargouniforme'), monto: parametro(valores, 'montouniforme') }}
        />
      ) : null}

      <section aria-labelledby="datos" className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="datos" className="t-display text-3xl text-estructural">
            Datos
          </h2>
          {puedeEditar ? (
            <Link href={`${aqui}/editar`} className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold text-estructural hover:bg-superficie-alterna">
              <Icono nombre="lapiz" tamano={18} />
              Editar datos
            </Link>
          ) : null}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Celular">{a.telefono ?? '—'}</Dato>
          <Dato etiqueta="Correo">{a.correo ?? '—'}</Dato>
          <Dato etiqueta="Fecha de nacimiento">{a.fechaDeNacimiento ? formatearFecha(`${a.fechaDeNacimiento}T12:00:00Z`) : '—'}</Dato>
          <Dato etiqueta="Sede habitual">{a.sedeNombre}</Dato>
          <Dato etiqueta="Ficha creada">{formatearFecha(a.creadoEn)}</Dato>
          <Dato etiqueta="Inscripciones vigentes">{vigentes.length}</Dato>
        </dl>
        {a.observaciones ? <p className="text-tinta-suave">{a.observaciones}</p> : null}
      </section>

      {puedeArchivar && !a.archivadoEn && vigentes.length === 0 ? (
        <Desplegable titulo="Archivar esta ficha" icono="papelera" peligro>
          <FormularioDelPanel accion={archivarAlumnoAccion} etiqueta="Archivar ficha">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="codigo" value={a.codigo} />
            <p className="text-tinta-suave">La ficha no se borra: deja de aparecer en las búsquedas y su historia queda guardada.</p>
            <AreaDeTexto id="motivo" etiqueta="Motivo" maxLength={300} />
            <BotonGuardar variante="peligro" icono="papelera" enviando="Archivando…" className="justify-self-start">
              Sí, archivar
            </BotonGuardar>
          </FormularioDelPanel>
        </Desplegable>
      ) : null}
    </div>
  );
}
