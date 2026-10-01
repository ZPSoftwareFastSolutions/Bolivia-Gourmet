/**
 * CAPA: Presentation / Sections
 *
 * Galería «Cocina con pasión» (polaroids del folleto), la banda «¿Sueñas
 * emprender?» (rojo vino, folleto B) y la llamada final a inscribirse con el
 * inicio de clases y los requisitos. La skill ui-ux-pro-max pide repetir la
 * acción principal después de las pruebas y al final de la página.
 */

import type { Programa } from '@core/domain/academico/programa';
import { esPendiente } from '@core/domain/shared/tipos-base';
import { enlaceDeWhatsApp, type Sede } from '@core/domain/shared/sede';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { INSTITUTO } from '@contenido/instituto';
import type { NombreDeImagen } from '@contenido/imagenes.generadas';
import { Icono } from '../icons/Icono';
import { EnlaceBoton } from '../ui/Boton';
import { Foto } from '../ui/Foto';
import { ListaConCheck, SeparadorOndulado, TituloDeSeccion } from '../ui/Marca';

const GALERIA: readonly { foto: NombreDeImagen; giro: string; pie: string }[] = [
  { foto: 'emplatado-con-pinzas', giro: '-rotate-2', pie: 'Emplatado' },
  { foto: 'cocteleria-degustacion', giro: 'rotate-2 sm:mt-10', pie: 'Coctelería' },
  { foto: 'reposteria-batidora', giro: '-rotate-1', pie: 'Repostería' },
  { foto: 'kit-de-cuchillos', giro: 'rotate-3 sm:mt-10', pie: 'Tu kit de chef' },
];

export function GaleriaCocinaConPasion() {
  return (
    <section aria-labelledby="galeria" className="section overflow-hidden bg-superficie">
      <div className="shell grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <TituloDeSeccion
            id="galeria"
            etiqueta="Clases 80 % prácticas"
            script="Cocina con"
            display="pasión"
            descripcion={
              <p>
                Aprendes cocinando desde el primer día, en cocinas equipadas y con docentes especializados. {INSTITUTO.lemasSecundarios.formacion}.
              </p>
            }
          />
          <ListaConCheck
            className="mt-8 text-tinta"
            elementos={['Cocinas profesionales con equipos industriales', 'Uniforme y kit completos', 'Prácticas laborales en hoteles y restaurantes', 'Convalidación a licenciatura']}
          />
        </div>
        <ul className="mx-auto grid w-full max-w-xl grid-cols-2 gap-5 sm:gap-7">
          {GALERIA.map((g) => (
            <li key={g.foto} className={`polaroid ${g.giro}`}>
              <Foto nombre={g.foto} sizes="(min-width: 1024px) 300px, 45vw" className="aspect-[3/4]" />
              <p className="t-script mt-2 text-center text-xl text-estructural">{g.pie}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * `conEnlace`: el botón a los cursos (no en la propia página de cursos).
 * `final`: es la última sección de la página; no dibuja la onda de cierre y
 * deja que la onda del pie se apoye en el rojo vino (`.fin-cursos`, globals.css)
 * en lugar de dejar una franja blanca entre las dos ondas.
 */
export function BandaEmprende({ conEnlace = true, final = false }: { readonly conEnlace?: boolean; readonly final?: boolean }) {
  return (
    <section aria-labelledby="emprende" className={cn('relative', final && 'fin-cursos')}>
      <SeparadorOndulado className="text-cursos" />
      <div className="bg-cursos text-sobre-cursos">
        <div className="shell grid gap-12 pt-6 pb-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 id="emprende" className="t-display t-h1">
              {INSTITUTO.emprende.titulo}
            </h2>
            <p className="t-lead mt-5 text-sobre-cursos/90">{INSTITUTO.emprende.texto}</p>
            {conEnlace ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <EnlaceBoton href={RUTAS.cursos} variante="primario" icono="flecha" iconoAlFinal>
                  Quiero emprender
                </EnlaceBoton>
              </div>
            ) : null}
          </div>
          <ul className="grid grid-cols-2 gap-4">
            {INSTITUTO.emprende.beneficios.map((b) => (
              <li key={b.texto} className="rounded-[var(--t-radio-lg)] bg-tarjeta p-5 text-tinta">
                <span className="t-display block text-4xl leading-none text-cursos">{b.cifra}</span>
                <span className="mt-2 block font-semibold">{b.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {final ? null : <SeparadorOndulado className="text-cursos" invertido />}
    </section>
  );
}

export function LlamadaInscripcion({ carrera, sedes }: { readonly carrera: Programa | null; readonly sedes: readonly Sede[] }) {
  const inicio = carrera && !esPendiente(carrera.inicioPublicado) ? carrera.inicioPublicado : null;
  return (
    <section aria-labelledby="inscripciones" className="section bg-superficie pb-10 sm:pb-14">
      <div className="shell">
        <div className="relative overflow-hidden rounded-[var(--t-radio-xl)] bg-accion text-sobre-accion">
          <span className="marca-rayas absolute top-6 right-6 size-16 bg-estructural" aria-hidden="true" />
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="t-etiqueta text-sobre-accion">Inscripciones abiertas</p>
              <h2 id="inscripciones" className="t-h1 mt-3">
                <span className="t-script block text-[0.8em]">Inicio de clases</span>
                <span className="t-display block">{inicio ?? 'Consulta la próxima fecha'}</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg">
                Crea tu cuenta en el portal de estudiantes, envía tu solicitud y te contactamos para completar la inscripción en tu sede.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <EnlaceBoton href={RUTAS.registro} variante="secundario" tamano="lg" icono="flecha" iconoAlFinal>
                  Crear mi cuenta
                </EnlaceBoton>
                {sedes[0] ? (
                  <EnlaceBoton href={enlaceDeWhatsApp(sedes[0].telefono, `Hola, quiero inscribirme en ${INSTITUTO.nombreCorto}.`)} externo variante="claro" tamano="lg" icono="whatsapp">
                    Escríbenos
                  </EnlaceBoton>
                ) : null}
              </div>
            </div>
            {carrera ? (
              <div className="rounded-[var(--t-radio-lg)] bg-tarjeta p-6 text-tinta">
                <h3 className="flex items-center gap-2 font-bold text-estructural">
                  <Icono nombre="documento" />
                  Requisitos de inscripción a la carrera
                </h3>
                <ListaConCheck
                  className="mt-4 text-sm"
                  elementos={carrera.requisitos.map((r) => (
                    <>
                      <strong>{r.descripcion}</strong>
                      {r.detalle ? <span className="text-tinta-suave"> ({r.detalle})</span> : null}
                    </>
                  ))}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
