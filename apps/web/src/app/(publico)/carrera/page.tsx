/**
 * CAPA: Presentation / App — Carrera técnica en Gastronomía.
 *
 * Reproduce las dos páginas del folleto A: el plan de estudios por año (con
 * checks amarillos) y la ficha de inscripción (duración, horarios, costo,
 * uniforme, inicio, requisitos). Todo sale del catálogo validado.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { describirDuracion, formatearMonto } from '@core/domain/academico/programa';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { catalogoAcademico } from '@infra/config/composition-root';
import { RUTAS } from '@/lib/rutas';
import { INSTITUTO } from '@contenido/instituto';
import { Icono } from '@/presentation/icons/Icono';
import { EnlaceBoton } from '@ui/Boton';
import { Foto } from '@ui/Foto';
import { ListaConCheck, TituloDeSeccion } from '@ui/Marca';
import { Universidades } from '@sections/Convenios';
import { EncabezadoDePagina } from '@sections/Hero';
import { Ficha, textoDeDias, textoDeTurnos } from '@sections/Oferta';

export const metadata: Metadata = {
  title: 'Carrera de Gastronomía',
  description: `Carrera técnica de 3 años: ${INSTITUTO.tituloOtorgado}, con título en Provisión Nacional, prácticas y convalidación a licenciatura.`,
};

const ORDINAL = ['1.er', '2.º', '3.er', '4.º', '5.º'];

export default async function Carrera() {
  const carrera = await catalogoAcademico().programaPorCodigo('gastronomia');
  if (!carrera || !carrera.activo) notFound();

  const precios = esPendiente(carrera.costo) ? [] : carrera.costo;
  const horaEspecial = carrera.horaPorTurno?.especial;

  return (
    <>
      <EncabezadoDePagina
        migas={[{ etiqueta: 'Inicio', href: RUTAS.inicio }, { etiqueta: 'Carrera' }]}
        etiqueta="Carrera técnica"
        script="Tu futuro en la gastronomía"
        display={carrera.nombre}
        resaltado={describirDuracion(carrera.duracion)}
        foto="estudiantes-con-platos"
        descripcion={
          <p>
            Obtén tu título en Provisión Nacional de <strong>{carrera.tituloOtorgado}</strong> y convalida después a la licenciatura.
          </p>
        }
      >
        <div className="flex flex-wrap gap-3">
          <EnlaceBoton href={`${RUTAS.solicitud}?programa=${carrera.codigo}`} icono="flecha" iconoAlFinal>
            Solicitar inscripción
          </EnlaceBoton>
          <EnlaceBoton href="#plan-de-estudios" variante="claro">
            Ver plan de estudios
          </EnlaceBoton>
        </div>
      </EncabezadoDePagina>

      <section aria-labelledby="ficha" className="section bg-superficie">
        <div className="shell">
          <TituloDeSeccion id="ficha" etiqueta="Ficha de inscripción" script="Cocina con" display="pasión" />
          <div className="mt-10">
            <Ficha
              datos={[
                { icono: 'calendario', titulo: 'Duración', valor: `${describirDuracion(carrera.duracion)} · ${textoDeDias(carrera)}` },
                {
                  icono: 'reloj',
                  titulo: 'Horarios',
                  valor: (
                    <>
                      {textoDeTurnos(carrera)}
                      {horaEspecial ? <span className="block text-sm font-normal text-tinta-suave">Horario especial: {horaEspecial.toLowerCase()}</span> : null}
                    </>
                  ),
                },
                { icono: 'calendario', titulo: 'Inicio de clases', valor: esPendiente(carrera.inicioPublicado) ? 'Consultar' : carrera.inicioPublicado },
                ...precios.map((p) => ({ icono: 'monedas' as const, titulo: p.etiqueta, valor: formatearMonto(p.monto) })),
                { icono: 'chaqueta', titulo: 'Uniforme', valor: esPendiente(carrera.uniforme) ? 'Consultar' : formatearMonto(carrera.uniforme.monto) },
              ]}
            />
          </div>
          {carrera.notas.map((nota) => (
            <p key={nota} className="mt-6 flex items-start gap-3 rounded-[var(--t-radio-md)] bg-superficie-alterna p-4 text-tinta-suave">
              <Icono nombre="info" className="mt-0.5 flex-none text-estructural" />
              {nota}
            </p>
          ))}
          <p className="mt-3 text-sm text-tinta-suave">
            Consulta la modalidad de pago de los paquetes en tu sede. El pago se realiza por QR.
          </p>
        </div>
      </section>

      <section id="plan-de-estudios" aria-labelledby="titulo-plan" className="section bg-superficie-alterna">
        <div className="shell">
          <TituloDeSeccion id="titulo-plan" etiqueta="Plan de estudios" display="Gastronomía" resaltado="3 años" alineacion="centro" />
          <ol className="mt-12 grid gap-6 lg:grid-cols-3">
            {(carrera.planDeEstudios ?? []).map((anio) => (
              <li key={anio.anio} className="rounded-[var(--t-radio-lg)] bg-tarjeta p-7 shadow-[0_18px_40px_-30px_var(--t-estructural)]">
                <h3 className="flex items-baseline gap-2 text-estructural">
                  <span className="t-display text-6xl leading-none">{anio.anio}</span>
                  <span className="t-display text-2xl">{ORDINAL[anio.anio - 1]?.replace(/^\d+\./, '')} año</span>
                </h3>
                <ListaConCheck className="mt-5 text-tinta" elementos={anio.materias} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="titulacion" className="section bg-superficie">
        <div className="shell grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <TituloDeSeccion
              id="titulacion"
              etiqueta="Titúlate y convalida"
              script="Licenciatura"
              display="en gastronomía"
              descripcion={<p>Al concluir la carrera puedes convalidar materias y continuar a nivel licenciatura con nuestras universidades en convenio.</p>}
            />
            <div className="mt-8">
              <Universidades />
            </div>
          </div>
          <div className="bloque-desplazado bloque-desplazado--azul">
            <Foto nombre="emplatado-con-pinzas" sizes="(min-width: 1024px) 420px, 92vw" className="aspect-[4/5] rounded-[var(--t-radio-xl)]" />
          </div>
        </div>
      </section>

      <section aria-labelledby="requisitos" className="section bg-estructural text-sobre-estructural">
        <div className="shell grid gap-12 lg:grid-cols-2">
          <TituloDeSeccion
            id="requisitos"
            tono="oscuro"
            etiqueta="Requisitos"
            display="para tu"
            resaltado="inscripción"
            descripcion={<p>Preséntalos en tu sede al completar la inscripción. Puedes enviar tu solicitud antes desde el portal.</p>}
          />
          <div>
            <ListaConCheck
              variante="marca"
              elementos={carrera.requisitos.map((r) => (
                <>
                  <strong>{r.descripcion}</strong>
                  {r.detalle ? <span className="opacity-80"> ({r.detalle})</span> : null}
                </>
              ))}
            />
            <div className="mt-9 flex flex-wrap gap-3">
              <EnlaceBoton href={`${RUTAS.solicitud}?programa=${carrera.codigo}`} icono="flecha" iconoAlFinal>
                Solicitar inscripción
              </EnlaceBoton>
              <EnlaceBoton href={RUTAS.contacto} variante="claro">
                Visítanos
              </EnlaceBoton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
