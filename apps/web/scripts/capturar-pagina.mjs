// Captura de página completa con emulación de dispositivo vía CDP (Edge).
// Uso (con el servidor en marcha):
//   node scripts/capturar-pagina.mjs http://localhost:3100/ 375 salida.png movil
// Edge sin interfaz impone ~500 px de ancho mínimo de ventana y recorta;
// con Emulation.setDeviceMetricsOverride el diseño se calcula al ancho real.
// Imprime ancho, alto, si desborda y los errores de consola (CSP incluida).
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';

const [url, anchoTxt, salida, movil] = process.argv.slice(2);
const ancho = Number(anchoTxt);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = 9300 + Math.floor(Math.random() * 500);
const perfil = `${process.env.TEMP}/cdp-perfil-${PUERTO}`;
mkdirSync(perfil, { recursive: true });

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });

let lista;
for (let i = 0; i < 40; i++) {
  try {
    lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    if (lista.some((t) => t.type === 'page')) break;
  } catch {}
  await esperar(250);
}
const pagina = lista.find((t) => t.type === 'page');
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
await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: movil === 'movil' });
if (movil === 'movil') await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
await cdp('Page.navigate', { url });
for (let i = 0; i < 80 && !eventos.some((e) => e.method === 'Page.loadEventFired'); i++) await esperar(250);
await esperar(1500);
// Fuerza la carga de imágenes diferidas recorriendo la página.
await cdp('Runtime.evaluate', { expression: `(async()=>{document.documentElement.style.scrollBehavior='auto';for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);})()`, awaitPromise: true });
await esperar(1200);
const medidas = await cdp('Runtime.evaluate', { expression: 'JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight})', returnByValue: true });
const { sw, cw, h } = JSON.parse(medidas.result.result.value);
await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: h, deviceScaleFactor: 1, mobile: movil === 'movil' });
await esperar(800);
const foto = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: ancho, height: h, scale: 1 } });
writeFileSync(salida, Buffer.from(foto.result.data, 'base64'));
const errores = eventos.filter((e) => (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)) || e.method === 'Runtime.exceptionThrown').map((e) => e.params.entry?.text ?? e.params.exceptionDetails?.text);
console.log(JSON.stringify({ url, ancho, scrollWidth: sw, clientWidth: cw, alto: h, desborda: sw > cw, errores }));
ws.close();
// Edge deja procesos hijos vivos si solo se mata el principal: se cierra el
// árbol entero y se borra el perfil temporal (si no, llenan el disco).
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
process.exit(0);
