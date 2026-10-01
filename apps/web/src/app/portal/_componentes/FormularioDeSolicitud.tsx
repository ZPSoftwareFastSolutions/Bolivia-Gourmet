'use client';

/**
 * CAPA: Presentation / App — formulario de solicitud (inscripción o renovación).
 *
 * Recibe las opciones YA resueltas del programa elegido (el servidor las
 * saca del catálogo): solo se muestran los campos que ese programa usa. Un
 * curso sin turnos no pregunta turno; la carrera pregunta paquete. El dominio
 * vuelve a validarlo todo en el servidor.
 */

import { useActionState } from 'react';
import { AreaDeTexto, CampoDeTexto, GrupoDeOpciones, type OpcionDeEleccion } from '@/presentation/formularios/Campos';
import { ESTADO_INICIAL } from '@/presentation/formularios/estado';
import { BotonEnviar, ResumenDeErrores } from '@/presentation/formularios/Interactivos';
import { crearSolicitud } from '../actions';

export interface OpcionesDeSolicitud {
  readonly tipo: 'inscripcion' | 'renovacion';
  readonly programaCodigo: string;
  readonly sedes: readonly OpcionDeEleccion[];
  readonly turnos: readonly OpcionDeEleccion[];
  readonly dias: readonly OpcionDeEleccion[];
  readonly duraciones: readonly OpcionDeEleccion[];
  readonly modalidades: readonly OpcionDeEleccion[];
  readonly paquetes: readonly OpcionDeEleccion[];
}

export function FormularioDeSolicitud({ opciones }: { readonly opciones: OpcionesDeSolicitud }) {
  const [estado, accion] = useActionState(crearSolicitud, ESTADO_INICIAL);
  const v = estado.valores ?? {};
  const renovacion = opciones.tipo === 'renovacion';

  return (
    <form action={accion} className="grid gap-7" noValidate>
      <ResumenDeErrores mensaje={estado.estado === 'error' ? estado.mensaje : undefined} />
      <input type="hidden" name="tipo" value={opciones.tipo} />
      <input type="hidden" name="programa" value={opciones.programaCodigo} />

      {renovacion ? (
        <CampoDeTexto
          id="gestionAnterior"
          etiqueta="¿De qué gestión vienes?"
          maxLength={60}
          ayuda="Por ejemplo: «Gestión 2026», «1.er año» o «Curso de Tortas 2 meses»."
          defaultValue={v.gestionAnterior}
        />
      ) : null}

      <GrupoDeOpciones nombre="sede" leyenda="Sede" opciones={opciones.sedes} valor={v.sede} />
      {opciones.turnos.length > 0 ? (
        <GrupoDeOpciones nombre="turno" leyenda="Turno" opciones={opciones.turnos} valor={v.turno} columnas={opciones.turnos.length > 2 ? 3 : 2} />
      ) : null}
      {opciones.dias.length > 0 ? <GrupoDeOpciones nombre="dias" leyenda="Días de clase" opciones={opciones.dias} valor={v.dias} /> : null}
      {opciones.duraciones.length > 0 ? (
        <GrupoDeOpciones nombre="duracion" leyenda="Duración" opciones={opciones.duraciones} valor={v.duracion} columnas={3} />
      ) : null}
      {opciones.modalidades.length > 0 ? (
        <GrupoDeOpciones nombre="modalidad" leyenda="Modalidad" opciones={opciones.modalidades} valor={v.modalidad} columnas={3} />
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
        ayuda="Dudas, preferencias de horario o cualquier dato que debamos saber. Hasta 500 caracteres."
        defaultValue={v.mensaje}
      />

      <BotonEnviar icono="check" enviando="Enviando solicitud…" className="w-full sm:w-auto sm:justify-self-start">
        {renovacion ? 'Enviar solicitud de renovación' : 'Enviar solicitud de inscripción'}
      </BotonEnviar>
    </form>
  );
}
