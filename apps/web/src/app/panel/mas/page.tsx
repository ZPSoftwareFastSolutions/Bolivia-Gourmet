/**
 * CAPA: Presentation / App — «Más» (solo en el teléfono).
 *
 * La barra inferior lleva cuatro secciones; lo que no cabe (Contabilidad,
 * Ajustes), la persona, el enlace al sitio y «Cerrar sesión» viven aquí, con
 * el mismo mosaico grande del inicio.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { sedeDeTrabajo } from '@core/domain/identidad/contexto-de-panel';
import { ETIQUETA_DE_ROL } from '@core/domain/identidad/rol';
import { RUTAS } from '@/lib/rutas';
import { Icono } from '@/presentation/icons/Icono';
import { BotonEnviar } from '@/presentation/formularios/Interactivos';
import { seccionesVisibles } from '@/presentation/panel/navegacion';
import { EncabezadoDePanel, Mosaico } from '@/presentation/panel/Piezas';
import { cerrarSesion } from '../../portal/actions';
import { exigirPersonal } from '../_sesion';

export const metadata: Metadata = { title: 'Más' };

export default async function Mas() {
  const lectura = await exigirPersonal();
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  const extra = seccionesVisibles(ctx.permisos).filter((s) => !s.enBarraInferior);
  const sede = sedeDeTrabajo(ctx);
  const nombre = [ctx.nombres, ctx.apellidos].filter(Boolean).join(' ') || ctx.correo;

  return (
    <div className="grid gap-8">
      <EncabezadoDePanel titulo="Más" />

      {extra.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {extra.map((s) => (
            <Mosaico key={s.href} href={s.href} icono={s.icono} titulo={s.etiqueta} />
          ))}
        </div>
      ) : null}

      <section aria-labelledby="mi-cuenta" className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5">
        <h2 id="mi-cuenta" className="t-etiqueta">
          Mi cuenta
        </h2>
        <p>
          <span className="block font-semibold text-tinta">{nombre}</span>
          <span className="block text-sm text-tinta-suave">
            {ETIQUETA_DE_ROL[ctx.rol]}
            {sede ? ` · ${sede.nombre}` : ''}
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={cerrarSesion}>
            <BotonEnviar variante="secundario" icono="salir" enviando="Cerrando…">
              Cerrar sesión
            </BotonEnviar>
          </form>
          <Link href={RUTAS.inicio} className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold text-estructural hover:bg-superficie-alterna">
            <Icono nombre="externo" tamano={18} />
            Ver el sitio web
          </Link>
        </div>
      </section>
    </div>
  );
}
