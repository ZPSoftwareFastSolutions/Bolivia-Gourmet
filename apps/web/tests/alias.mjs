/**
 * Registra la resolución de los alias de `tsconfig.json` para `node --test`.
 *
 * POR QUÉ HACE FALTA. Next.js entiende `@core/...` porque lo lee de
 * `tsconfig.json`; Node, no. Las pruebas de dominio nunca lo notaron porque el
 * dominio solo importa por ruta relativa, pero el VALIDADOR y la configuración
 * del gimnasio sí usan los alias, y son justo lo que hay que probar: en esta
 * versión son la única red que queda entre una errata y la publicación.
 *
 * La alternativa era reescribir esos imports a rutas relativas solo para que
 * las pruebas pudieran cargarlos. Eso deja el código peor para que la prueba
 * sea más fácil, que es el intercambio equivocado.
 *
 * Se carga con `--import` (ver el script `test` de package.json).
 */

import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
