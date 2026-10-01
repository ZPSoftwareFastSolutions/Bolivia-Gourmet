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

/** Logotipos de socios y universidades, horneados como hexágonos (`socio-<logo>-<ancho>.webp`). */
export const LOGOS_DE_SOCIOS = {
  "michelline": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "ali-pacha": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "mamita-masita": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "oberland": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "manqa": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "hard-rock-cafe": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "gustu": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "fusion-gourmet": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "mugaritz": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "propiedad-publica": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "selina": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "la-boliviana": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "la-cordobesa": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "aurora": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "le-gourmet": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "cuissine": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "borago": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "unandes": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "udi": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": false
  },
  "ub": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  },
  "unicen": {
    "ancho": 400,
    "alto": 462,
    "anchos": [
      200,
      400
    ],
    "claro": true
  }
} as const;

export type NombreDeLogo = keyof typeof LOGOS_DE_SOCIOS;
