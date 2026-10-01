/**
 * CAPA: Presentation
 *
 * Cómo se VE cada programa: icono y fotografía. No es dominio (al dominio no
 * le importa qué foto ilustra la coctelería) ni contenido institucional: es
 * una decisión de diseño, y vive junto a la presentación.
 *
 * Las fotos son las nueve oficiales del cliente. Los cursos cortos no tienen
 * fotos propias todavía (pedidas: aclaraciones §8); se usa la más cercana.
 */

import type { NombreDeImagen } from '@contenido/imagenes.generadas';
import type { NombreDeIcono } from './icons/Icono';

export interface AspectoDePrograma {
  readonly icono: NombreDeIcono;
  readonly foto: NombreDeImagen;
}

const POR_CODIGO: Record<string, AspectoDePrograma> = {
  gastronomia: { icono: 'gorro', foto: 'estudiantes-con-platos' },
  cocina: { icono: 'cubiertos', foto: 'cocina-en-equipo' },
  cocteleria: { icono: 'copa', foto: 'cocteleria-preparacion' },
  'reposteria-y-panaderia': { icono: 'trigo', foto: 'reposteria-batidora' },
  tortas: { icono: 'torta', foto: 'emplatado-con-pinzas' },
  'cursos-de-temporada': { icono: 'chispas', foto: 'kit-de-cuchillos' },
};

const POR_DEFECTO: AspectoDePrograma = { icono: 'gorro', foto: 'estudiantes-brazos-cruzados' };

export function aspectoDePrograma(codigo: string): AspectoDePrograma {
  return POR_CODIGO[codigo] ?? POR_DEFECTO;
}
