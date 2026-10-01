/**
 * Escudos de seguridad que se pueden comprobar sin servidor (ADR 0006).
 *
 * QUÉ SE PRUEBA:
 *   - La CSP de producción no tiene `'unsafe-inline'` ni `'unsafe-eval'` y
 *     cierra lo que debe cerrar.
 *   - Las redirecciones tras autenticarse no pueden salir del sitio.
 *   - Ningún componente usa el atributo `style` (la CSP lo ignora) ni
 *     `next/image` (lo añade siempre).
 *   - Ningún archivo del código contiene una clave `service_role` ni un JWT.
 *   - El matcher del proxy y la lista de archivos de next.config coinciden.
 *   - Las cookies de sesión salen `HttpOnly` y `SameSite=Lax`.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

import { nuevoNonce, politicaDeContenido, POLITICA_DE_ARCHIVOS } from '../src/lib/politica-de-contenido.ts';
import { destinoSeguro } from '../src/lib/redirecciones.ts';
import { endurecerCookie } from '../src/infrastructure/supabase/cookies.ts';

const RAIZ = new URL('../', import.meta.url);

function archivos(carpeta: URL, extensiones: readonly string[]): readonly URL[] {
  const salida: URL[] = [];
  for (const nombre of readdirSync(carpeta)) {
    const url = new URL(nombre, carpeta);
    if (statSync(url).isDirectory()) salida.push(...archivos(new URL(`${nombre}/`, carpeta), extensiones));
    else if (extensiones.some((e) => nombre.endsWith(e))) salida.push(url);
  }
  return salida;
}

// ---------------------------------------------------------------- CSP

test('la CSP de producción no permite scripts ni estilos en línea', () => {
  const csp = politicaDeContenido({ nonce: 'abc123', desarrollo: false });
  assert.doesNotMatch(csp, /unsafe-inline/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
  assert.match(csp, /style-src 'self' 'nonce-abc123'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /connect-src 'self'(;|$)/, 'el navegador no habla con Supabase');
  assert.match(csp, /upgrade-insecure-requests/);
});

test('las concesiones de desarrollo no llegan a producción', () => {
  const dev = politicaDeContenido({ nonce: 'n', desarrollo: true });
  assert.match(dev, /unsafe-eval/);
  assert.doesNotMatch(dev, /upgrade-insecure-requests/);
});

test('el nonce es aleatorio y de 128 bits', () => {
  const a = nuevoNonce();
  const b = nuevoNonce();
  assert.notEqual(a, b);
  assert.equal(Buffer.from(a, 'base64').length, 16);
});

test('la política de archivos no ejecuta nada', () => {
  assert.match(POLITICA_DE_ARCHIVOS, /default-src 'none'/);
  assert.doesNotMatch(POLITICA_DE_ARCHIVOS, /script-src/);
});

test('el matcher del proxy y next.config sirven la misma lista de archivos', () => {
  const proxy = readFileSync(new URL('src/proxy.ts', RAIZ), 'utf8');
  const config = readFileSync(new URL('next.config.ts', RAIZ), 'utf8');
  const extensiones = (texto: string) => texto.match(/\(\?:ico\|[a-z0-9|?]+\)/)?.[0];
  assert.ok(extensiones(proxy));
  assert.equal(extensiones(proxy), extensiones(config));
});

// ---------------------------------------------------------------- redirecciones

test('destinoSeguro solo deja volver al portal', () => {
  assert.equal(destinoSeguro('/portal'), '/portal');
  assert.equal(destinoSeguro('/portal/solicitud?programa=tortas'), '/portal/solicitud?programa=tortas');
  for (const malo of ['https://malicioso.com', '//malicioso.com', '/\\malicioso.com', 'javascript:alert(1)', '/carrera', '/portalfalso', '/portal\n/x', '']) {
    assert.equal(destinoSeguro(malo), '/portal', malo);
  }
  assert.equal(destinoSeguro(null), '/portal');
});

// ---------------------------------------------------------------- código

const FUENTES = [...archivos(new URL('src/', RAIZ), ['.ts', '.tsx']), ...archivos(new URL('contenido/', RAIZ), ['.ts'])];

test('ningún componente usa el atributo style ni next/image', () => {
  for (const url of FUENTES.filter((u) => u.pathname.endsWith('.tsx'))) {
    const codigo = readFileSync(url, 'utf8');
    assert.doesNotMatch(codigo, /\sstyle=\{/, url.pathname);
    assert.doesNotMatch(codigo, /from 'next\/image'/, url.pathname);
  }
});

test('ningún archivo del código contiene secretos', () => {
  for (const url of FUENTES) {
    const codigo = readFileSync(url, 'utf8');
    assert.doesNotMatch(codigo, /service_role['"]?\s*[:=]\s*['"]ey/i, url.pathname);
    assert.doesNotMatch(codigo, /eyJhbGciOi[A-Za-z0-9_-]{20,}/, `${url.pathname}: parece un JWT`);
    assert.doesNotMatch(codigo, /sb_secret_/, url.pathname);
  }
});

test('el cliente de Supabase solo existe en el servidor', () => {
  for (const url of FUENTES) {
    const codigo = readFileSync(url, 'utf8');
    if (!/^['"]use client['"]/m.test(codigo)) continue;
    assert.doesNotMatch(codigo, /@supabase|@infra\/supabase|cliente-servidor/, `${url.pathname}: cliente de Supabase en el navegador`);
  }
});

test('ningún color literal en componentes y páginas', () => {
  for (const url of FUENTES.filter((u) => u.pathname.endsWith('.tsx'))) {
    assert.doesNotMatch(readFileSync(url, 'utf8'), /#[0-9a-fA-F]{6}\b/, url.pathname);
  }
});

// ---------------------------------------------------------------- cookies

test('la cookie de sesión sale HttpOnly, SameSite=Lax y Secure en producción', () => {
  const prod = endurecerCookie({ httpOnly: false, sameSite: 'none', secure: false, maxAge: 10 }, true);
  assert.equal(prod.httpOnly, true);
  assert.equal(prod.sameSite, 'lax');
  assert.equal(prod.secure, true);
  assert.equal(prod.maxAge, 10, 'conserva la caducidad');
  assert.equal(endurecerCookie(undefined, false).secure, false, 'en http://localhost no puede ser Secure');
});
