/**
 * CONVENIOS Y ALIANZAS.
 *
 * Nombres completos tal como los detalló el usuario el 2026-10-01
 * (`docs/analisis/aclaraciones-2026-10-01.md` §6), que corrigen las erratas
 * del documento original («Alt Paocha», «La Carindera», «Auroras», «UNIGEN»).
 *
 * Los logotipos de terceros NO se publican: son marcas ajenas y falta su
 * archivo y autorización. Se muestran como texto.
 */

export type RubroDeAliado = 'restaurante' | 'hotel' | 'pasteleria' | 'escuela' | 'panaderia' | 'industria';

export interface Aliado {
  readonly nombre: string;
  readonly descripcion: string;
  readonly rubro: RubroDeAliado;
}

export interface Universidad {
  readonly sigla: string;
  readonly nombre: string;
  /** Algo que confirmar antes de darlo por definitivo. */
  readonly nota?: string;
}

export const ALIADOS: readonly Aliado[] = [
  { nombre: 'Michelline', descripcion: 'Pastelería', rubro: 'pasteleria' },
  { nombre: 'Alí Pacha', descripcion: 'Restaurante', rubro: 'restaurante' },
  { nombre: 'Mamita Masita', descripcion: 'Panes artesanales', rubro: 'panaderia' },
  { nombre: 'Oberland', descripcion: 'Hotel restaurante', rubro: 'hotel' },
  { nombre: "Manq'a", descripcion: 'Restaurantes y escuelas de cocina', rubro: 'escuela' },
  { nombre: 'Hard Rock Cafe', descripcion: 'Restaurante', rubro: 'restaurante' },
  { nombre: 'Gustu', descripcion: 'Restaurante', rubro: 'restaurante' },
  { nombre: 'Fusión Gourmet', descripcion: 'Escuela de pastelería y cocina', rubro: 'escuela' },
  { nombre: 'Mugaritz', descripcion: 'Restaurante', rubro: 'restaurante' },
  { nombre: 'Selina', descripcion: 'Hotels', rubro: 'hotel' },
  { nombre: 'Propiedad Pública', descripcion: 'Restaurante de carnes y pastas', rubro: 'restaurante' },
  { nombre: 'Cuissine', descripcion: 'Instituto de Chefs', rubro: 'escuela' },
  { nombre: 'La Boliviana', descripcion: 'Restaurante', rubro: 'restaurante' },
  { nombre: 'La Cordobesa', descripcion: 'Pastelería', rubro: 'pasteleria' },
  { nombre: 'Boragó', descripcion: 'Restaurante', rubro: 'restaurante' },
  { nombre: 'Le Gourmet', descripcion: 'Centro de Formación Gastronómica', rubro: 'escuela' },
  { nombre: 'Aurora', descripcion: 'Fábrica de harinas y fideos', rubro: 'industria' },
];

export const UNIVERSIDADES: readonly Universidad[] = [
  { sigla: 'UNANDES', nombre: 'Universidad de los Andes' },
  { sigla: 'UNICEN', nombre: 'UNICEN' },
  {
    sigla: 'UB',
    nombre: 'Universidad Unión Bolivariana',
    nota: 'El usuario escribió «Unión Boliviana»; el logotipo y el documento dicen «Unión Bolivariana».',
  },
  { sigla: 'UDI', nombre: 'Universidad para el Desarrollo y la Innovación' },
];
