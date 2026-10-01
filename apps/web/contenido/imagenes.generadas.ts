/**
 * GENERADO por scripts/optimizar-imagenes.mjs — no editar a mano.
 * Dimensiones reales de cada recurso publicado en public/img/.
 */

export const DIMENSIONES = {
  "estudiantes-brazos-cruzados": {
    "ancho": 1536,
    "alto": 1024,
    "anchos": [
      480,
      960,
      1536
    ]
  },
  "estudiantes-con-platos": {
    "ancho": 2560,
    "alto": 1702,
    "anchos": [
      480,
      960,
      1600
    ]
  },
  "cocina-en-equipo": {
    "ancho": 2560,
    "alto": 1708,
    "anchos": [
      480,
      960,
      1600
    ]
  },
  "emplatado-con-pinzas": {
    "ancho": 1056,
    "alto": 1586,
    "anchos": [
      480,
      960,
      1056
    ]
  },
  "reposteria-batidora": {
    "ancho": 854,
    "alto": 1280,
    "anchos": [
      480,
      854
    ]
  },
  "cocteleria-preparacion": {
    "ancho": 1384,
    "alto": 2072,
    "anchos": [
      480,
      960,
      1384
    ]
  },
  "cocteleria-degustacion": {
    "ancho": 854,
    "alto": 1280,
    "anchos": [
      480,
      854
    ]
  },
  "kit-de-cuchillos": {
    "ancho": 854,
    "alto": 1280,
    "anchos": [
      480,
      854
    ]
  },
  "logo-bolivia-gastronomica": {
    "ancho": 1035,
    "alto": 423,
    "anchos": [
      320,
      640
    ]
  },
  "logo-bolivia-gourmet": {
    "ancho": 2755,
    "alto": 953,
    "anchos": [
      320,
      640
    ]
  }
} as const;

export type NombreDeImagen = keyof typeof DIMENSIONES;
