'use client';

/**
 * CAPA: Presentation / App — formulario de solicitud (inscripción o renovación).
 *
 * Desde el ADR 0009 se elige un GRUPO en convocatoria: el grupo trae la sede,
 * los días, el horario y las fechas, así que no se preguntan. Recibe las
 * opciones YA resueltas en el servidor: cada grupo con sus líneas y, si no se
 * puede pedir, el motivo (cruce de horario, ya inscrito…). Un grupo bloqueado
 * se ve desactivado y dice por qué (no solo con color). El dominio y la base
 * vuelven a validarlo todo.
 */

import { useActionState } from 'react';
import { AreaDeTexto, CampoDeTexto, GrupoDeOpciones, type OpcionDeEleccion } from '@/presentation/formularios/Campos';
import { ESTADO_INICIAL } from '@/presentation/formularios/estado';
import { BotonEnviar, ResumenDeErrores } from '@/presentation/formularios/Interactivos';
import { Icono } from '@/presentation/icons/Icono';
import { crearSolicitud } from '../actions';

export interface OpcionDeGrupo {
  readonly valor: string;
  readonly titulo: string;
  readonly lineas: readonly string[];
  /** Si no se puede pedir: por qué (la misma frase que daría la base). */
  readonly bloqueo?: string;
  /** Se puede pedir, pero hay algo que confirmar con recepción. */
  readonly aviso?: string;
}

export interface OpcionesDeSolicitud {
  readonly tipo: 'inscripcion' | 'renovacion';
  readonly programaCodigo: string;
  readonly grupos: readonly OpcionDeGrupo[];
  readonly paquetes: readonly OpcionDeEleccion[];
  /** Renovación: lo que se propone como gestión anterior (su último año en la carrera). */
  readonly gestionSugerida?: string;
}

export function FormularioDeSolicitud({ opciones }: { readonly opciones: OpcionesDeSolicitud }) {
  const [estado, accion] = useActionState(crearSolicitud, ESTADO_INICIAL);
  const v = estado.valores ?? {};
  const renovacion = opciones.tipo === 'renovacion';
  const disponibles = opciones.grupos.filter((g) => !g.bloqueo);
  // Con un solo grupo disponible, ya viene elegido.
  const elegido = v.grupo ?? (disponibles.length === 1 ? disponibles[0]?.valor : undefined);

  return (
    <form action={accion} className="grid gap-7" noValidate>
      <ResumenDeErrores mensaje={estado.estado === 'error' ? estado.mensaje : undefined} />
      <input type="hidden" name="tipo" value={opciones.tipo} />
      <input type="hidden" name="programa" value={opciones.programaCodigo} />

      {/* `id` = nombre del campo: el resumen de errores enlaza a `#grupo`. */}
      <fieldset id="grupo">
        <legend className="mb-2 font-semibold text-tinta">Elige tu grupo</legend>
        <p className="-mt-1 mb-3 text-sm text-tinta-suave">El grupo fija la sede, los días, el horario y las fechas.</p>
        <div className="grid gap-3">
          {opciones.grupos.map((g) => (
            <label
              key={g.valor}
              className={
                g.bloqueo
                  ? 'flex cursor-not-allowed items-start gap-3 rounded-md border-2 border-dashed border-linea bg-superficie-alterna p-4 opacity-60'
                  : 'flex min-h-14 cursor-pointer items-start gap-3 rounded-md border-2 border-linea bg-tarjeta p-4 transition-colors duration-150 hover:border-estructural/40 has-[:checked]:border-estructural has-[:checked]:bg-superficie-alterna has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accion/60'
              }
            >
              <input
                type="radio"
                name="grupo"
                value={g.valor}
                disabled={Boolean(g.bloqueo)}
                defaultChecked={!g.bloqueo && elegido === g.valor}
                required={g.valor === disponibles[0]?.valor}
                className="mt-1 size-4 flex-none accent-[var(--t-estructural)]"
              />
              <span className="grid gap-1">
                <span className="font-semibold text-tinta">{g.titulo}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-tinta-suave">
                  {g.lineas.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </span>
                {g.bloqueo ? (
                  <span className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-peligro">
                    <Icono nombre="alerta" tamano={16} className="mt-0.5 flex-none" />
                    {g.bloqueo}
                  </span>
                ) : null}
                {g.aviso ? (
                  <span className="mt-1 flex items-start gap-1.5 text-sm text-tinta">
                    <Icono nombre="info" tamano={16} className="mt-0.5 flex-none text-estructural" />
                    {g.aviso}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {renovacion ? (
        <CampoDeTexto
          id="gestionAnterior"
          etiqueta="¿De qué gestión vienes?"
          maxLength={60}
          ayuda="Por ejemplo: «1.er año · gestión 2026». Recepción lo comprueba."
          defaultValue={v.gestionAnterior ?? opciones.gestionSugerida}
        />
      ) : null}

      {opciones.paquetes.length > 0 ? (
        <GrupoDeOpciones
          nombre="paquete"
          leyenda="Paquete de pago"
          opciones={opciones.paquetes}
          valor={v.paquete}
          ayuda="El pago se realiza por QR. Recepción te confirmará la modalidad al revisar tu solicitud."
        />
      ) : null}

      <AreaDeTexto
        id="mensaje"
        etiqueta="Mensaje para recepción"
        opcional
        maxLength={500}
        ayuda="Dudas o cualquier dato que debamos saber. Hasta 500 caracteres."
        defaultValue={v.mensaje}
      />

      <BotonEnviar icono="check" enviando="Enviando solicitud…" className="w-full sm:w-auto sm:justify-self-start">
        {renovacion ? 'Enviar solicitud de renovación' : 'Enviar solicitud de inscripción'}
      </BotonEnviar>
    </form>
  );
}
