/**
 * Optimiza los recursos oficiales de `FOTOS-WEB/` para la web.
 *
 * POR QUÉ EXISTE. El cliente envió PNG y JPG pensados para imprenta: el logo de
 * Bolivia Gastronómica pesa 11,6 MB y las fotos llegan a 2 560 px. Servirlos
 * tal cual destrozaría el LCP en el móvil de gama media que usa la mayoría.
 * Tampoco se usa `next/image`: añade un atributo `style` que la CSP estricta
 * bloquea (ADR 0006). Se generan una vez, se versionan, y los componentes los
 * sirven con `<img srcset>` y dimensiones reservadas.
 *
 * Qué hace:
 *   - Logotipos: recorta SOLO el margen transparente (el dibujo no se toca:
 *     docs/brand §14) y exporta WebP con transparencia a dos anchos.
 *   - Favicon: el isotipo de los tres pétalos, que el folleto ya usa solo.
 *   - Fotos: WebP a 480, 960 y 1600 px de ancho, sin metadatos (la ubicación
 *     GPS o el modelo de cámara no tienen por qué publicarse).
 *   - Logotipos de socios y universidades (LOGOS-SOCIOS): hexágonos de panal
 *     con el fondo de cada logotipo, WebP con transparencia a 200 y 400 px.
 *   - Imagen para redes (Open Graph) 1200×630.
 *   - Escribe `contenido/imagenes.generadas.ts` con las dimensiones reales.
 *
 * Uso:  npm run imagenes   (desde apps/web)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const ORIGEN = new URL('../../../FOTOS-WEB/', import.meta.url);
const DESTINO = new URL('../public/img/', import.meta.url);
const APP = new URL('../src/app/', import.meta.url);
const GENERADO = new URL('../contenido/imagenes.generadas.ts', import.meta.url);

const ruta = (url) => decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const FOTOS = {
  'estudiantes-brazos-cruzados': '2.png',
  'estudiantes-con-platos': '6.jpg',
  'cocina-en-equipo': '3.jpg',
  'emplatado-con-pinzas': '8.jpg',
  'reposteria-batidora': '9.jpg',
  'cocteleria-preparacion': '10.jpg',
  'cocteleria-degustacion': '12.jpg',
  'kit-de-cuchillos': '11.jpg',
};

const ANCHOS = [480, 960, 1600];

const LOGOS = {
  'logo-bolivia-gastronomica': 'BOLIVIA GASTRONOMICA.png',
  'logo-bolivia-gourmet': 'BOLIVIA GOURMET.png',
};

/**
 * Logotipos de socios y universidades (FOTOS-WEB/LOGOS-SOCIOS, enviados por
 * el cliente). Llegan cuadrados, cada uno sobre su propio color de fondo. Se
 * hornean como HEXÁGONOS (la retícula de panal del folleto) con el fondo del
 * propio logotipo, así no hace falta un color por socio en el CSS ni un
 * atributo `style` (CSP). `aclararFondo`: el fondo es un degradado gris; se
 * vuelve blanco antes de recortar para que no se note la costura.
 */
const SOCIOS = {
  michelline: { archivo: 'Michelline.jpg' },
  'ali-pacha': { archivo: 'Ali Pacha.jpg' },
  'mamita-masita': { archivo: 'MamitaMasita.jpg' },
  oberland: { archivo: 'Oberland.jpg' },
  manqa: { archivo: "Manq'a.jpg" },
  'hard-rock-cafe': { archivo: 'Hard Rock.jpg' },
  gustu: { archivo: 'Gustu.jpg' },
  'fusion-gourmet': { archivo: 'Fusion Gourmet.png', aclararFondo: true },
  mugaritz: { archivo: 'Mugaritz.jpg' },
  'propiedad-publica': { archivo: 'PropiedadPublica.jpg' },
  selina: { archivo: 'Selina.jpg' },
  'la-boliviana': { archivo: 'LaBoliviana.jpg' },
  'la-cordobesa': { archivo: 'LaCordobesa.jpg' },
  aurora: { archivo: 'Aurora.jpg' },
  'le-gourmet': { archivo: 'LeGourmet.jpg' },
  // Su anillo toca los cuatro bordes del archivo: sin el corte del 2 %.
  cuissine: { archivo: 'Cuissine.jpg', sinCorte: true },
  borago: { archivo: 'Borago.png' },
  unandes: { archivo: 'Unandes.jpg' },
  udi: { archivo: 'UDI.jpg' },
  ub: { archivo: 'UB.png' },
  unicen: { archivo: 'UNICEN.jpg' },
};

/** Hexágono con vértice arriba (como el folleto): alto = ancho · 2/√3. */
const HEX_ANCHO = 400;
const HEX_ALTO = Math.round((HEX_ANCHO * 2) / Math.sqrt(3));
const HEX_ANCHOS = [200, 400];
/** Contorno de los hexágonos claros: el valor de --t-linea (globals.css). */
const COLOR_DE_LINEA = '#e3e1da';

mkdirSync(ruta(DESTINO), { recursive: true });

const dimensiones = {};

async function exportarFoto(nombre, archivo) {
  const original = sharp(ruta(new URL(archivo, ORIGEN))).rotate();
  const meta = await original.metadata();
  const anchos = ANCHOS.filter((a) => a <= (meta.width ?? 0));
  if (!anchos.includes(meta.width) && (meta.width ?? 0) < ANCHOS[ANCHOS.length - 1]) anchos.push(meta.width);
  for (const ancho of anchos) {
    await sharp(ruta(new URL(archivo, ORIGEN)))
      .rotate()
      .resize({ width: ancho, withoutEnlargement: true })
      .webp({ quality: 74, effort: 6 })
      .toFile(ruta(new URL(`${nombre}-${ancho}.webp`, DESTINO)));
  }
  dimensiones[nombre] = { ancho: meta.width, alto: meta.height, anchos: [...new Set(anchos)].sort((a, b) => a - b) };
}

async function exportarLogo(nombre, archivo) {
  // `trim` recorta el margen transparente; el umbral bajo evita comerse el
  // borde suave del trazo caligráfico.
  const recortado = await sharp(ruta(new URL(archivo, ORIGEN))).trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(recortado).metadata();
  const anchos = [320, 640];
  for (const ancho of anchos) {
    await sharp(recortado)
      .resize({ width: ancho, withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toFile(ruta(new URL(`${nombre}-${ancho}.webp`, DESTINO)));
  }
  dimensiones[nombre] = { ancho: meta.width, alto: meta.height, anchos };
}

const logosDeSocios = {};

/** Vértices del hexágono, reducido hacia el centro `margen` px (para el contorno). */
function puntosDeHexagono(margen = 0) {
  const escala = (HEX_ANCHO / 2 - margen) / (HEX_ANCHO / 2);
  const cx = HEX_ANCHO / 2;
  const cy = HEX_ALTO / 2;
  return [
    [HEX_ANCHO / 2, 0],
    [HEX_ANCHO, HEX_ALTO / 4],
    [HEX_ANCHO, (HEX_ALTO * 3) / 4],
    [HEX_ANCHO / 2, HEX_ALTO],
    [0, (HEX_ALTO * 3) / 4],
    [0, HEX_ALTO / 4],
  ]
    .map(([x, y]) => `${(cx + (x - cx) * escala).toFixed(2)},${(cy + (y - cy) * escala).toFixed(2)}`)
    .join(' ');
}

/** Color de fondo del logotipo: la mediana de su borde (los JPG traen ruido). */
async function colorDeBorde(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const muestras = [[], [], []];
  const tomar = (x, y) => {
    for (let k = 0; k < 3; k++) muestras[k].push(data[(y * w + x) * c + k]);
  };
  for (let x = 0; x < w; x++) {
    tomar(x, 0);
    tomar(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tomar(0, y);
    tomar(w - 1, y);
  }
  const mediana = (v) => v.sort((a, b) => a - b)[v.length >> 1];
  const [r, g, b] = muestras.map(mediana);
  return { r, g, b };
}

async function exportarSocio(slug, { archivo, aclararFondo = false, sinCorte = false }) {
  const origen = ruta(new URL(`LOGOS-SOCIOS/${archivo}`, ORIGEN));
  const meta = await sharp(origen).metadata();
  // Se descarta un 2 % del borde: algunos archivos traen una línea suelta en
  // el canto (Manq'a) que impediría recortar el margen.
  const corte = sinCorte ? 0 : Math.round(Math.min(meta.width, meta.height) * 0.02);
  let limpio = await sharp(origen)
    .flatten({ background: '#ffffff' })
    .extract({ left: corte, top: corte, width: meta.width - 2 * corte, height: meta.height - 2 * corte })
    .png()
    .toBuffer();
  if (aclararFondo) {
    // Grises muy claros y sin color (el degradado) pasan a blanco; el dibujo
    // del logotipo es oscuro o saturado y no se toca.
    const { data, info } = await sharp(limpio).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 3) {
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      if (min > 196 && max - min < 24) data[i] = data[i + 1] = data[i + 2] = 255;
    }
    limpio = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
  }
  const fondo = await colorDeBorde(limpio);
  const claro = (0.2126 * fondo.r + 0.7152 * fondo.g + 0.0722 * fondo.b) / 255 > 0.85;

  const recortado = await sharp(limpio).trim({ background: fondo, threshold: 28 }).png().toBuffer();
  const { width, height } = await sharp(recortado).metadata();
  // El rectángulo más grande con la proporción del logotipo que cabe en el
  // hexágono: h = H / (1 + a·H / 2W), w = a·h. Luego un margen de respiro.
  const aspecto = width / height;
  let alto = HEX_ALTO / (1 + (aspecto * HEX_ALTO) / (2 * HEX_ANCHO));
  let ancho = aspecto * alto;
  if (ancho > HEX_ANCHO) {
    ancho = HEX_ANCHO;
    alto = ancho / aspecto;
  }
  const RESPIRO = 0.74;
  ancho = Math.round(ancho * RESPIRO);
  alto = Math.round(alto * RESPIRO);
  const pieza = await sharp(recortado).resize({ width: ancho, height: alto, fit: 'contain', background: fondo }).png().toBuffer();
  const izquierda = Math.round((HEX_ANCHO - ancho) / 2);
  const arriba = Math.round((HEX_ALTO - alto) / 2);

  const svg = (cuerpo) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${HEX_ANCHO}" height="${HEX_ALTO}">${cuerpo}</svg>`);
  const capas = [
    { input: pieza, left: izquierda, top: arriba },
    { input: svg(`<polygon points="${puntosDeHexagono()}" fill="#fff"/>`), blend: 'dest-in' },
  ];
  // Un hexágono blanco sobre fondo claro desaparece: contorno fino, como el folleto.
  if (claro) capas.push({ input: svg(`<polygon points="${puntosDeHexagono(2)}" fill="none" stroke="${COLOR_DE_LINEA}" stroke-width="4"/>`) });

  const hexagono = await sharp({ create: { width: HEX_ANCHO, height: HEX_ALTO, channels: 4, background: { ...fondo, alpha: 1 } } })
    .composite(capas)
    .png()
    .toBuffer();
  for (const ancho of HEX_ANCHOS) {
    await sharp(hexagono)
      .resize({ width: ancho })
      .webp({ quality: 88, alphaQuality: 100, effort: 6 })
      .toFile(ruta(new URL(`socio-${slug}-${ancho}.webp`, DESTINO)));
  }
  logosDeSocios[slug] = { ancho: HEX_ANCHO, alto: HEX_ALTO, anchos: HEX_ANCHOS, claro };
}

async function exportarIconos() {
  // Isotipo: los tres pétalos, en la esquina superior izquierda del logotipo.
  // El trazo caligráfico negro de la «G» cruza esa zona; como los pétalos son
  // de color y el trazo es negro, se vuelven transparentes los píxeles oscuros
  // en lugar de recortar a ojo (la forma de los pétalos queda intacta).
  const archivo = ruta(new URL('BOLIVIA GOURMET.png', ORIGEN));
  const { data, info } = await sharp(archivo)
    .extract({ left: 140, top: 50, width: 660, height: 520 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (Math.max(data[i], data[i + 1], data[i + 2]) < 110) data[i + 3] = 0;
  }
  const petalos = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
  const cuadrado = (lado) =>
    sharp(petalos)
      .resize({ width: lado, height: lado, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ compressionLevel: 9 });
  await cuadrado(512).toFile(ruta(new URL('icon.png', APP)));
  // El icono de Apple no admite transparencia: fondo blanco, como el material impreso.
  await sharp(petalos)
    .resize({ width: 140, height: 140, fit: 'contain', background: '#ffffff' })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(ruta(new URL('apple-icon.png', APP)));
}

async function exportarOpenGraph() {
  // 1200×630 desde la foto del hero, con el encuadre en las caras.
  await sharp(ruta(new URL('2.png', ORIGEN)))
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(ruta(new URL('og.jpg', DESTINO)));
}

for (const [nombre, archivo] of Object.entries(FOTOS)) await exportarFoto(nombre, archivo);
for (const [nombre, archivo] of Object.entries(LOGOS)) await exportarLogo(nombre, archivo);
for (const [slug, datos] of Object.entries(SOCIOS)) await exportarSocio(slug, datos);
await exportarIconos();
await exportarOpenGraph();

const encabezado =
  '/**\n * GENERADO por scripts/optimizar-imagenes.mjs — no editar a mano.\n' +
  ' * Dimensiones reales de cada recurso publicado en public/img/.\n */\n\n';
writeFileSync(
  ruta(GENERADO),
  `${encabezado}export const DIMENSIONES = ${JSON.stringify(dimensiones, null, 2)} as const;\n\nexport type NombreDeImagen = keyof typeof DIMENSIONES;\n\n` +
    '/** Logotipos de socios y universidades, horneados como hexágonos (`socio-<logo>-<ancho>.webp`). */\n' +
    `export const LOGOS_DE_SOCIOS = ${JSON.stringify(logosDeSocios, null, 2)} as const;\n\nexport type NombreDeLogo = keyof typeof LOGOS_DE_SOCIOS;\n`,
);

console.log('Imágenes generadas:', Object.keys(dimensiones).length + Object.keys(logosDeSocios).length + 3);
