/**
 * CAPA: Presentation / App — bandeja de solicitudes del portal.
 *
 * Quién pidió qué y desde cuándo espera. Por defecto las que hay que atender
 * (pendientes y en revisión), lo más antiguo primero; «Todas» muestra también
 * las cerradas, lo más reciente primero (es un historial: lo que se busca ahí
 * suele ser lo último). La lista se corta en `TOPE_DE_SOLICITUDES` (el tope
 * del puerto, el mismo que aplica el adaptador) y, si se corta, se dice.
 * Acción por fila: «Atender» (o «Ver» si ya está cerrada).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ETIQUETA_DE_TURNO, type Turno } from '@core/domain/academico/programa';
import { TOPE_DE_SOLICITUDES, type EstadoDeSolicitudEnBandeja } from '@core/application/ports/alumnos.port';
import { alumnosRepository, catalogoAcademico } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { haceCuanto } from '@/lib/fechas';
import { RUTAS_ALUMNOS, rutaDeSolicitudDelPanel } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, Confirmacion, EncabezadoDePanel, EstadoVacio, Iniciales } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { ETIQUETA_DE_ESTADO_DE_SOLICITUD, parametro, PestanasDeAlumnos, TONO_DE_SOLICITUD, type Parametros } from '../_componentes';

export const metadata: Metadata = { title: 'Solicitudes del portal' };

const ABIERTAS: readonly EstadoDeSolicitudEnBandeja[] = ['pendiente', 'en_revision'];
const TODAS: readonly EstadoDeSolicitudEnBandeja[] = ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada'];

/** «1.250»: cantidad con punto de miles. */
function conMiles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export default async function Solicitudes({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_ALUMNOS.solicitudes), searchParams]);
  if (lectura.estado !== 'ok') return null;
  exigirPermiso(lectura.contexto, 'solicitudes.leer');

  const todas = parametro(valores, 'ver') === 'todas';
  const repo = await alumnosRepository();
  const [lista, abiertas, programas] = await Promise.all([
    todas ? repo.listarSolicitudes(TODAS, 'recientes_primero') : repo.listarSolicitudes(ABIERTAS, 'antiguas_primero'),
    repo.contarSolicitudesAbiertas(),
    catalogoAcademico().listarProgramas(),
  ]);
  const nombreDe = (codigo: string) => programas.find((p) => p.codigo === codigo)?.nombre ?? codigo;
  const respondida = parametro(valores, 'respondida');
  // «Por atender» sabe cuántas hay (el mismo conteo de la pestaña); «Todas», no.
  const cortada = lista.exito && lista.valor.length >= TOPE_DE_SOLICITUDES && (todas || !abiertas.exito || abiertas.valor > lista.valor.length);
  const avisoDeTope = !cortada
    ? null
    : todas
      ? `Se muestran las ${TOPE_DE_SOLICITUDES} más recientes; las anteriores no salen en esta lista.`
      : abiertas.exito
        ? `Se muestran las primeras ${TOPE_DE_SOLICITUDES} de ${conMiles(abiertas.valor)}: las que más tiempo llevan esperando.`
        : `Se muestran las primeras ${TOPE_DE_SOLICITUDES}: las que más tiempo llevan esperando. Puede haber más.`;

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Solicitudes"
        resaltado="del portal"
        descripcion={
          todas
            ? 'Todo lo que pidieron los alumnos desde la web, lo más reciente primero.'
            : 'Lo que piden los alumnos desde la web. Atiende primero lo que lleva más tiempo esperando.'
        }
      />
      <PestanasDeAlumnos activa={RUTAS_ALUMNOS.solicitudes} solicitudes={abiertas.exito ? abiertas.valor : 0} />

      {respondida === 'rechazada' || respondida === 'en_revision' ? (
        <Confirmacion
          palabra="¡Enviado!"
          titulo={respondida === 'rechazada' ? 'La solicitud quedó rechazada' : 'Pediste más datos al alumno'}
          cerrarHref={RUTAS_ALUMNOS.solicitudes}
        >
          <p>El alumno ya ve tu respuesta en su portal.</p>
        </Confirmacion>
      ) : null}

      <nav aria-label="Filtrar solicitudes" className="flex flex-wrap gap-2">
        {[
          { href: RUTAS_ALUMNOS.solicitudes, etiqueta: 'Por atender', activo: !todas },
          { href: `${RUTAS_ALUMNOS.solicitudes}?ver=todas`, etiqueta: 'Todas', activo: todas },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.activo ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border-2 px-4 font-semibold',
              f.activo ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar las solicitudes">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio
          frase="¡Bandeja al día!"
          detalle={
            todas
              ? 'Todavía no llegó ninguna solicitud desde el portal. Aparecen aquí apenas el alumno las envía.'
              : 'No hay solicitudes esperando. Las nuevas aparecen aquí apenas el alumno las envía.'
          }
        />
      ) : (
        <>
          {avisoDeTope ? <p className="-mb-3 text-sm text-tinta-suave">{avisoDeTope}</p> : null}
          <ul className="grid gap-3">
            {lista.valor.map((s) => {
              const abierta = s.estado === 'pendiente' || s.estado === 'en_revision';
              return (
                <li key={s.id}>
                  <Link
                    href={rutaDeSolicitudDelPanel(s.id)}
                    className="mosaico flex flex-wrap items-center gap-4 rounded-[var(--t-radio-lg)] border-2 border-linea bg-tarjeta p-4 hover:border-estructural"
                  >
                    <Iniciales nombres={s.nombres} apellidos={s.apellidos} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg leading-tight font-bold text-estructural">
                        {[s.nombres, s.apellidos].filter(Boolean).join(' ') || s.correo || 'Alumno del portal'}
                      </span>
                      <span className="mt-0.5 block text-sm text-tinta-suave">
                        {nombreDe(s.programaCodigo)} · {s.sedeNombre}
                        {s.turno ? ` · ${ETIQUETA_DE_TURNO[s.turno as Turno] ?? s.turno}` : ''} · {abierta ? 'espera desde' : 'enviada'} {haceCuanto(s.creadaEn)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip tono={s.tipo === 'renovacion' ? 'azul' : 'gris'} icono={s.tipo === 'renovacion' ? 'renovar' : 'mas'} contorno>
                        {s.tipo === 'renovacion' ? 'Renovación' : 'Inscripción'}
                      </Chip>
                      <Chip tono={TONO_DE_SOLICITUD[s.estado]}>{ETIQUETA_DE_ESTADO_DE_SOLICITUD[s.estado]}</Chip>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-estructural">
                      {abierta ? 'Atender' : 'Ver'}
                      <Icono nombre="flecha" tamano={18} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
