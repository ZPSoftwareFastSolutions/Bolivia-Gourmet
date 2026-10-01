// Auditoría de huecos en blanco entre secciones (Edge por CDP, como capturar-pagina.mjs).
// Uso (con el servidor en marcha, desde apps/web):
//   node scripts/auditar-espacios.mjs http://localhost:3100/ 1440 [movil|-] [captura.png]
// Imprime JSON: las secciones de <main> (alto, fondo, relleno) y los «tramos
// vacíos»: franjas verticales sin texto, imagen, control ni caja pintada
// (tarjeta, botón, borde) de alto >= 1,15 × el relleno de sección. Un tramo
// con fondoUniforme=true es un hueco visible (dos secciones del mismo color
// que suman su relleno); con false suele ser el relleno normal de un cambio
// de color.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';

const [url, anchoTxt, movil, salida] = process.argv.slice(2);
const ancho = Number(anchoTxt);
const esMovil = movil === 'movil';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = 9300 + Math.floor(Math.random() * 600);
const perfil = `${process.env.TEMP}/cdp-auditoria-${PUERTO}`;
mkdirSync(perfil, { recursive: true });
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });

// Edge deja procesos hijos vivos si solo se mata el principal: se cierra el
// árbol entero y se borra el perfil temporal (si no, llenan el disco).
async function cerrar(codigo) {
  // El proceso lanzado por spawn termina enseguida y Edge sigue en otros: se
  // le pide al navegador que se cierre por CDP (cierra todos sus procesos).
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json();
    const navegador = new WebSocket(webSocketDebuggerUrl);
    await new Promise((r) => navegador.addEventListener('open', r, { once: true }));
    navegador.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await esperar(1500);
  } catch {}
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
  else edge.kill('SIGKILL');
  await esperar(800);
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {}
  process.exit(codigo);
}

let lista;
for (let i = 0; i < 60; i++) {
  try {
    lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    if (lista.some((t) => t.type === 'page')) break;
  } catch {}
  await esperar(250);
}
const pagina = lista?.find((t) => t.type === 'page');
if (!pagina) {
  console.error('Edge no arrancó');
  await cerrar(1);
}
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pendientes = new Map();
const eventos = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pendientes.has(msg.id)) {
    pendientes.get(msg.id)(msg);
    pendientes.delete(msg.id);
  } else if (msg.method) eventos.push(msg);
});
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pendientes.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Log.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: esMovil });
if (esMovil) await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
await cdp('Page.navigate', { url });
for (let i = 0; i < 80 && !eventos.some((e) => e.method === 'Page.loadEventFired'); i++) await esperar(250);
await esperar(1500);
await cdp('Runtime.evaluate', { expression: `(async()=>{document.documentElement.style.scrollBehavior='auto';for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);})()`, awaitPromise: true });
await esperar(1200);

const medir = `(() => {
  const vw = document.documentElement.clientWidth;
  const H = document.documentElement.scrollHeight;
  const sy = scrollY;
  const TRANSP = (c) => !c || c === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(c);
  const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05; };
  const oculto = (el) => !!el.closest('.sr-only');
  const contenido = [];
  const bandas = [];
  const anadir = (r) => { if (r.width > 1 && r.height > 1) contenido.push([r.top + sy, r.bottom + sy]); };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const n = tw.currentNode;
    if (!n.textContent.trim()) continue;
    const p = n.parentElement;
    if (!p || !visible(p) || oculto(p)) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) anadir(r);
  }
  for (const el of document.querySelectorAll('img,svg,video,iframe,canvas,input,select,textarea,button,hr')) {
    if (visible(el) && !oculto(el) && !el.closest('svg *')) anadir(el.getBoundingClientRect());
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || oculto(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const pintado = !TRANSP(cs.backgroundColor) || cs.backgroundImage !== 'none';
    const borde = ['Top','Right','Bottom','Left'].some((l) => parseFloat(cs['border' + l + 'Width']) > 0 && !TRANSP(cs['border' + l + 'Color']));
    const sombra = cs.boxShadow !== 'none';
    if (r.width >= vw * 0.9 && r.height > 14) {
      if (pintado) bandas.push({ y0: r.top + sy, y1: r.bottom + sy, fondo: TRANSP(cs.backgroundColor) ? 'imagen' : cs.backgroundColor });
      continue;
    }
    if (pintado || borde || sombra) anadir(r);
  }
  contenido.sort((a, b) => a[0] - b[0]);
  const fusion = [];
  for (const [a, b] of contenido) {
    const u = fusion[fusion.length - 1];
    if (u && a <= u[1] + 0.5) u[1] = Math.max(u[1], b); else fusion.push([a, b]);
  }
  const fondoEn = (y) => { let f = 'rgb(255, 255, 255)'; let mejor = Infinity; for (const b of bandas) if (y >= b.y0 && y < b.y1 && b.y1 - b.y0 < mejor) { mejor = b.y1 - b.y0; f = b.fondo; } return f; };
  const main = document.querySelector('main');
  const raiz = main ? [...main.children] : [];
  const nombre = (el) => {
    if (!el) return null;
    const lab = el.getAttribute('aria-labelledby');
    const h = (lab && document.getElementById(lab)) || el.querySelector('h1,h2');
    return (el.id ? '#' + el.id + ' ' : '') + (h ? h.textContent.trim().replace(/\\s+/g, ' ').slice(0, 60) : el.tagName.toLowerCase());
  };
  const seccionEn = (y) => { for (const el of raiz) { const r = el.getBoundingClientRect(); if (y >= r.top + sy && y < r.bottom + sy) return nombre(el); } return y < (main ? main.getBoundingClientRect().top + sy : 0) ? 'cabecera' : 'pie'; };
  const tramos = [];
  let cursor = 0;
  for (const [a, b] of [...fusion, [H, H]]) {
    if (a - cursor > 1) {
      const y0 = cursor, y1 = a;
      const fondos = new Set();
      for (let y = y0 + 1; y < y1; y += 8) fondos.add(fondoEn(y));
      tramos.push({ y0: Math.round(y0), y1: Math.round(y1), alto: Math.round(y1 - y0), fondoUniforme: fondos.size === 1, fondos: [...fondos], desde: seccionEn(y0 + 1), hasta: seccionEn(y1 - 1) });
    }
    cursor = Math.max(cursor, b);
  }
  const prueba = document.createElement('div');
  prueba.className = 'section';
  document.body.appendChild(prueba);
  const relleno = parseFloat(getComputedStyle(prueba).paddingTop);
  prueba.remove();
  const secciones = raiz.map((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { nombre: nombre(el), y0: Math.round(r.top + sy), alto: Math.round(r.height), fondo: cs.backgroundColor, rellenoArriba: cs.paddingTop, rellenoAbajo: cs.paddingBottom }; });
  return JSON.stringify({ vw, alto: H, scrollWidth: document.documentElement.scrollWidth, rellenoDeSeccion: relleno, secciones, tramosVacios: tramos.filter((t) => t.alto >= relleno * 1.15) });
})()`;

const res = await cdp('Runtime.evaluate', { expression: medir, returnByValue: true });
const datos = res.result.result ? JSON.parse(res.result.result.value) : { error: res.result.exceptionDetails?.text };
if (salida && datos.alto) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: datos.alto, deviceScaleFactor: 1, mobile: esMovil });
  await esperar(800);
  const foto = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: ancho, height: datos.alto, scale: 1 } });
  writeFileSync(salida, Buffer.from(foto.result.data, 'base64'));
}
const errores = eventos
  .filter((e) => (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)) || e.method === 'Runtime.exceptionThrown')
  .map((e) => e.params.entry?.text ?? e.params.exceptionDetails?.text);
console.log(JSON.stringify({ url, ancho, desborda: datos.scrollWidth > datos.vw, ...datos, errores }, null, 1));
ws.close();
await cerrar(0);
