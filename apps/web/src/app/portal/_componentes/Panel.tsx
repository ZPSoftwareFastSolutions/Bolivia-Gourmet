/**
 * CAPA: Presentation / App — piezas del panel del estudiante.
 *
 * La «intranet» simulada (aclaraciones §3): el estudiante ve sus solicitudes,
 * su estado explicado en una frase, la respuesta de recepción y cómo pagar.
 * Operatividad antes que decoración: tarjetas claras, estados con texto (no
 * solo color) y una sola acción principal por bloque.
 */

import { describirDuracion, ETIQUETA_DE_TURNO, formatearMonto, type Programa } from '@core/domain/academico/programa';
import {
  ETIQUETA_DE_ESTADO,
  ETIQUETA_DE_MODALIDAD,
  ETIQUETA_DE_PAQUETE,
  ETIQUETA_DE_TIPO_DE_SOLICITUD,
  EXPLICACION_DE_ESTADO,
  puedeCancelar,
  type EstadoDeSolicitud,
  type Solicitud,
} from '@core/domain/portal/solicitud';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { formatearFechaYHora } from '@/lib/fechas';
import { Icono } from '@/presentation/icons/Icono';
import { BotonEnviar } from '@/presentation/formularios/Interactivos';
import { Etiqueta } from '@ui/Marca';
import { cancelarSolicitud } from '../actions';

const TONO_DE_ESTADO: Record<EstadoDeSolicitud, 'amarillo' | 'azul' | 'exito' | 'peligro' | 'neutro'> = {
  pendiente: 'amarillo',
  en_revision: 'azul',
  aprobada: 'exito',
  rechazada: 'peligro',
  cancelada: 'neutro',
};

function detalles(solicitud: Solicitud, programa: Programa | undefined): readonly string[] {
  const lista: string[] = [`Sede ${solicitud.sedeNombre}`];
  if (solicitud.turno) lista.push(`Turno ${ETIQUETA_DE_TURNO[solicitud.turno].toLowerCase()}`);
  if (solicitud.dias) {
    const dias = programa?.diasDeClase.find((d) => d.codigo === solicitud.dias)?.etiqueta;
    lista.push(dias ?? solicitud.dias);
  }
  if (solicitud.duracion) {
    const unidad = programa && !esPendiente(programa.duracion) ? programa.duracion.unidad : 'meses';
    lista.push(describirDuracion({ unidad, opciones: [solicitud.duracion] }));
  }
  if (solicitud.modalidad) lista.push(ETIQUETA_DE_MODALIDAD[solicitud.modalidad]);
  if (solicitud.paquete) lista.push(ETIQUETA_DE_PAQUETE[solicitud.paquete]);
  if (solicitud.gestionAnterior) lista.push(`Viene de: ${solicitud.gestionAnterior}`);
  return lista;
}

export function TarjetaDeSolicitud({ solicitud, programa }: { readonly solicitud: Solicitud; readonly programa: Programa | undefined }) {
  return (
    <article className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="t-etiqueta">{ETIQUETA_DE_TIPO_DE_SOLICITUD[solicitud.tipo]}</p>
          <h3 className="t-display mt-1 text-3xl text-estructural">{solicitud.programaNombre}</h3>
        </div>
        <Etiqueta tono={TONO_DE_ESTADO[solicitud.estado]}>{ETIQUETA_DE_ESTADO[solicitud.estado]}</Etiqueta>
      </div>
      <p className="mt-3 text-tinta">{EXPLICACION_DE_ESTADO[solicitud.estado]}</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-suave">
        {detalles(solicitud, programa).map((d) => (
          <li key={d} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accion-fuerte" />
            {d}
          </li>
        ))}
      </ul>
      {solicitud.mensaje ? (
        <p className="mt-3 rounded-md bg-superficie-alterna p-3 text-sm text-tinta-suave">
          <span className="font-semibold text-tinta">Tu mensaje: </span>
          {solicitud.mensaje}
        </p>
      ) : null}
      {solicitud.respuesta ? (
        <p className="mt-3 rounded-md border-s-4 border-estructural bg-superficie-alterna p-3 text-sm text-tinta">
          <span className="font-semibold">Respuesta de la institución: </span>
          {solicitud.respuesta}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-4">
        <p className="text-sm text-tinta-suave">Enviada el {formatearFechaYHora(solicitud.creadaEn)}</p>
        {puedeCancelar(solicitud) ? (
          <form action={cancelarSolicitud}>
            <input type="hidden" name="id" value={solicitud.id} />
            <BotonEnviar variante="peligro" enviando="Cancelando…" className="min-h-11 px-4 text-sm">
              Cancelar solicitud
            </BotonEnviar>
          </form>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Cómo pagar. El medio es QR (aclaraciones §4), pero el QR bancario todavía
 * no se ha recibido: se explica el procedimiento sin mostrar un QR falso.
 */
export function TarjetaDePago({ carrera }: { readonly carrera: Programa | null }) {
  const precios = carrera && !esPendiente(carrera.costo) ? carrera.costo : [];
  return (
    <section aria-labelledby="pago" className="rounded-[var(--t-radio-lg)] bg-estructural p-6 text-sobre-estructural">
      <h2 id="pago" className="flex items-center gap-3 text-xl font-bold">
        <span className="inline-grid size-10 place-items-center rounded-full bg-accion text-sobre-accion">
          <Icono nombre="qr" tamano={20} />
        </span>
        Pago por QR
      </h2>
      <p className="mt-3 text-sobre-estructural/85">
        Cuando recepción apruebe tu solicitud, realizas el pago escaneando el QR del instituto en tu sede. Pronto podrás hacerlo desde aquí.
      </p>
      {carrera && precios.length > 0 ? (
        <div className="mt-5 rounded-md bg-sobre-estructural/10 p-4">
          <p className="t-etiqueta text-accion">Carrera de {carrera.nombre}</p>
          <dl className="mt-2 grid gap-2">
            {precios.map((p) => (
              <div key={p.etiqueta} className="flex justify-between gap-3">
                <dt>{p.etiqueta}</dt>
                <dd className="font-bold">{formatearMonto(p.monto)}</dd>
              </div>
            ))}
            {!esPendiente(carrera.uniforme) ? (
              <div className="flex justify-between gap-3">
                <dt>{carrera.uniforme.etiqueta}</dt>
                <dd className="font-bold">{formatearMonto(carrera.uniforme.monto)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
      <p className="mt-4 text-sm text-sobre-estructural/75">Cursos cortos: el costo se confirma en cada apertura.</p>
    </section>
  );
}
