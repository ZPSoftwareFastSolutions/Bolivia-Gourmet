/**
 * CAPA: Presentation / App — editar los datos de una ficha.
 *
 * Escritura directa por columnas concedidas (la base normaliza y vuelve a
 * validar). El código y la cuenta del portal no se tocan desde aquí.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { alumnosRepository } from '@infra/config/composition-root';
import { rutaDeAlumno } from '@/lib/rutas';
import { Aviso, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { editarAlumnoAccion } from '../../actions';
import { CamposDeFicha } from '../../_componentes';

export const metadata: Metadata = { title: 'Editar ficha' };

export default async function EditarFicha({ params }: { readonly params: Promise<{ readonly codigo: string }> }) {
  const { codigo } = await params;
  const lectura = await exigirPersonal(`${rutaDeAlumno(codigo)}/editar`);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'estudiantes.gestionar');

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

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={rutaDeAlumno(a.codigo)} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
        <Icono nombre="flechaIzquierda" tamano={16} />
        Volver a la ficha
      </Link>
      <EncabezadoDePanel titulo="Editar datos" descripcion={`${a.nombres} ${a.apellidos} · ${a.codigo}`} />
      <FormularioDelPanel accion={editarAlumnoAccion} className="rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-5 sm:p-6">
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="codigo" value={a.codigo} />
        {ctx.sedes.length > 1 ? (
          <GrupoDeOpciones nombre="sede" leyenda="Sede habitual" opciones={ctx.sedes.map((s) => ({ valor: s.id, etiqueta: s.nombre, detalle: s.zona }))} valor={a.sedeId} />
        ) : null}
        <CamposDeFicha
          valores={{
            nombres: a.nombres,
            apellidos: a.apellidos,
            documento: a.documento,
            telefono: a.telefono,
            correo: a.correo,
            fechaDeNacimiento: a.fechaDeNacimiento,
            observaciones: a.observaciones,
          }}
        />
        <BotonGuardar className="justify-self-start">Guardar cambios</BotonGuardar>
      </FormularioDelPanel>
    </div>
  );
}
