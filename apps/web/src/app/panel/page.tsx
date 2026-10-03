/**
 * CAPA: Presentation / App — inicio del panel interno (rebanada R7).
 *
 * Dos tableros según quién entra (especificación §7.6 y §7.7, aligerados por
 * las enmiendas B.12, crítica 29):
 *
 * - Administración (quien tiene `contabilidad.leer`): saludo con la sede
 *   elegida («Ambas · La Paz · El Alto»), 4 acciones, hasta 4 alertas (el
 *   resto en «Ver N más»), 4 cifras del mes y un solo gráfico.
 * - Recepción (todo el resto del personal): saludo, buscador de alumnos,
 *   4 acciones, hasta 4 pendientes de su sede y la tarjeta de caja.
 *
 * Cada dato se pide SOLO si la cuenta tiene el permiso de su fuente: pedir lo
 * que la base va a negar llenaría la pantalla de errores que no son errores.
 * Todo se pide a la vez (`Promise.all`) y cada fuente falla por separado: si
 * una no responde, el resto se muestra igual y un aviso pequeño dice qué
 * falta. Mientras falte algo, la pantalla no dice «¡Todo al día!»: sería
 * afirmar algo que no se pudo comprobar.
 *
 * Las reglas (qué aviso va primero, cuántos se ven, cómo se redacta cada
 * uno, cuánto cambió el mes) viven en el caso de uso y el dominio, con
 * pruebas; aquí solo se cuenta lo leído y se pinta.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { resumenParaPantalla } from '@core/application/panel/contabilidad/contabilidad.usecase';
import {
  alertasDeAdministracion,
  cifrasDelMes,
  pendientesDeRecepcion,
  type AvisoDeTablero,
  type AvisosVisibles,
  type ClaseDeAviso,
} from '@core/application/panel/tablero/tablero.usecase';
import type { CajaPorCerrar } from '@core/application/ports/caja.port';
import type { ArticuloConExistencias, PrestamoAbierto } from '@core/application/ports/inventario.port';
import type { ResumenDeDeudores, TableroDeAdministracionEnBase } from '@core/application/ports/tablero.port';
import { barrasDeSemanas, type Variacion } from '@core/domain/contabilidad/tablero';
import type { ClaseDeResultado, ResultadoDelMes } from '@core/domain/contabilidad/resumen';
import { saludoSegunHora, sedeDeTrabajo, tienePermiso, type ContextoDePanel, type Permiso, type SedeOperable } from '@core/domain/identidad/contexto-de-panel';
import { ETIQUETA_DE_ROL } from '@core/domain/identidad/rol';
import { formatearMontoExacto } from '@core/domain/shared/dinero';
import type { Centavos, FechaISO, Id, Resultado } from '@core/domain/shared/tipos-base';
import { alumnosRepository, cajaRepository, contabilidadRepository, inventarioRepository, tableroRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { formatearDiaLargo, formatearFechaYHora, horaEnBolivia } from '@/lib/fechas';
import { RUTAS_ALUMNOS, RUTAS_CAJA, RUTAS_CONTABILIDAD, RUTAS_INVENTARIO, RUTAS_PANEL } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono, type NombreDeIcono } from '@/presentation/icons/Icono';
import { ALTO_DE_BARRAS, GraficoSemanal } from '@/presentation/panel/GraficoSemanal';
import { Chip, Desplegable, EncabezadoDePanel, EstadoVacio, Indicador, Mosaico, type TonoDeChip } from '@/presentation/panel/Piezas';
import { exigirPersonal } from './_sesion';
import { enlaceContable, nombreDelMes, parametro, sedeDeParametro, type Parametros } from './contabilidad/_componentes';

export const metadata: Metadata = { title: 'Inicio' };

// ---------------------------------------------------------------- Fuentes

/** Lo leído de una fuente. `null` = no se pidió (la cuenta no tiene el permiso): no es un fallo. */
type Fuente<T> = Resultado<T> | null;

function valorDe<T>(fuente: Fuente<T>): T | null {
  return fuente && fuente.exito ? fuente.valor : null;
}

/** Nombres, en palabras simples, de las fuentes que se pidieron y no respondieron. */
function fallidas(fuentes: readonly (readonly [string, Fuente<unknown>])[]): string[] {
  const nombres: string[] = [];
  for (const [nombre, fuente] of fuentes) if (fuente && !fuente.exito && !nombres.includes(nombre)) nombres.push(nombre);
  return nombres;
}

/** Agotados o bajo el mínimo: una variante cuenta una vez por sede (como en Inventario). */
function contarBajoMinimo(articulos: readonly ArticuloConExistencias[], sedeId: Id | undefined): number {
  let total = 0;
  for (const a of articulos) {
    if (a.stockMinimo <= 0n) continue;
    for (const v of a.variantes) {
      for (const s of v.sedes) if (s.estado !== 'bien' && (!sedeId || s.sedeId === sedeId)) total += 1;
    }
  }
  return total;
}

function atrasados(prestamos: readonly PrestamoAbierto[]): number {
  return prestamos.filter((p) => p.atrasado).length;
}

/** Alumnos con algo vencido y cuánto suma, contados en la base (no sobre una lista recortada). */
function vencidos(resumen: ResumenDeDeudores): { readonly cuantos: number; readonly monto: Centavos } {
  return { cuantos: resumen.alumnosConVencido, monto: resumen.vencido };
}

/**
 * Tablero en cero para cuando `tablero_de_administracion` no responde: así
 * las alertas que salen de OTRAS fuentes (solicitudes, préstamos, lotes,
 * mínimos) se siguen viendo. Las cifras del mes y el gráfico, que sí
 * dependen de él, no se muestran (un cero ahí sería mentira).
 */
function tableroEnCero(hoy: FechaISO): TableroDeAdministracionEnBase {
  const cero = 0 as Centavos;
  return {
    hoy,
    efectivoSinArqueo: { registros: 0, desde: null, sede: null, sedes: 0 },
    arqueosConDiferencia: { cantidad: 0, monto: cero, sede: null, sedes: 0 },
    bajasUltimos7Dias: { cantidad: 0, monto: cero },
    sinPrecio: { grupos: 0, entregas: 0, perdidas: 0 },
    comparacion: { entroMes: cero, salioMes: cero, entroAnterior: cero, salioAnterior: cero, corteAnterior: hoy },
    semanas: [],
  };
}

// ---------------------------------------------------------------- Página

export default async function InicioDelPanel({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  const esAdministracion = tienePermiso(ctx, 'contabilidad.leer');

  return (
    <div className="grid gap-8">
      {valores.aviso === 'sin_permiso' ? (
        <Aviso tono="error" titulo="Esa sección no está disponible para tu cuenta">
          <p>Si la necesitas, pide a administración que revise tus permisos.</p>
        </Aviso>
      ) : null}
      {esAdministracion ? (
        <TableroDeAdministracion ctx={ctx} sede={sedeDeParametro(ctx, parametro(valores, 'sede'))} />
      ) : (
        <TableroDeRecepcion ctx={ctx} sede={sedeDeTrabajo(ctx)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Saludo

function Saludo({ ctx, sede, acciones }: { readonly ctx: ContextoDePanel; readonly sede?: SedeOperable | null; readonly acciones?: ReactNode }) {
  return (
    <EncabezadoDePanel
      gancho={`${saludoSegunHora(horaEnBolivia())},`}
      titulo={ctx.nombres || ETIQUETA_DE_ROL[ctx.rol]}
      descripcion={
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="first-letter:uppercase">{formatearDiaLargo(ctx.hoy)}</span>
          {sede ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tarjeta px-3 py-1 text-sm font-semibold text-estructural ring-1 ring-linea">
              <Icono nombre="pin" tamano={16} />
              {sede.nombre}
              {sede.zona ? <span className="font-normal text-tinta-suave">· {sede.zona}</span> : null}
            </span>
          ) : null}
        </p>
      }
      acciones={acciones}
    />
  );
}

/** «Ambas · La Paz · El Alto»: enlaces, sin JavaScript. Vacío = todas las sedes. */
function SelectorDeSedeDelTablero({ ctx, sede }: { readonly ctx: ContextoDePanel; readonly sede: Id | undefined }) {
  if (ctx.sedes.length < 2) return null;
  const opciones = [{ id: '', nombre: ctx.sedes.length === 2 ? 'Ambas' : 'Todas' }, ...ctx.sedes];
  return (
    <nav aria-label="Sede del tablero" className="flex flex-wrap gap-2">
      {opciones.map((s) => {
        const actual = (sede ?? '') === s.id;
        return (
          <Link
            key={s.id || 'todas'}
            href={s.id ? `${RUTAS_PANEL.inicio}?sede=${encodeURIComponent(s.id)}` : RUTAS_PANEL.inicio}
            aria-current={actual ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold',
              actual ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            <Icono nombre="pin" tamano={16} />
            {s.nombre}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- Acciones

interface Accion {
  readonly href: string;
  readonly icono: NombreDeIcono;
  readonly titulo: string;
  readonly detalle: string;
  readonly permiso: Permiso;
  readonly tono?: 'azul' | 'amarillo';
}

/** Recepción (crítica 29): lo que más hace en el mostrador, en ese orden. */
const ACCIONES_DE_RECEPCION: readonly Accion[] = [
  { href: RUTAS_CAJA.cobrar, icono: 'monedas', titulo: 'Cobrar', detalle: 'Cuotas, uniformes y ventas', permiso: 'caja.cobrar', tono: 'amarillo' },
  { href: RUTAS_ALUMNOS.inscribir, icono: 'graduacion', titulo: 'Inscribir alumno', detalle: 'Nuevos alumnos y renovaciones', permiso: 'inscripciones.gestionar' },
  { href: RUTAS_INVENTARIO.usar, icono: 'bol', titulo: 'Usar insumos', detalle: 'Lo que se usó en clase', permiso: 'inventario.operar' },
  { href: RUTAS_INVENTARIO.entregar, icono: 'chaqueta', titulo: 'Entregar uniforme', detalle: 'Por talla, con su cargo', permiso: 'inventario.operar' },
];

/** Administración (crítica 29). El amarillo, uno por pantalla, sigue en «Cobrar». */
const ACCIONES_DE_ADMINISTRACION: readonly Accion[] = [
  { href: RUTAS_INVENTARIO.compra, icono: 'carrito', titulo: 'Registrar compra', detalle: 'Lo que llegó con la nota', permiso: 'inventario.comprar' },
  { href: RUTAS_CONTABILIDAD.gastoNuevo, icono: 'recibo', titulo: 'Registrar gasto', detalle: 'Luz, alquiler, sueldos…', permiso: 'contabilidad.gestionar' },
  { href: RUTAS_ALUMNOS.inscribir, icono: 'graduacion', titulo: 'Inscribir alumno', detalle: 'Nuevos alumnos y renovaciones', permiso: 'inscripciones.gestionar' },
  { href: RUTAS_CAJA.cobrar, icono: 'monedas', titulo: 'Cobrar', detalle: 'Cuotas, uniformes y ventas', permiso: 'caja.cobrar', tono: 'amarillo' },
];

function Acciones({ ctx, acciones }: { readonly ctx: ContextoDePanel; readonly acciones: readonly Accion[] }) {
  const visibles = acciones.filter((a) => tienePermiso(ctx, a.permiso));
  return (
    <section aria-labelledby="que-hacer" className="grid gap-4">
      <h2 id="que-hacer" className="t-etiqueta">
        ¿Qué quieres hacer?
      </h2>
      {visibles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibles.map((a) => (
            <Mosaico key={a.titulo} href={a.href} icono={a.icono} titulo={a.titulo} detalle={a.detalle} tono={a.tono} />
          ))}
        </div>
      ) : (
        <p className="text-tinta-suave">Tu cuenta todavía no tiene tareas asignadas en el panel.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Avisos

type Tablero = 'recepcion' | 'administracion';

interface PresentacionDeAviso {
  /** Rótulo corto encima de la cifra. */
  readonly etiqueta: string;
  readonly icono: NombreDeIcono;
  readonly accion: string;
  readonly href: string;
  /** Pide actuar hoy: insignia roja (el rótulo y la frase dicen lo mismo con palabras). */
  readonly urgente: boolean;
}

/** «1.250»: la cifra grande con el mismo punto de miles que la frase de al lado. */
function conMiles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function conSede(ruta: string, sede: Id | undefined, extra?: string): string {
  const partes = [sede ? `sede=${encodeURIComponent(sede)}` : '', extra ?? ''].filter(Boolean);
  return partes.length > 0 ? `${ruta}?${partes.join('&')}` : ruta;
}

/**
 * Adónde llevan los avisos. Con una sede elegida, todo va a esa sede. Con
 * «Ambas», el efectivo sin arqueo y los arqueos con diferencia van a la sede
 * donde está el problema (la del registro más antiguo y la del arqueo más
 * reciente) y el botón la nombra: «Ver caja · El Alto».
 */
interface DestinosDeAvisos {
  readonly tablero: Tablero;
  readonly sede: Id | undefined;
  readonly puedeComprar: boolean;
  readonly sedeDelEfectivo?: SedeOperable;
  readonly sedeDelArqueo?: SedeOperable;
  /** Hay grupos sin precio: «Definir precio» lleva a los grupos; si no, lo que falta es de entregas o pérdidas. */
  readonly faltaPrecioDeGrupos?: boolean;
}

/** Ruta y texto del botón hacia la sede del problema (solo se nombra si el tablero muestra todas). */
function haciaLaSede(ruta: string, texto: string, sede: Id | undefined, delProblema: SedeOperable | undefined): { readonly href: string; readonly accion: string } {
  if (sede || !delProblema) return { href: conSede(ruta, sede), accion: texto };
  return { href: conSede(ruta, delProblema.id), accion: `${texto} · ${delProblema.nombre}` };
}

function presentacionDe(clase: ClaseDeAviso, d: DestinosDeAvisos): PresentacionDeAviso {
  const admin = d.tablero === 'administracion';
  const { sede, puedeComprar } = d;
  switch (clase) {
    case 'prestamos_atrasados':
      return { etiqueta: 'Utensilios atrasados', icono: 'cubiertos', accion: admin ? 'Ver préstamos' : 'Recibir devolución', href: RUTAS_INVENTARIO.prestamos, urgente: true };
    case 'solicitudes':
      return { etiqueta: 'Solicitudes del portal', icono: 'documento', accion: 'Atender', href: RUTAS_ALUMNOS.solicitudes, urgente: false };
    case 'cuotas_vencidas':
      return { etiqueta: 'Cuotas vencidas', icono: 'monedas', accion: 'Ver y cobrar', href: conSede(RUTAS_CAJA.deben, sede, 'vencidos=1'), urgente: true };
    case 'sin_uniforme':
      return { etiqueta: 'Sin uniforme', icono: 'chaqueta', accion: 'Entregar', href: RUTAS_INVENTARIO.entregar, urgente: false };
    case 'lotes_vencidos':
      return { etiqueta: 'Insumos vencidos', icono: 'reloj', accion: admin ? 'Ver lotes' : 'Ver y dar de baja', href: RUTAS_INVENTARIO.inicio, urgente: true };
    case 'lotes_por_vencer':
      return { etiqueta: 'Insumos por vencer', icono: 'reloj', accion: 'Usar primero', href: RUTAS_INVENTARIO.inicio, urgente: false };
    case 'bajo_minimo':
      return admin && puedeComprar
        ? { etiqueta: 'Agotados o bajo el mínimo', icono: 'almacen', accion: 'Registrar compra', href: RUTAS_INVENTARIO.compra, urgente: false }
        : { etiqueta: 'Agotados o bajo el mínimo', icono: 'almacen', accion: 'Ver lista', href: RUTAS_INVENTARIO.inicio, urgente: false };
    case 'efectivo_sin_arqueo':
      return { etiqueta: 'Efectivo sin arqueo', icono: 'billete', ...haciaLaSede(RUTAS_CAJA.inicio, 'Ver caja', sede, d.sedeDelEfectivo), urgente: true };
    case 'arqueos_con_diferencia':
      return { etiqueta: 'Arqueos con diferencia', icono: 'candado', ...haciaLaSede(RUTAS_CAJA.arqueos, 'Revisar', sede, d.sedeDelArqueo), urgente: true };
    case 'bajas':
      // El historial filtrado a lo que cuenta el aviso: bajas y faltantes de conteo.
      return { etiqueta: 'Bajas de los últimos 7 días', icono: 'papelera', accion: 'Revisar bajas', href: conSede(RUTAS_INVENTARIO.historial, sede, 'tipo=baja,ajuste_faltante'), urgente: false };
    case 'sin_precio':
      // El precio de un grupo se define en Grupos; una entrega o una pérdida sin cargo se busca en el historial y se carga en la cuenta del alumno.
      return d.faltaPrecioDeGrupos
        ? { etiqueta: 'Sin precio definido', icono: 'lapiz', accion: 'Definir precio', href: RUTAS_ALUMNOS.grupos, urgente: false }
        : { etiqueta: 'Sin precio definido', icono: 'lapiz', accion: 'Ver entregas y pérdidas', href: conSede(RUTAS_INVENTARIO.historial, sede, 'tipo=entrega,baja'), urgente: false };
  }
}

function TarjetasDeAvisos({ avisos, destinos }: { readonly avisos: AvisosVisibles; readonly destinos: DestinosDeAvisos }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {avisos.visibles.map((a) => {
          const p = presentacionDe(a.clase, destinos);
          return (
            <Indicador
              key={a.clase}
              icono={p.icono}
              etiqueta={p.etiqueta}
              cifra={conMiles(a.cifra)}
              detalle={a.frase}
              accion={{ href: p.href, texto: p.accion }}
              tono={p.urgente ? 'alerta' : 'normal'}
            />
          );
        })}
      </div>
      {avisos.resto.length > 0 ? (
        <Desplegable titulo={`Ver ${avisos.resto.length} más`} icono="mas">
          <ul className="grid gap-3">
            {avisos.resto.map((a) => (
              <FilaDeAviso key={a.clase} aviso={a} presentacion={presentacionDe(a.clase, destinos)} />
            ))}
          </ul>
        </Desplegable>
      ) : null}
    </>
  );
}

function FilaDeAviso({ aviso, presentacion: p }: { readonly aviso: AvisoDeTablero; readonly presentacion: PresentacionDeAviso }) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-linea pb-3 last:border-b-0 last:pb-0">
      <span className={cn('inline-grid size-10 flex-none place-items-center rounded-full', p.urgente ? 'bg-peligro/10 text-peligro' : 'bg-superficie-alterna text-estructural')}>
        <Icono nombre={p.icono} tamano={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-tinta">{p.etiqueta}</span>
        <span className="block text-sm text-tinta-suave">{aviso.frase}</span>
      </span>
      <Link href={p.href} className="enlace inline-flex min-h-11 items-center gap-1">
        {p.accion}
        <Icono nombre="flecha" tamano={16} />
      </Link>
    </li>
  );
}

/** Aviso pequeño: qué no se pudo leer. Lo demás de la pantalla sí está al día. */
function FuentesQueFallaron({ nombres }: { readonly nombres: readonly string[] }) {
  if (nombres.length === 0) return null;
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return (
    <Aviso tono="error" titulo="Parte del inicio no se pudo cargar">
      <p>
        No pudimos leer {lista}. Lo demás está al día; vuelve a cargar la página en un momento.
      </p>
    </Aviso>
  );
}

// ---------------------------------------------------------------- Recepción (§7.6)

async function TableroDeRecepcion({ ctx, sede }: { readonly ctx: ContextoDePanel; readonly sede: SedeOperable | null }) {
  const puede = (permiso: Permiso) => tienePermiso(ctx, permiso);
  const sedeId = sede?.id;

  const [inventario, alumnos, caja, tableroRepo] = await Promise.all([
    puede('inventario.leer') ? inventarioRepository() : null,
    puede('solicitudes.leer') ? alumnosRepository() : null,
    puede('caja.leer') || puede('caja.cerrar') ? cajaRepository() : null,
    puede('inventario.leer') || puede('caja.leer') ? tableroRepository() : null,
  ]);
  const [prestamos, sinUniforme, lotes, existencias, solicitudes, deudores, porCerrar] = await Promise.all([
    inventario ? inventario.prestamosAbiertos({ sedeId }) : null,
    // La vista cruza inscripciones y alumnos: sin `estudiantes.leer` la base la negaría.
    inventario && puede('estudiantes.leer') ? inventario.sinUniforme(sedeId) : null,
    tableroRepo && puede('inventario.leer') ? tableroRepo.contarLotesConAlerta(sedeId) : null,
    inventario ? inventario.existencias({}) : null,
    alumnos ? alumnos.contarSolicitudesAbiertas() : null,
    tableroRepo && puede('caja.leer') ? tableroRepo.resumenDeDeudores(sedeId) : null,
    caja && sede && puede('caja.cerrar') ? caja.cajaPorCerrar(sede.id) : null,
  ]);

  const listaDePrestamos = valorDe(prestamos) ?? [];
  const conteoDeLotes = valorDe(lotes);
  const resumenDeDeuda = valorDe(deudores);
  const deuda = resumenDeDeuda ? vencidos(resumenDeDeuda) : { cuantos: 0, monto: 0 as Centavos };
  const avisos = pendientesDeRecepcion({
    prestamosAtrasados: atrasados(listaDePrestamos),
    prestamosHoy: listaDePrestamos.filter((p) => !p.atrasado && p.devolverEl === ctx.hoy).length,
    solicitudes: valorDe(solicitudes) ?? 0,
    deudoresVencidos: deuda.cuantos,
    montoVencido: deuda.monto,
    sinUniforme: (valorDe(sinUniforme) ?? []).length,
    lotesVencidos: conteoDeLotes?.vencidos ?? 0,
    lotesPorVencer: conteoDeLotes?.porVencer ?? 0,
    bajoMinimo: contarBajoMinimo(valorDe(existencias) ?? [], sedeId),
  });
  const fallos = fallidas([
    ['los préstamos', prestamos],
    ['los alumnos sin uniforme', sinUniforme],
    ['los insumos', lotes],
    ['los insumos', existencias],
    ['las solicitudes', solicitudes],
    ['las cuotas vencidas', deudores],
    ['la caja', porCerrar],
  ]);
  const hayPendientes = avisos.visibles.length > 0;

  return (
    <>
      <Saludo ctx={ctx} sede={sede} />
      {puede('estudiantes.leer') ? <Buscador /> : null}
      <Acciones ctx={ctx} acciones={ACCIONES_DE_RECEPCION} />
      <FuentesQueFallaron nombres={fallos} />

      <section aria-labelledby="pendientes" className="grid gap-4">
        <h2 id="pendientes" className="t-display text-3xl text-estructural">
          Pendientes de hoy
        </h2>
        {hayPendientes ? (
          <TarjetasDeAvisos avisos={avisos} destinos={{ tablero: 'recepcion', sede: sedeId, puedeComprar: false }} />
        ) : fallos.length > 0 ? (
          <p className="text-tinta-suave">No encontramos pendientes en lo que se pudo leer.</p>
        ) : (
          <EstadoVacio frase="¡Todo al día!" detalle={`No hay nada pendiente en ${sede ? sede.nombre : 'tu sede'}.`} />
        )}
      </section>

      {sede && porCerrar && porCerrar.exito ? <TarjetaDeCaja caja={porCerrar.valor} sede={sede} varias={ctx.sedes.length > 1} /> : null}
    </>
  );
}

/** La tarea más frecuente del mostrador: encontrar a alguien. Lleva a la lista de Alumnos con la búsqueda hecha. */
function Buscador() {
  return (
    <form role="search" action={RUTAS_ALUMNOS.lista} className="grid gap-2">
      <label htmlFor="buscar-alumno" className="text-lg font-semibold text-estructural">
        Busca un alumno por nombre o carnet
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <span className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-tinta-suave">
            <Icono nombre="buscar" tamano={22} />
          </span>
          <input
            id="buscar-alumno"
            name="q"
            type="search"
            maxLength={60}
            autoComplete="off"
            className="min-h-14 w-full rounded-md border-2 border-linea bg-tarjeta ps-12 pe-4 text-lg text-tinta focus:border-estructural focus:outline-none focus-visible:ring-4 focus-visible:ring-accion/50"
          />
        </span>
        <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-estructural px-6 font-bold text-sobre-estructural hover:bg-estructural-profundo">
          Buscar
        </button>
      </div>
    </form>
  );
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`;
}

/** Siempre a la vista en recepción (§7.6, punto 5): lo que hay por arquear y desde cuándo. */
function TarjetaDeCaja({ caja, sede, varias }: { readonly caja: CajaPorCerrar; readonly sede: SedeOperable; readonly varias: boolean }) {
  const consulta = varias ? `?sede=${encodeURIComponent(sede.id)}` : '';
  const partes = [`efectivo ${formatearMontoExacto(caja.entradasEfectivo)}`, `QR ${formatearMontoExacto(caja.cobrosQr)}`];
  if (caja.cobrosTransferencia > 0) partes.push(`transferencias ${formatearMontoExacto(caja.cobrosTransferencia)}`);
  return (
    <section aria-labelledby="caja-titulo" className="flex flex-col gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-5 sm:flex-row sm:items-center">
      <span className="inline-grid size-14 flex-none place-items-center rounded-full bg-estructural text-sobre-estructural">
        <Icono nombre="billete" tamano={26} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="caja-titulo" className="t-etiqueta">
          Caja de {sede.nombre}
        </h2>
        {caja.registros > 0 ? (
          <p className="mt-1 text-lg font-semibold text-tinta">
            Por cerrar: {partes.join(' · ')} · {plural(caja.registros, 'movimiento', 'movimientos')}
          </p>
        ) : (
          <p className="mt-1 text-lg font-semibold text-tinta">Aún no hay cobros desde el último cierre.</p>
        )}
        <p className="mt-1 text-sm text-tinta-suave">
          {caja.ultimoCierreEn ? `Último cierre: ${formatearFechaYHora(caja.ultimoCierreEn)}` : 'Esta caja todavía no se cerró nunca.'}
        </p>
      </div>
      <Link
        href={`${RUTAS_CAJA.cerrar}${consulta}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-estructural px-5 font-bold text-sobre-estructural hover:bg-estructural-profundo"
      >
        <Icono nombre="candado" tamano={20} />
        Cerrar caja
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------- Administración (§7.7)

async function TableroDeAdministracion({ ctx, sede }: { readonly ctx: ContextoDePanel; readonly sede: Id | undefined }) {
  const puede = (permiso: Permiso) => tienePermiso(ctx, permiso);
  const mes = ctx.hoy.slice(0, 7);

  const [tableroRepo, contabilidad, inventario, alumnos, caja] = await Promise.all([
    tableroRepository(),
    contabilidadRepository(),
    puede('inventario.leer') ? inventarioRepository() : null,
    puede('solicitudes.leer') ? alumnosRepository() : null,
    puede('caja.leer') ? cajaRepository() : null,
  ]);
  const [tablero, totales, prestamos, lotes, existencias, solicitudes, deudores] = await Promise.all([
    tableroRepo.tableroDeAdministracion(sede),
    contabilidad.totalesDelMes(mes, sede),
    inventario ? inventario.prestamosAbiertos({ sedeId: sede }) : null,
    inventario ? tableroRepo.contarLotesConAlerta(sede) : null,
    inventario ? inventario.existencias({}) : null,
    alumnos ? alumnos.contarSolicitudesAbiertas(sede) : null,
    caja ? tableroRepo.resumenDeDeudores(sede) : null,
  ]);

  const datosDelTablero = valorDe(tablero);
  const avisos = alertasDeAdministracion({
    tablero: datosDelTablero ?? tableroEnCero(ctx.hoy),
    solicitudes: valorDe(solicitudes) ?? 0,
    prestamosAtrasados: atrasados(valorDe(prestamos) ?? []),
    lotesVencidos: valorDe(lotes)?.vencidos ?? 0,
    bajoMinimo: contarBajoMinimo(valorDe(existencias) ?? [], sede),
  });
  const fallos = fallidas([
    ['las alertas de caja, lo que entró y salió y el gráfico', tablero],
    ['los totales del mes', totales],
    ['los préstamos', prestamos],
    ['los insumos', lotes],
    ['los insumos', existencias],
    ['las solicitudes', solicitudes],
    ['lo vencido de las cuotas', deudores],
  ]);
  const nombreDeSede = sede ? ctx.sedes.find((s) => s.id === sede)?.nombre : undefined;
  const deuda = valorDe(deudores);
  const sedeLlamada = (id: Id | null | undefined) => (id ? ctx.sedes.find((s) => s.id === id) : undefined);
  const destinos: DestinosDeAvisos = {
    tablero: 'administracion',
    sede,
    puedeComprar: puede('inventario.comprar'),
    sedeDelEfectivo: sedeLlamada(datosDelTablero?.efectivoSinArqueo.sede),
    sedeDelArqueo: sedeLlamada(datosDelTablero?.arqueosConDiferencia.sede),
    faltaPrecioDeGrupos: (datosDelTablero?.sinPrecio.grupos ?? 0) > 0,
  };

  return (
    <>
      <Saludo ctx={ctx} acciones={<SelectorDeSedeDelTablero ctx={ctx} sede={sede} />} />
      <Acciones ctx={ctx} acciones={ACCIONES_DE_ADMINISTRACION} />
      <FuentesQueFallaron nombres={fallos} />

      <section aria-labelledby="atencion" className="grid gap-4">
        <h2 id="atencion" className="t-display text-3xl text-estructural">
          Requiere tu atención
        </h2>
        {avisos.visibles.length > 0 ? (
          <TarjetasDeAvisos avisos={avisos} destinos={destinos} />
        ) : fallos.length > 0 ? (
          <p className="text-tinta-suave">No encontramos alertas en lo que se pudo leer.</p>
        ) : (
          <EstadoVacio
            frase="¡Todo al día!"
            detalle={`Nada requiere tu atención en ${nombreDeSede ?? (ctx.sedes.length === 2 ? 'ninguna de las dos sedes' : 'ninguna sede')}.`}
          />
        )}
      </section>

      {datosDelTablero || totales.exito ? (
        <DineroDelMes
          ctx={ctx}
          sede={sede}
          mes={mes}
          tablero={datosDelTablero}
          resultado={totales.exito ? resumenParaPantalla(totales.valor).resultado : null}
          deben={totales.exito ? totales.valor.hoy.deben : null}
          vencido={deuda ? vencidos(deuda) : null}
        />
      ) : null}

      {datosDelTablero ? <GraficoSemanal titulo="Entró y salió · últimas 8 semanas" semanas={barrasDeSemanas(datosDelTablero.semanas, ALTO_DE_BARRAS)} /> : null}
    </>
  );
}

/** «septiembre», del día de corte del mes anterior. */
function mesAnteriorDe(corte: FechaISO): string {
  return nombreDelMes(corte.slice(0, 7)).replace(/ de \d{4}$/, '');
}

/**
 * «▲ 12 % más que en septiembre a esta fecha». El triángulo es decorativo:
 * la palabra («más», «menos», «igual») dice el sentido para quien no ve el
 * símbolo o no distingue el color.
 */
function Comparacion({ variacion, mesAnterior }: { readonly variacion: Variacion; readonly mesAnterior: string }) {
  if (variacion.sentido === 'sin_base') return <>Sin mes anterior para comparar.</>;
  if (variacion.sentido === 'igual') return <>Igual que en {mesAnterior} a esta fecha.</>;
  const sube = variacion.sentido === 'sube';
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span aria-hidden="true" className="text-estructural">
        {sube ? '▲' : '▼'}
      </span>
      <span>
        {variacion.porcentaje} % {sube ? 'más' : 'menos'} que en {mesAnterior} a esta fecha.
      </span>
    </span>
  );
}

const PRESENTACION_DE_RESULTADO: Record<ClaseDeResultado, { readonly palabra: string; readonly chip: TonoDeChip; readonly icono: NombreDeIcono; readonly tono: 'normal' | 'alerta' | 'bien' }> = {
  ganancia: { palabra: 'Ganancia', chip: 'verde', icono: 'check', tono: 'bien' },
  perdida: { palabra: 'Pérdida', chip: 'rojo', icono: 'alerta', tono: 'alerta' },
  sin_resultado: { palabra: 'Sin resultado', chip: 'gris', icono: 'info', tono: 'normal' },
};

/**
 * Las 4 cifras del mes (§7.7, punto 4). Entró y Salió salen del tablero
 * (día 1 a hoy, comparado con el mes anterior al mismo día); Resultado y Lo
 * que deben, del resumen del mes. Cada cifra aparece si su fuente respondió.
 */
function DineroDelMes({
  ctx,
  sede,
  mes,
  tablero,
  resultado,
  deben,
  vencido,
}: {
  readonly ctx: ContextoDePanel;
  readonly sede: Id | undefined;
  readonly mes: string;
  readonly tablero: TableroDeAdministracionEnBase | null;
  readonly resultado: ResultadoDelMes | null;
  readonly deben: Centavos | null;
  readonly vencido: { readonly cuantos: number; readonly monto: Centavos } | null;
}) {
  const cifras = tablero ? cifrasDelMes(tablero) : null;
  const mesAnterior = cifras ? mesAnteriorDe(cifras.corteAnterior) : '';
  const tono = resultado ? PRESENTACION_DE_RESULTADO[resultado.clase] : null;
  // «Lo que deben» de la caja se ve por sede: con ambas, el enlace va a la sede de trabajo.
  const trabajo = sedeDeTrabajo(ctx);
  const sedeDeLaCaja = sede ?? trabajo?.id;

  return (
    <section aria-labelledby="dinero-del-mes" className="grid gap-4">
      <h2 id="dinero-del-mes" className="t-display text-3xl text-estructural">
        Dinero de {nombreDelMes(mes).replace(/ de \d{4}$/, '')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {cifras ? (
          <>
            <Indicador
              icono="billete"
              etiqueta="Entró"
              cifra={formatearMontoExacto(cifras.entro)}
              detalle={<Comparacion variacion={cifras.variacionEntro} mesAnterior={mesAnterior} />}
              accion={{ href: enlaceContable(RUTAS_CONTABILIDAD.resumen, undefined, sede), texto: 'Ver el resumen' }}
            />
            <Indicador
              icono="recibo"
              etiqueta="Salió"
              cifra={formatearMontoExacto(cifras.salio)}
              detalle={<Comparacion variacion={cifras.variacionSalio} mesAnterior={mesAnterior} />}
              accion={{ href: enlaceContable(RUTAS_CONTABILIDAD.gastos, undefined, sede), texto: 'Ver los gastos' }}
            />
          </>
        ) : null}
        {resultado && tono ? (
          <Indicador
            icono="libro"
            etiqueta="Resultado del mes"
            cifra={formatearMontoExacto(Math.abs(resultado.resultado) as Centavos)}
            tono={tono.tono}
            detalle={
              <Chip tono={tono.chip} icono={tono.icono}>
                {tono.palabra}
              </Chip>
            }
            accion={{ href: enlaceContable(RUTAS_CONTABILIDAD.resumen, undefined, sede), texto: 'Ver la cuenta' }}
          />
        ) : null}
        {deben !== null ? (
          <Indicador
            icono="monedas"
            etiqueta="Lo que deben los alumnos"
            cifra={formatearMontoExacto(deben)}
            detalle={
              vencido
                ? vencido.cuantos > 0
                  ? `Vencido: ${formatearMontoExacto(vencido.monto)} de ${plural(vencido.cuantos, 'alumno', 'alumnos')}.`
                  : 'Nada vencido.'
                : undefined
            }
            accion={
              sedeDeLaCaja
                ? {
                    href: conSede(RUTAS_CAJA.deben, sedeDeLaCaja),
                    texto: !sede && trabajo && ctx.sedes.length > 1 ? `Ver quién debe · ${trabajo.nombre}` : 'Ver quién debe',
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </section>
  );
}
