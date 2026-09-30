/**
 * Hook de resolución: traduce los alias de `tsconfig.json` a rutas de archivo.
 *
 * Corre en el hilo de carga de módulos de Node, aislado del resto. Por eso lee
 * `tsconfig.json` por su cuenta en vez de recibir los alias ya calculados.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = new URL('../', import.meta.url);

function leerAlias() {
  const crudo = readFileSync(new URL('tsconfig.json', RAIZ), 'utf8');

  // `tsconfig.json` admite comentarios y `JSON.parse` no. Este no los tiene, y
  // quitarlos con una expresión regular rompe las rutas con `/*` dentro. Si
  // algún día se añade un comentario, esto falla aquí y con el motivo delante,
  // en vez de dejar los alias a medias y provocar un error de import opaco.
  let tsconfig;
  try {
    tsconfig = JSON.parse(crudo);
  } catch (error) {
    throw new Error(
      `tests/alias-hooks.mjs no pudo leer tsconfig.json (¿tiene comentarios?): ${error.message}`,
    );
  }

  const paths = tsconfig.compilerOptions?.paths ?? {};

  // De `{'@core/*': ['./src/core/*']}` a `[['@core/', 'src/core/']]`, con los
  // prefijos más largos primero: `@core/` tiene que ganar a `@/`.
  return Object.entries(paths)
    .flatMap(([patron, destinos]) => {
      const destino = destinos[0];
      if (!patron.endsWith('/*') || !destino?.endsWith('/*')) return [];
      return [[patron.slice(0, -1), destino.slice(0, -1).replace(/^\.\//, '')]];
    })
    .sort((a, b) => b[0].length - a[0].length);
}

const ALIAS = leerAlias();

/** Los alias se escriben sin extensión, como en el código de la aplicación. */
const EXTENSIONES = ['', '.ts', '.tsx', '/index.ts'];

export function resolve(especificador, contexto, siguiente) {
  // Rutas relativas sin extensión: las usan los módulos que importa
  // `next.config.ts` (su cargador resuelve mal los alias, ver `site-url.ts`).
  // Node exige la extensión; aquí se prueba como con un alias.
  // No basta con mirar si «tiene extensión»: `tenant.registry` lleva un punto.
  const relativa = /^\.\.?\//.test(especificador) && contexto.parentURL;
  if (relativa && !existsSync(fileURLToPath(new URL(especificador, contexto.parentURL)))) {
    const base = new URL(especificador, contexto.parentURL);
    for (const extension of EXTENSIONES.slice(1)) {
      const candidato = new URL(`${base.pathname}${extension}`, base);
      if (existsSync(fileURLToPath(candidato))) {
        return { url: candidato.href, shortCircuit: true, format: 'module-typescript' };
      }
    }
  }

  const alias = ALIAS.find(([prefijo]) => especificador.startsWith(prefijo));
  if (!alias) return siguiente(especificador, contexto);

  const [prefijo, destino] = alias;
  const base = new URL(`${destino}${especificador.slice(prefijo.length)}`, RAIZ);

  for (const extension of EXTENSIONES) {
    const candidato = new URL(`${base.pathname}${extension}`, RAIZ);
    if (existsSync(fileURLToPath(candidato))) {
      return { url: candidato.href, shortCircuit: true, format: 'module-typescript' };
    }
  }

  // Sin archivo detrás, que falle con el mensaje de Node y no con uno inventado.
  return siguiente(pathToFileURL(fileURLToPath(base)).href, contexto);
}
