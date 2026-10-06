/**
 * CAPA: Presentation / App — ficha del grupo.
 *
 * Programa, sede, turno, días, fechas, cupos y precio arriba; la lista de
 * inscritos debajo. «Inscribir alumno» aquí mismo. Administración edita,
 * define el precio y cierra el grupo (plegado y con confirmación: al cerrar,
 * sus inscritos pasan a «Concluido», B.3).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { admiteInscripciones, ETIQUETA_DE_MODALIDAD, ETIQUETA_DE_TURNO, etiquetaCortaDeDias } from '@core/domain/academico/programa';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { Id } from '@core/domain/shared/tipos-base';
import { alumnosRepository } from '@infra/config/composition-root';
import { diaEnBolivia, formatearDia, formatearFecha } from '@/lib/fechas';
import { RUTAS_ALUMNOS, rutaDeAlumno, rutaDeGrupo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { BarraDeCupos, Confirmacion, Dato, Desplegable, EncabezadoDePanel, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { cerrarGrupoAccion } from '../../actions';
import { generarCuotasAccion } from '../../../caja/actions';
import { ChipDeConvocatoria, ChipDeGrupo, ChipDeInscripcion, ETIQUETA_DE_PAQUETE, parametro, PrecioDelGrupo, type Parametros } from '../../_componentes';

export const metadata: Metadata = { title: 'Grupo' };

export default async function FichaDelGrupo({ params, searchParams }: { readonly params: Promise<{ readonly id: string }>; readonly searchParams: Parametros }) {
  const [{ id }, valores] = await Promise.all([params, searchParams]);
  const lectura = await exigirPersonal(rutaDeGrupo(id));
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'cohortes.leer');

  const leida = await (await alumnosRepository()).fichaDeGrupo(id as Id);
  if (!leida.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el grupo">
        <p>{leida.error}</p>
      </Aviso>
    );
  }
  if (!leida.valor) notFound();
  const { grupo: g, inscritos } = leida.valor;
  const aqui = rutaDeGrupo(g.id);
  const gestiona = tienePermiso(ctx, 'cohortes.gestionar');
  const ponePrecio = tienePermiso(ctx, 'contabilidad.gestionar');
  const enSuSede = ctx.sedes.some((s) => s.id === g.sedeId);
  const puedeInscribir = tienePermiso(ctx, 'inscripciones.gestionar') && enSuSede && admiteInscripciones(g.estado);
  const vigentes = inscritos.filter((i) => i.estado === 'inscrito');
  const cerrado = parametro(valores, 'cerrado');

  return (
    <div className="grid gap-8">
      <Link href={RUTAS_ALUMNOS.grupos} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Grupos y cupos
      </Link>

      {parametro(valores, 'abierto') ? <Confirmacion palabra="¡Listo!" titulo="El grupo quedó abierto" cerrarHref={aqui} /> : null}
      {parametro(valores, 'editado') ? <Confirmacion palabra="¡Guardado!" titulo="Los datos del grupo se actualizaron" cerrarHref={aqui} /> : null}
      {parametro(valores, 'precio') === '1' ? <Confirmacion palabra="¡Guardado!" titulo="El precio del grupo quedó definido" cerrarHref={aqui} /> : null}
      {parametro(valores, 'precio') === 'borrado' ? <Confirmacion palabra="Listo" titulo="Se quitó ese precio" cerrarHref={aqui} /> : null}
      {parametro(valores, 'cuotas') ? (
        <Confirmacion
          palabra="¡Listo!"
          titulo={parametro(valores, 'cuotas') === '0' ? 'No había cuotas por crear' : `Se cargaron ${parametro(valores, 'cuotas')} cuotas a ${parametro(valores, 'alumnos')} alumnos`}
          cerrarHref={aqui}
        />
      ) : null}
      {cerrado ? (
        <Confirmacion
          palabra="¡Concluido!"
          titulo="El grupo quedó cerrado"
          cerrarHref={aqui}
          cambios={[{ etiqueta: 'Estado', antes: 'Abierto', despues: 'Cerrado' }]}
        >
          <p>
            {cerrado === '1' ? '1 alumno pasó' : `${cerrado} alumnos pasaron`} a «Concluido».
            {parametro(valores, 'deuda') && parametro(valores, 'deuda') !== '0' ? ` ${parametro(valores, 'deuda')} tienen cuotas pendientes.` : ''}
          </p>
        </Confirmacion>
      ) : null}

      <EncabezadoDePanel
        titulo={g.nombre}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <ChipDeGrupo estado={g.estado} />
            <ChipDeConvocatoria grupo={g} hoy={diaEnBolivia(new Date())} />
          </span>
        }
        acciones={
          puedeInscribir ? (
            <Link href={`${RUTAS_ALUMNOS.inscribir}?grupo=${g.id}`} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-accion px-5 font-bold text-sobre-accion hover:bg-accion-fuerte">
              <Icono nombre="mas" tamano={20} />
              Inscribir alumno
            </Link>
          ) : null
        }
      />

      <section aria-label="Datos del grupo" className="grid gap-6 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 lg:grid-cols-[2fr_1fr]">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Programa">{g.programaNombre}</Dato>
          <Dato etiqueta="Sede">{g.sedeNombre}</Dato>
          <Dato etiqueta="Empieza">{formatearFecha(`${g.fechaInicio}T12:00:00Z`)}</Dato>
          <Dato etiqueta="Termina">{g.fechaFin ? formatearFecha(`${g.fechaFin}T12:00:00Z`) : '—'}</Dato>
          {g.turno ? <Dato etiqueta="Turno">{ETIQUETA_DE_TURNO[g.turno]}</Dato> : null}
          {g.dias ? <Dato etiqueta="Días">{etiquetaCortaDeDias(g.dias)}</Dato> : null}
          {g.modalidad ? <Dato etiqueta="Modalidad">{ETIQUETA_DE_MODALIDAD[g.modalidad]}</Dato> : null}
          <Dato etiqueta="Gestión">{g.gestion}</Dato>
          <Dato etiqueta="Horario">{g.horaInicio && g.horaFin ? `${g.horaInicio}–${g.horaFin}` : 'Sin horario'}</Dato>
          <Dato etiqueta="Inscripciones por el portal">
            {g.inscripcionDesde && g.inscripcionHasta
              ? `Del ${formatearDia(g.inscripcionDesde)} al ${formatearDia(g.inscripcionHasta)}`
              : 'Sin plazo: solo en persona'}
          </Dato>
        </dl>
        <div className="grid content-start gap-4">
          <div>
            <p className="t-etiqueta mb-1">Cupos</p>
            <BarraDeCupos inscritos={g.inscritos} capacidad={g.capacidad} />
          </div>
          <div>
            <p className="t-etiqueta mb-1">Precio</p>
            <PrecioDelGrupo precios={g.precios} />
          </div>
          {ponePrecio && g.estado !== 'cerrado' && g.precios.length > 0 && vigentes.length > 0 ? (
            <FormularioDelPanel accion={generarCuotasAccion} etiqueta="Crear cuotas pendientes">
              <input type="hidden" name="clave" value={randomUUID()} />
              <input type="hidden" name="grupo" value={g.id} />
              <BotonGuardar variante="secundario" icono="monedas" enviando="Creando…" className="justify-self-start">
                Crear cuotas pendientes
              </BotonGuardar>
              <p className="text-sm text-tinta-suave">
                Para alumnos que se inscribieron antes de que el grupo tuviera precio, o después de anular todas sus cuotas y cambiar el precio.
                Si el precio cambió, las becas del grupo vuelven a cargarse: anúlalas de nuevo.
              </p>
            </FormularioDelPanel>
          ) : null}
          {ponePrecio && g.estado !== 'cerrado' ? (
            <Link href={`${aqui}/precio`} className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-md px-3 font-semibold text-estructural hover:bg-superficie-alterna">
              <Icono nombre="monedas" tamano={18} />
              {g.precios.length > 0 ? 'Cambiar precio' : 'Definir precio'}
            </Link>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="inscritos" className="grid gap-4">
        <h2 id="inscritos" className="t-display text-3xl text-estructural">
          Alumnos <span className="text-tinta-suave">({vigentes.length})</span>
        </h2>
        {inscritos.length === 0 ? (
          <p className="text-tinta-suave">Todavía no hay alumnos en este grupo.</p>
        ) : (
          <ul className="grid gap-2">
            {inscritos.map((i) => (
              <li key={i.inscripcionId}>
                <Link href={rutaDeAlumno(i.codigo)} className="flex flex-wrap items-center gap-3 rounded-md border border-linea bg-tarjeta p-3 hover:border-estructural">
                  <Iniciales nombres={i.nombres} apellidos={i.apellidos} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-estructural">
                      {i.nombres} {i.apellidos}
                    </span>
                    <span className="text-sm text-tinta-suave">
                      {i.codigo}
                      {i.paquete ? ` · ${ETIQUETA_DE_PAQUETE[i.paquete]}` : ''}
                    </span>
                  </span>
                  <ChipDeInscripcion estado={i.estado} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gestiona && g.estado !== 'cerrado' ? (
        <div className="grid gap-3">
          <Link href={`${aqui}/editar`} className="inline-flex min-h-12 items-center gap-2 justify-self-start rounded-md border-2 border-linea bg-tarjeta px-5 font-semibold text-estructural hover:border-estructural">
            <Icono nombre="lapiz" tamano={18} />
            Editar el grupo
          </Link>
          <Desplegable titulo="Cerrar el grupo" icono="candado" peligro>
            <FormularioDelPanel accion={cerrarGrupoAccion} etiqueta="Cerrar el grupo">
              <input type="hidden" name="clave" value={randomUUID()} />
              <input type="hidden" name="id" value={g.id} />
              <p className="text-tinta-suave">
                Se hace cuando el grupo terminó. {vigentes.length === 1 ? 'El alumno inscrito pasa' : `Los ${vigentes.length} alumnos inscritos pasan`} a «Concluido» y el grupo ya
                no se puede cambiar.
              </p>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-2 border-linea p-3 has-[:checked]:border-peligro">
                <input type="checkbox" name="confirmo" value="si" className="size-5 accent-[var(--t-peligro)]" />
                <span className="font-semibold">Confirmo que el grupo terminó</span>
              </label>
              <BotonGuardar variante="peligro" icono="candado" enviando="Cerrando…" className="justify-self-start">
                Cerrar el grupo
              </BotonGuardar>
            </FormularioDelPanel>
          </Desplegable>
        </div>
      ) : null}
    </div>
  );
}
