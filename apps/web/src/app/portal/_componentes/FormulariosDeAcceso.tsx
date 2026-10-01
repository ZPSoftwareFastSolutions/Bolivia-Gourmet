'use client';

/**
 * CAPA: Presentation / App — formularios de acceso del portal.
 *
 * Con `useActionState` funcionan también antes de que cargue el JavaScript
 * (el formulario se envía y el servidor devuelve la página con el estado).
 * `autoComplete` correcto en cada campo: el gestor de contraseñas del
 * navegador debe poder rellenarlos y generar claves (accessible authentication).
 */

import Link from 'next/link';
import { useActionState } from 'react';
import { LONGITUD_MINIMA_DE_CLAVE } from '@core/domain/identidad/credenciales';
import { RUTAS } from '@/lib/rutas';
import { Aviso, CampoDeTexto } from '@/presentation/formularios/Campos';
import { ESTADO_INICIAL } from '@/presentation/formularios/estado';
import { BotonEnviar, CampoClave, ResumenDeErrores } from '@/presentation/formularios/Interactivos';
import { cambiarClave, iniciarSesion, registrarse, solicitarRecuperacion } from '../actions';

const AYUDA_DE_CLAVE = `Al menos ${LONGITUD_MINIMA_DE_CLAVE} caracteres, con letras y números. Una frase corta es más segura y fácil de recordar.`;

export function FormularioDeAcceso({ siguiente, aviso }: { readonly siguiente: string; readonly aviso?: string }) {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);
  return (
    <form action={accion} className="grid gap-5" noValidate>
      {aviso && estado.estado === 'inicial' ? <Aviso tono="info">{aviso}</Aviso> : null}
      <ResumenDeErrores mensaje={estado.estado === 'error' ? estado.mensaje : undefined} />
      <input type="hidden" name="siguiente" value={siguiente} />
      <CampoDeTexto id="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" inputMode="email" defaultValue={estado.valores?.correo} />
      <CampoClave id="clave" etiqueta="Contraseña" autoComplete="current-password" />
      <div className="-mt-2 text-end">
        <Link href={RUTAS.recuperar} className="enlace text-sm">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <BotonEnviar icono="usuario" enviando="Entrando…" className="w-full">
        Entrar al portal
      </BotonEnviar>
    </form>
  );
}

export function FormularioDeRegistro() {
  const [estado, accion] = useActionState(registrarse, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};

  if (estado.estado === 'exito') {
    return (
      <Aviso tono="exito" titulo="Revisa tu correo">
        <p>{estado.mensaje}</p>
        <p className="mt-2">Si no lo ves en unos minutos, busca en «Correo no deseado».</p>
        <Link href={RUTAS.acceso} className="enlace mt-3 inline-block">
          Ir a iniciar sesión
        </Link>
      </Aviso>
    );
  }

  return (
    <form action={accion} className="grid gap-5" noValidate>
      <ResumenDeErrores errores={estado.estado === 'error' ? e : undefined} />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoDeTexto id="nombres" etiqueta="Nombres" autoComplete="given-name" maxLength={80} defaultValue={v.nombres} error={e.nombres} />
        <CampoDeTexto id="apellidos" etiqueta="Apellidos" autoComplete="family-name" maxLength={80} defaultValue={v.apellidos} error={e.apellidos} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoDeTexto
          id="telefono"
          etiqueta="Celular"
          opcional
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          ayuda="8 dígitos, por ejemplo 71234567."
          defaultValue={v.telefono}
          error={e.telefono}
        />
        <CampoDeTexto
          id="documento"
          etiqueta="Carnet de identidad"
          opcional
          maxLength={20}
          ayuda="Con su extensión si la tiene, por ejemplo 1234567-LP."
          defaultValue={v.documento}
          error={e.documento}
        />
      </div>
      <CampoDeTexto id="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" inputMode="email" defaultValue={v.correo} error={e.correo} />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoClave id="clave" etiqueta="Contraseña" autoComplete="new-password" ayuda={AYUDA_DE_CLAVE} error={e.clave} />
        <CampoClave id="confirmacion" etiqueta="Repite la contraseña" autoComplete="new-password" error={e.confirmacion} />
      </div>
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-tinta">
          <input
            id="aceptaPrivacidad"
            type="checkbox"
            name="aceptaPrivacidad"
            value="si"
            required
            aria-invalid={e.aceptaPrivacidad ? true : undefined}
            aria-describedby={e.aceptaPrivacidad ? 'aceptaPrivacidad-error' : undefined}
            className="mt-1 size-5 flex-none accent-[var(--t-estructural)]"
          />
          <span>
            Leí y acepto el{' '}
            <Link href={RUTAS.privacidad} className="enlace" target="_blank">
              aviso de privacidad
            </Link>
            .
          </span>
        </label>
        {e.aceptaPrivacidad ? (
          <p id="aceptaPrivacidad-error" className="mt-1.5 text-sm font-semibold text-peligro">
            {e.aceptaPrivacidad}
          </p>
        ) : null}
      </div>
      <BotonEnviar icono="check" enviando="Creando tu cuenta…" className="w-full">
        Crear mi cuenta
      </BotonEnviar>
    </form>
  );
}

export function FormularioDeRecuperacion() {
  const [estado, accion] = useActionState(solicitarRecuperacion, ESTADO_INICIAL);
  if (estado.estado === 'exito') {
    return (
      <Aviso tono="exito" titulo="Revisa tu correo">
        <p>{estado.mensaje}</p>
      </Aviso>
    );
  }
  return (
    <form action={accion} className="grid gap-5" noValidate>
      <ResumenDeErrores mensaje={estado.estado === 'error' ? estado.mensaje : undefined} />
      <CampoDeTexto id="correo" etiqueta="Correo electrónico de tu cuenta" type="email" autoComplete="email" inputMode="email" defaultValue={estado.valores?.correo} />
      <BotonEnviar icono="correo" enviando="Enviando enlace…" className="w-full">
        Enviarme el enlace
      </BotonEnviar>
    </form>
  );
}

export function FormularioDeNuevaClave() {
  const [estado, accion] = useActionState(cambiarClave, ESTADO_INICIAL);
  return (
    <form action={accion} className="grid gap-5" noValidate>
      <ResumenDeErrores mensaje={estado.estado === 'error' ? estado.mensaje : undefined} />
      <CampoClave id="clave" etiqueta="Nueva contraseña" autoComplete="new-password" ayuda={AYUDA_DE_CLAVE} />
      <CampoClave id="confirmacion" etiqueta="Repite la nueva contraseña" autoComplete="new-password" />
      <BotonEnviar icono="check" enviando="Guardando…" className="w-full">
        Guardar contraseña
      </BotonEnviar>
    </form>
  );
}
