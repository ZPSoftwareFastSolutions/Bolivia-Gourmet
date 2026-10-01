/**
 * TEXTO ALTERNATIVO de las fotografías oficiales (`FOTOS-WEB/`, enviadas por
 * el cliente el 2026-10-01). Las dimensiones salen del archivo generado; el
 * texto alternativo se escribe a mano porque describe lo que importa de cada
 * foto para quien no la ve.
 */

import type { NombreDeImagen } from './imagenes.generadas';

export const TEXTO_ALTERNATIVO: Record<NombreDeImagen, string> = {
  'estudiantes-brazos-cruzados':
    'Tres estudiantes de Bolivia Gastronómica con chaqueta blanca de chef y gorro, de brazos cruzados en la cocina del instituto.',
  'estudiantes-con-platos': 'Cuatro estudiantes uniformados muestran los platos que acaban de emplatar en la cocina del instituto.',
  'cocina-en-equipo': 'Tres estudiantes preparan una receta en equipo sobre un mesón de acero, con panes y huevos.',
  'emplatado-con-pinzas': 'Una estudiante termina de emplatar un postre con pinzas, con precisión de chef.',
  'reposteria-batidora': 'Una estudiante incorpora ingredientes en una batidora planetaria durante una clase de repostería.',
  'cocteleria-preparacion': 'Un estudiante sirve un destilado en la coctelera junto a copas de cócteles terminados.',
  'cocteleria-degustacion': 'Un estudiante explica una degustación de cócteles de colores servidos en copas.',
  'kit-de-cuchillos': 'Dos estudiantes con uniforme completo y su estuche de cuchillos con los logotipos del instituto.',
  'logo-bolivia-gastronomica': 'Bolivia Gastronómica, Instituto Técnico Bolivia Gastronómica',
  'logo-bolivia-gourmet': 'Corporación Bolivia Gourmet',
};
