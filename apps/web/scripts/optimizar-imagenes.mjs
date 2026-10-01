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
await exportarIconos();
await exportarOpenGraph();

const encabezado =
  '/**\n * GENERADO por scripts/optimizar-imagenes.mjs — no editar a mano.\n' +
  ' * Dimensiones reales de cada recurso publicado en public/img/.\n */\n\n';
writeFileSync(
  ruta(GENERADO),
  `${encabezado}export const DIMENSIONES = ${JSON.stringify(dimensiones, null, 2)} as const;\n\nexport type NombreDeImagen = keyof typeof DIMENSIONES;\n`,
);

console.log('Imágenes generadas:', Object.keys(dimensiones).length + 3);
