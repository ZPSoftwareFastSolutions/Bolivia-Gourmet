/**
 * CAPA: Presentation / App — panel del estudiante.
 *
 * Guarda: sin sesión → acceso. Los datos salen del caso de uso `obtenerPanel`
 * con el repositorio creado para ESTA sesión; RLS garantiza que solo vea lo
 * suyo aunque alguien manipule la petición.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { obtenerPanel } from '@core/application/portal/solicitudes.usecase';
import { esPersonal, ETIQUETA_DE_ROL } from '@core/domain/identidad/rol';
import { estaAbierta } from '@core/domain/portal/solicitud';
import { catalogoAcademico, portalRepository } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { Icono } from '@/presentation/icons/Icono';
import { Aviso } from '@/presentation/formularios/Campos';
import { BotonEnviar } from '@/presentation/formularios/Interactivos';
import { EnlaceBoton } from '@ui/Boton';
import { Etiqueta } from '@ui/Marca';
import { cerrarSesion } from './actions';
import { AvisoIndisponible } from './_componentes/Marco';
import { TarjetaDePago, TarjetaDeSolicitud } from './_componentes/Panel';
import { exigirSesion } from './_sesion';

export const metadata: Metadata = { title: 'Mi panel' };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const MENSAJES: Record<string, { tono: 'exito' | 'error'; titulo: string; texto: string }> = {
  'enviada=inscripcion': { tono: 'exito', titulo: 'Solicitud enviada', texto: 'Recepción la revisará y te contactará. Puedes seguir su estado aquí.' },
  'enviada=renovacion': { tono: 'exito', titulo: 'Solicitud de renovación enviada', texto: 'Te avisaremos cuando la revisen.' },
  'cancelada=1': { tono: 'exito', titulo: 'Solicitud cancelada', texto: 'Puedes enviar una nueva cuando quieras.' },
  'clave=actualizada': { tono: 'exito', titulo: 'Contraseña actualizada', texto: 'Usa la nueva la próxima vez que entres.' },
  'bienvenida=1': { tono: 'exito', titulo: '¡Bienvenido!', texto: 'Tu cuenta está lista. Envía tu primera solicitud de inscripción.' },
  'error=cancelacion': { tono: 'error', titulo: 'No se pudo cancelar', texto: 'Solo se cancelan solicitudes que siguen pendientes.' },
};

export default async function Panel({ searchParams }: { readonly searchParams: Parametros }) {
  const usuario = await exigirSesion(RUTAS.portal);
  if (!usuario) return <AvisoIndisponible />;

  const [panel, programas, parametros] = await Promise.all([
    obtenerPanel(await portalRepository(usuario.id)),
    catalogoAcademico().listarProgramas(),
    searchParams,
  ]);
  const mensaje = Object.entries(parametros)
    .map(([clave, valor]) => MENSAJES[`${clave}=${String(valor)}`])
    .find(Boolean);

  if (!panel.exito) {
    return (
      <div className="shell py-16">
        <Aviso tono="error" titulo="No pudimos cargar tu panel">
          <p>{panel.error}</p>
        </Aviso>
      </div>
    );
  }

  const { perfil, solicitudes } = panel.valor;
  // El personal trabaja en el panel interno. `?panel=no` lo pone el propio panel
  // cuando la cuenta no puede entrar (desactivada o sin permiso): sin esa marca
  // se formaría un bucle de redirecciones entre /portal y /panel.
  const sinPanel = parametros.panel === 'no';
  if (esPersonal(perfil.rol) && !sinPanel) redirect(RUTAS.panel);
  const abiertas = solicitudes.filter(estaAbierta).length;
  const carrera = programas.find((p) => p.tipo === 'carrera') ?? null;

  return (
    <div className="shell grid gap-8 py-10 lg:py-14">
      <section aria-labelledby="saludo" className="flex flex-col justify-between gap-6 rounded-[var(--t-radio-xl)] bg-tarjeta p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="t-etiqueta flex items-center gap-2">
            Portal de estudiantes
            <Etiqueta tono={esPersonal(perfil.rol) ? 'azul' : 'suave'}>{ETIQUETA_DE_ROL[perfil.rol]}</Etiqueta>
          </p>
          <h1 id="saludo" className="mt-2 text-estructural">
            <span className="t-script text-3xl">Hola,</span>{' '}
            <span className="t-display text-5xl">{perfil.nombres || 'estudiante'}</span>
          </h1>
          <p className="mt-1 text-tinta-suave">
            {abiertas > 0 ? `Tienes ${abiertas} ${abiertas === 1 ? 'solicitud en curso' : 'solicitudes en curso'}.` : 'No tienes solicitudes en curso.'}
          </p>
        </div>
        <form action={cerrarSesion}>
          <BotonEnviar variante="secundario" icono="salir" enviando="Cerrando…" className="min-h-11">
            Cerrar sesión
          </BotonEnviar>
        </form>
      </section>

      {mensaje ? (
        <Aviso tono={mensaje.tono} titulo={mensaje.titulo}>
          <p>{mensaje.texto}</p>
        </Aviso>
      ) : null}

      {esPersonal(perfil.rol) ? (
        <Aviso tono="info" titulo="Tu cuenta es del personal">
          <p>Tu cuenta de {ETIQUETA_DE_ROL[perfil.rol].toLowerCase()} no puede entrar al panel interno ahora (puede estar desactivada). Pide a administración que la revise. Desde aquí ves el portal como un estudiante.</p>
        </Aviso>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="mis-solicitudes">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="mis-solicitudes" className="t-display text-4xl text-estructural">
              Mis solicitudes
            </h2>
            <div className="flex flex-wrap gap-2">
              <EnlaceBoton href={RUTAS.solicitud} tamano="sm" icono="mas">
                Nueva inscripción
              </EnlaceBoton>
              <EnlaceBoton href={RUTAS.renovacion} tamano="sm" variante="contorno" icono="renovar">
                Renovar gestión
              </EnlaceBoton>
            </div>
          </div>
          {solicitudes.length === 0 ? (
            <div className="mt-6 rounded-[var(--t-radio-lg)] border-2 border-dashed border-linea bg-tarjeta p-8 text-center">
              <span className="mx-auto inline-grid size-14 place-items-center rounded-full bg-accion text-sobre-accion">
                <Icono nombre="gorro" tamano={28} />
              </span>
              <p className="mt-4 text-lg font-bold text-tinta">Aún no enviaste ninguna solicitud</p>
              <p className="mt-1 text-tinta-suave">Elige la carrera o un curso y te contactamos para completar tu inscripción.</p>
              <EnlaceBoton href={RUTAS.solicitud} className="mt-5" icono="flecha" iconoAlFinal>
                Solicitar inscripción
              </EnlaceBoton>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4">
              {solicitudes.map((s) => (
                <li key={s.id}>
                  <TarjetaDeSolicitud solicitud={s} programa={programas.find((p) => p.codigo === s.programaCodigo)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="grid content-start gap-6">
          <TarjetaDePago carrera={carrera} />
          <section aria-labelledby="mis-datos" className="rounded-[var(--t-radio-lg)] bg-tarjeta p-6">
            <h2 id="mis-datos" className="flex items-center gap-2 text-xl font-bold text-estructural">
              <Icono nombre="usuario" />
              Mis datos
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-tinta-suave">Nombre</dt>
                <dd className="font-semibold text-tinta">{`${perfil.nombres} ${perfil.apellidos}`.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-tinta-suave">Correo</dt>
                <dd className="font-semibold break-all text-tinta">{perfil.correo || usuario.correo}</dd>
              </div>
              <div>
                <dt className="text-tinta-suave">Celular</dt>
                <dd className="font-semibold text-tinta">{perfil.telefono ?? 'Sin registrar'}</dd>
              </div>
              <div>
                <dt className="text-tinta-suave">Carnet de identidad</dt>
                <dd className="font-semibold text-tinta">{perfil.documento ?? 'Sin registrar'}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-tinta-suave">
              ¿Algún dato está mal? Avísanos al enviar tu solicitud o{' '}
              <Link href={RUTAS.contacto} className="enlace">
                escríbenos
              </Link>
              .
            </p>
          </section>
          {carrera ? (
            <section aria-labelledby="requisitos" className="rounded-[var(--t-radio-lg)] bg-tarjeta p-6">
              <h2 id="requisitos" className="flex items-center gap-2 text-xl font-bold text-estructural">
                <Icono nombre="documento" />
                Requisitos de la carrera
              </h2>
              <ul className="mt-3 grid gap-2 text-sm text-tinta-suave">
                {carrera.requisitos.map((r) => (
                  <li key={r.descripcion} className="flex gap-2">
                    <Icono nombre="check" tamano={16} className="mt-0.5 flex-none text-estructural" />
                    {r.descripcion}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
