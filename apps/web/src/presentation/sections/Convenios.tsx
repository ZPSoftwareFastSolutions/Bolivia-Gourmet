/**
 * CAPA: Presentation / Sections
 *
 * Convenios y alianzas con los logotipos oficiales que envió el cliente
 * (FOTOS-WEB/LOGOS-SOCIOS), horneados como hexágonos de panal:
 *   - CarruselDeAliados: la portada. Cinta de panal que se desplaza sola, sin
 *     flechas (pedido del usuario), con «Pausar» y quieta con movimiento
 *     reducido (WCAG 2.2.2; skill ui-ux-pro-max: el carrusel de logotipos se
 *     detiene al pasar el puntero, al enfocar y con movimiento reducido).
 *   - PanalDeAliados: la página de convenios, con las filas del folleto.
 *   - Universidades: convenios a nivel licenciatura, logotipo y nombre.
 * Sin JavaScript: la pausa es una casilla y el CSS (`:has`) hace el resto.
 */

import { ALIADOS, UNIVERSIDADES } from '@contenido/convenios';
import { INSTITUTO } from '@contenido/instituto';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/cn';
import { Icono } from '../icons/Icono';
import { EnlaceBoton } from '../ui/Boton';
import { LogoHexagonal } from '../ui/LogoHexagonal';
import { TituloDeSeccion } from '../ui/Marca';
import { celdasDelCarrusel, FILAS_DEL_FOLLETO, FILAS_MOVILES, repartirEnFilas } from './panal';

const textoAlternativo = (aliado: (typeof ALIADOS)[number]) => `${aliado.nombre} (${aliado.descripcion.toLowerCase()})`;

// ---------------------------------------------------------------- Carrusel (portada)

export function CarruselDeAliados() {
  const celdas = celdasDelCarrusel(ALIADOS);
  return (
    <div className="carrusel-panal">
      <div className="carrusel-panal__ventana">
        <ul className="carrusel-panal__pista" aria-label={`${ALIADOS.length} empresas con convenio`}>
          {celdas.map(({ elemento: aliado, copia }) => (
            // Las copias solo sirven para que la cinta no tenga fin: fuera del árbol de accesibilidad.
            <li key={`${copia}-${aliado.logo}`} className="carrusel-panal__celda" aria-hidden={copia > 0 ? true : undefined}>
              <div className="carrusel-panal__logo">
                <LogoHexagonal
                  logo={aliado.logo}
                  alt={copia > 0 ? '' : textoAlternativo(aliado)}
                  sizes="(min-width: 1024px) 160px, (min-width: 640px) 136px, 112px"
                  diferida={false}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      {/* El control se alinea con el contenido de la página, no con el borde de la ventana. */}
      {/* Con movimiento reducido la cinta no se mueve: el control sobra (utilidad, para ganar a su inline-flex). */}
      <div className="shell mt-2 flex justify-end motion-reduce:hidden">
        {/* Interruptor: el texto no cambia (WCAG 2.5.3) y el estado activado se ve relleno en azul. */}
        <label className="carrusel-panal__control inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-linea bg-tarjeta px-4 text-sm font-semibold text-estructural transition-colors hover:border-estructural has-checked:border-estructural has-checked:bg-estructural has-checked:text-sobre-estructural">
          <input type="checkbox" className="carrusel-panal__pausa sr-only" />
          <Icono nombre="pausa" tamano={16} />
          Pausar movimiento
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Panal (página de convenios)

function FilasDePanal({ filas, className }: { readonly filas: readonly { readonly celdas: typeof ALIADOS; readonly desplazada?: boolean; readonly centrada?: boolean }[]; readonly className?: string }) {
  return (
    <div role="list" aria-label={`${ALIADOS.length} empresas con convenio`} className={cn('panal', className)}>
      {filas.map((fila, i) => (
        <div key={i} role="none" className={cn('panal__fila', fila.desplazada && 'panal__fila--desplazada', fila.centrada && 'panal__fila--centrada')}>
          {fila.celdas.map((aliado) => (
            <div key={aliado.logo} role="listitem" className="panal__celda">
              <LogoHexagonal
                logo={aliado.logo}
                alt={textoAlternativo(aliado)}
                sizes="(min-width: 1280px) 168px, (min-width: 1024px) 152px, (min-width: 768px) 128px, 106px"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PanalDeAliados() {
  const movil = repartirEnFilas(ALIADOS, FILAS_MOVILES).map((celdas) => ({ celdas, centrada: true }));
  const folleto = repartirEnFilas(
    ALIADOS,
    FILAS_DEL_FOLLETO.map((f) => f.celdas),
  ).map((celdas, i) => ({ celdas, desplazada: FILAS_DEL_FOLLETO[i]?.desplazada ?? false }));
  return (
    <>
      {/* Dos maquetas del mismo panal: la oculta no se lee ni descarga sus imágenes (display: none + lazy). */}
      <FilasDePanal filas={movil} className="md:hidden" />
      <FilasDePanal filas={folleto} className="hidden md:block" />
    </>
  );
}

// ---------------------------------------------------------------- Universidades

export function Universidades({ columnas = 4 }: { readonly columnas?: 2 | 4 }) {
  return (
    <ul className={cn('grid grid-cols-2 gap-x-6 gap-y-10', columnas === 4 && 'lg:grid-cols-4')}>
      {UNIVERSIDADES.map((u) => (
        <li key={u.sigla} className="flex flex-col items-center text-center">
          <div className="w-28 sm:w-32">
            {/* El nombre va escrito debajo: el logotipo no lo repite al lector de pantalla. */}
            <LogoHexagonal logo={u.logo} alt="" sizes="(min-width: 640px) 128px, 112px" />
          </div>
          <span className="t-display mt-4 text-3xl leading-none text-estructural">{u.sigla}</span>
          {u.nombre !== u.sigla ? <span className="mt-1 max-w-56 text-sm font-semibold text-tinta-suave">{u.nombre}</span> : null}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Resumen (portada)

export function ConveniosResumen() {
  return (
    <section aria-labelledby="convenios" className="section bg-superficie-alterna">
      <div className="shell">
        <TituloDeSeccion
          id="convenios"
          etiqueta={`Durante ${INSTITUTO.aniosDeExperiencia} años trabajando con`}
          script="Convenios"
          display="nacionales e internacionales"
          alineacion="centro"
          descripcion={<p>Realiza tus prácticas en hoteles, restaurantes y escuelas de primer nivel, y continúa a la licenciatura.</p>}
        />
      </div>
      {/* La cinta ocupa todo el ancho de la ventana: entra y sale por los bordes. */}
      <div className="mt-10">
        <CarruselDeAliados />
      </div>
      <div className="shell">
        <div className="mt-12 grid gap-10 rounded-[var(--t-radio-xl)] border border-linea bg-tarjeta p-8 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="t-etiqueta flex items-center gap-2">
              <Icono nombre="graduacion" tamano={18} />
              Convalidación
            </p>
            <h3 className="t-h2 mt-3 text-estructural">
              <span className="mb-1 block">
                <span className="t-script marca-subrayado text-[0.9em] normal-case">Convenios a nivel</span>
              </span>
              <span className="t-display block">licenciatura</span>
            </h3>
            <p className="t-lead mt-5">
              Al concluir la carrera de {INSTITUTO.tituloOtorgado.toLowerCase()} convalidas materias y sacas tu licenciatura en Gastronomía en
              universidades con convenio.
            </p>
          </div>
          <Universidades columnas={2} />
        </div>
        <div className="mt-10 text-center">
          <EnlaceBoton href={RUTAS.convenios} variante="contorno" icono="flecha" iconoAlFinal>
            Ver todos los convenios
          </EnlaceBoton>
        </div>
      </div>
    </section>
  );
}
