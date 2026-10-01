/**
 * CAPA: Presentation / App — Detalle de un curso.
 *
 * Reproduce la ficha del folleto B: temáticas o contenido por bloques con
 * checks rojos, y los campos que el folleto deja en blanco para cada apertura
 * (inicio, costo, uniforme). Aquí se muestran como «Consultar» con un enlace
 * directo a WhatsApp: la verdad es que dependen de cada apertura.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { describirDuracion, ETIQUETA_DE_TIPO, formatearMonto, type Programa } from '@core/domain/academico/programa';
import { ETIQUETA_DE_MODALIDAD } from '@core/domain/portal/solicitud';
import { enlaceDeWhatsApp } from '@core/domain/shared/sede';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '@/presentation/icons/Icono';
import { aspectoDePrograma } from '@/presentation/programas';
import { EnlaceBoton } from '@ui/Boton';
import { Etiqueta, ListaConCheck, TituloDeSeccion } from '@ui/Marca';
import { EncabezadoDePagina } from '@sections/Hero';
import { ContenidoPorBloques, Ficha, textoDeDias, textoDeTurnos, type DatoDeFicha } from '@sections/Oferta';

interface Parametros {
  readonly params: Promise<{ codigo: string }>;
}

async function cursoPorCodigo(codigo: string): Promise<Programa | null> {
  const programa = await catalogoAcademico().programaPorCodigo(codigo);
  // La carrera tiene su propia página; aquí solo cursos activos.
  return programa && programa.activo && programa.tipo !== 'carrera' ? programa : null;
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const curso = await cursoPorCodigo((await params).codigo);
  if (!curso) return { title: 'Curso no encontrado' };
  return {
    title: `Curso de ${curso.nombre}`,
    description: `${ETIQUETA_DE_TIPO[curso.tipo]} de ${curso.nombre} en ${INSTITUTO.nombreCorto}. Duración: ${describirDuracion(curso.duracion)}. ${curso.beneficios.join('. ')}`,
  };
}

export default async function DetalleDeCurso({ params }: Parametros) {
  const curso = await cursoPorCodigo((await params).codigo);
  if (!curso) notFound();

  const sedes = (await catalogoAcademico().listarSedes()).filter((s) => s.activa);
  const turnos = textoDeTurnos(curso);
  const consulta = `Hola, quiero información del curso de ${curso.nombre}: fechas de inicio, costo y uniforme.`;

  const datos: DatoDeFicha[] = [
    { icono: 'calendario', titulo: 'Duración', valor: describirDuracion(curso.duracion) },
    { icono: 'reloj', titulo: 'Días de clase', valor: textoDeDias(curso) },
    ...(turnos ? [{ icono: 'reloj' as const, titulo: 'Turnos', valor: turnos }] : []),
    ...(curso.modulos ? [{ icono: 'cubiertos' as const, titulo: 'Módulos', valor: curso.modulos.join(' · ') }] : []),
    ...(curso.modalidades.length > 0
      ? [{ icono: 'chispas' as const, titulo: 'Modalidades', valor: curso.modalidades.map((m) => ETIQUETA_DE_MODALIDAD[m]).join(' · ') }]
      : []),
    { icono: 'calendario', titulo: 'Inicio de clases', valor: esPendiente(curso.inicioPublicado) ? 'Consultar' : curso.inicioPublicado },
    {
      icono: 'monedas',
      titulo: 'Costo',
      valor: esPendiente(curso.costo) ? 'Consultar' : curso.costo.map((p) => `${p.etiqueta}: ${formatearMonto(p.monto)}`).join(' · '),
    },
    { icono: 'chaqueta', titulo: 'Uniforme', valor: esPendiente(curso.uniforme) ? 'Consultar' : formatearMonto(curso.uniforme.monto) },
  ];

  return (
    <>
      <EncabezadoDePagina
        tono="cursos"
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Cursos', href: RUTAS.cursos }, { etiqueta: curso.nombre }]}
        etiqueta={ETIQUETA_DE_TIPO[curso.tipo]}
        display={curso.nombre}
        foto={aspectoDePrograma(curso.codigo).foto}
        descripcion={
          <div className="flex flex-wrap gap-2">
            {curso.beneficios.map((b) => (
              <Etiqueta key={b} tono={b.toLowerCase().includes('gratis') ? 'amarillo' : 'suave'}>
                {b}
              </Etiqueta>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3">
          <EnlaceBoton href={`${RUTAS.solicitud}?programa=${curso.codigo}`} icono="flecha" iconoAlFinal>
            Solicitar inscripción
          </EnlaceBoton>
          {sedes[0] ? (
            <EnlaceBoton href={enlaceDeWhatsApp(sedes[0].telefono, consulta)} externo variante="claro" icono="whatsapp">
              Consultar fechas
            </EnlaceBoton>
          ) : null}
        </div>
      </EncabezadoDePagina>

      <section aria-labelledby="ficha-curso" className="section bg-superficie">
        <div className="shell">
          <TituloDeSeccion id="ficha-curso" etiqueta="Ficha del curso" display="Horarios y" resaltado="costos" />
          <div className="mt-10">
            <Ficha datos={datos} tono="cursos" />
          </div>
          <p className="mt-6 flex items-start gap-3 rounded-[var(--t-radio-md)] bg-suave p-4 text-tinta">
            <Icono nombre="info" className="mt-0.5 flex-none text-cursos" />
            La fecha de inicio, el costo y el uniforme se definen en cada apertura. Escríbenos y te damos los de la próxima.
          </p>
          {curso.notas.map((nota) => (
            <p key={nota} className="mt-3 text-tinta-suave">
              {nota}
            </p>
          ))}
        </div>
      </section>

      {curso.contenido && curso.contenido.length > 0 ? (
        <section aria-labelledby="contenido-curso" className="section bg-superficie-alterna">
          <div className="shell">
            <TituloDeSeccion id="contenido-curso" etiqueta="Lo que aprenderás" display="Contenido" alineacion="centro" />
            <div className="mt-12">
              <ContenidoPorBloques programa={curso} />
            </div>
          </div>
        </section>
      ) : null}

      {curso.requisitos.length > 0 ? (
        <section aria-labelledby="requisitos-curso" className="section bg-superficie">
          <div className="shell">
            <TituloDeSeccion id="requisitos-curso" etiqueta="Requisitos" display="Para inscribirte" />
            <ListaConCheck variante="cursos" className="mt-8 text-lg" elementos={curso.requisitos.map((r) => r.descripcion)} />
          </div>
        </section>
      ) : null}
    </>
  );
}
