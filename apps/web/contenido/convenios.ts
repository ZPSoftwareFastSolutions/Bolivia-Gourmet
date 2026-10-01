/**
 * CONVENIOS Y ALIANZAS.
 *
 * Nombres completos tal como los detalló el usuario el 2026-10-01
 * (`docs/analisis/aclaraciones-2026-10-01.md` §6), que corrigen las erratas
 * del documento original («Alt Paocha», «La Carindera», «Auroras», «UNIGEN»).
 *
 * Logotipos: los envió el cliente para la web (`FOTOS-WEB/LOGOS-SOCIOS`);
 * `npm run imagenes` los hornea como hexágonos de panal. El orden es el de la
 * retícula del folleto (`FOTOS-GASTRO/Portada1 (5).jpg`).
 */

import type { NombreDeLogo } from './imagenes.generadas';

export type RubroDeAliado = 'restaurante' | 'hotel' | 'pasteleria' | 'escuela' | 'panaderia' | 'industria';

export interface Aliado {
  readonly nombre: string;
  readonly descripcion: string;
  readonly rubro: RubroDeAliado;
  readonly logo: NombreDeLogo;
}

export interface Universidad {
  readonly sigla: string;
  readonly nombre: string;
  readonly logo: NombreDeLogo;
  /** Algo que confirmar antes de darlo por definitivo. */
  readonly nota?: string;
}

export const ALIADOS: readonly Aliado[] = [
  { nombre: 'Michelline', descripcion: 'Pastelería', rubro: 'pasteleria', logo: 'michelline' },
  { nombre: 'Alí Pacha', descripcion: 'Restaurante', rubro: 'restaurante', logo: 'ali-pacha' },
  { nombre: 'Mamita Masita', descripcion: 'Panes artesanales', rubro: 'panaderia', logo: 'mamita-masita' },
  { nombre: 'Oberland', descripcion: 'Hotel restaurante', rubro: 'hotel', logo: 'oberland' },
  { nombre: "Manq'a", descripcion: 'Restaurantes y escuelas de cocina', rubro: 'escuela', logo: 'manqa' },
  { nombre: 'Hard Rock Cafe', descripcion: 'Restaurante', rubro: 'restaurante', logo: 'hard-rock-cafe' },
  { nombre: 'Gustu', descripcion: 'Restaurante', rubro: 'restaurante', logo: 'gustu' },
  { nombre: 'Fusión Gourmet', descripcion: 'Escuela de pastelería y cocina', rubro: 'escuela', logo: 'fusion-gourmet' },
  { nombre: 'Mugaritz', descripcion: 'Restaurante', rubro: 'restaurante', logo: 'mugaritz' },
  { nombre: 'Propiedad Pública', descripcion: 'Restaurante de carnes y pastas', rubro: 'restaurante', logo: 'propiedad-publica' },
  { nombre: 'Selina', descripcion: 'Hotels', rubro: 'hotel', logo: 'selina' },
  { nombre: 'La Boliviana', descripcion: 'Restaurante', rubro: 'restaurante', logo: 'la-boliviana' },
  { nombre: 'La Cordobesa', descripcion: 'Pastelería', rubro: 'pasteleria', logo: 'la-cordobesa' },
  { nombre: 'Aurora', descripcion: 'Fábrica de harinas y fideos', rubro: 'industria', logo: 'aurora' },
  { nombre: 'Le Gourmet', descripcion: 'Centro de Formación Gastronómica', rubro: 'escuela', logo: 'le-gourmet' },
  { nombre: 'Cuissine', descripcion: 'Instituto de Chefs', rubro: 'escuela', logo: 'cuissine' },
  { nombre: 'Boragó', descripcion: 'Restaurante', rubro: 'restaurante', logo: 'borago' },
];

export const UNIVERSIDADES: readonly Universidad[] = [
  { sigla: 'UNANDES', nombre: 'Universidad de los Andes', logo: 'unandes' },
  { sigla: 'UDI', nombre: 'Universidad para el Desarrollo y la Innovación', logo: 'udi' },
  {
    sigla: 'UB',
    nombre: 'Universidad Unión Bolivariana',
    logo: 'ub',
    nota: 'El usuario escribió «Unión Boliviana»; el logotipo y el documento dicen «Unión Bolivariana».',
  },
  { sigla: 'UNICEN', nombre: 'UNICEN', logo: 'unicen' },
];
