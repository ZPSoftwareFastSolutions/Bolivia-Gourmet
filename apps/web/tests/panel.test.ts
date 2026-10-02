/**
 * Panel interno (rebanada R1): contexto de sesión, menú por permisos y fechas
 * de la cabecera. Lo que se ve depende de los permisos que calcula la base;
 * estas pruebas fijan que la pantalla no muestre de más ni de menos.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { puedeEntrarAlPanel, saludoSegunHora, sedeDeTrabajo, tienePermiso, type ContextoDePanel } from '../src/core/domain/identidad/contexto-de-panel.ts';
import { formatearDiaLargo, horaEnBolivia } from '../src/lib/fechas.ts';
import { RUTAS_PANEL } from '../src/lib/rutas.ts';
import { SECCIONES_DEL_PANEL, seccionActiva, seccionesVisibles } from '../src/presentation/panel/navegacion.ts';

const SEDES = [
  { id: 'a', codigo: 'LPZ', nombre: 'La Paz', zona: 'Miraflores' },
  { id: 'b', codigo: 'EAL', nombre: 'El Alto', zona: 'La Ceja' },
] as const;

function contexto(permisos: readonly string[], extra: Partial<ContextoDePanel> = {}): ContextoDePanel {
  return {
    id: 'u' as ContextoDePanel['id'],
    rol: 'recepcion',
    nombres: 'Rosa',
    apellidos: 'Condori',
    correo: 'rosa@example.test',
    activo: true,
    sedeId: 'b' as ContextoDePanel['sedeId'],
    hoy: '2026-10-02' as ContextoDePanel['hoy'],
    permisos: new Set(permisos),
    sedes: SEDES as unknown as ContextoDePanel['sedes'],
    ...extra,
  };
}

const RECEPCION = ['panel.entrar', 'estudiantes.leer', 'inventario.leer', 'caja.leer', 'caja.cobrar'];
const ADMINISTRACION = [...RECEPCION, 'contabilidad.leer', 'perfiles.gestionar', 'sedes.todas'];

test('recepción ve Inicio, Alumnos, Inventario y Caja; administración además Contabilidad y Ajustes', () => {
  assert.deepEqual(
    seccionesVisibles(new Set(RECEPCION)).map((s) => s.etiqueta),
    ['Inicio', 'Alumnos', 'Inventario', 'Caja'],
  );
  assert.deepEqual(
    seccionesVisibles(new Set(ADMINISTRACION)).map((s) => s.etiqueta),
    ['Inicio', 'Alumnos', 'Inventario', 'Caja', 'Contabilidad', 'Ajustes'],
  );
  assert.deepEqual(seccionesVisibles(new Set(['estudiante'])), []);
});

test('la barra inferior del teléfono no pasa de cinco botones (cuatro secciones + Más)', () => {
  assert.ok(SECCIONES_DEL_PANEL.filter((s) => s.enBarraInferior).length <= 4);
});

test('la sección activa es la de prefijo más largo; Inicio solo en su ruta exacta', () => {
  const s = SECCIONES_DEL_PANEL;
  assert.equal(seccionActiva('/panel', s), RUTAS_PANEL.inicio);
  assert.equal(seccionActiva('/panel/caja', s), RUTAS_PANEL.caja);
  assert.equal(seccionActiva('/panel/caja/recibo/12', s), RUTAS_PANEL.caja);
  assert.equal(seccionActiva('/panel/cajas', s), null);
  assert.equal(seccionActiva('/panel/mas', s), null);
});

test('entra al panel quien tiene panel.entrar y su cuenta está activa', () => {
  assert.equal(puedeEntrarAlPanel(contexto(RECEPCION)), true);
  assert.equal(puedeEntrarAlPanel(contexto(RECEPCION, { activo: false })), false);
  assert.equal(puedeEntrarAlPanel(contexto([])), false);
  assert.equal(tienePermiso(contexto(ADMINISTRACION), 'contabilidad.leer'), true);
  assert.equal(tienePermiso(contexto(RECEPCION), 'contabilidad.leer'), false);
});

test('la sede de trabajo es la propia; sin sede asignada, la primera que puede operar', () => {
  assert.equal(sedeDeTrabajo(contexto(RECEPCION))?.nombre, 'El Alto');
  assert.equal(sedeDeTrabajo(contexto(ADMINISTRACION, { sedeId: null }))?.nombre, 'La Paz');
  assert.equal(sedeDeTrabajo(contexto(RECEPCION, { sedeId: null, sedes: [] })), null);
});

test('saludo según la hora de Bolivia', () => {
  assert.equal(saludoSegunHora(5), 'Buenos días');
  assert.equal(saludoSegunHora(11), 'Buenos días');
  assert.equal(saludoSegunHora(12), 'Buenas tardes');
  assert.equal(saludoSegunHora(18), 'Buenas tardes');
  assert.equal(saludoSegunHora(19), 'Buenas noches');
  assert.equal(saludoSegunHora(2), 'Buenas noches');
});

test('la hora se toma en La Paz (UTC−4) y la fecha de negocio no se corre de día', () => {
  assert.equal(horaEnBolivia(new Date('2026-10-02T03:30:00Z')), 23);
  assert.equal(horaEnBolivia(new Date('2026-10-02T12:00:00Z')), 8);
  assert.match(formatearDiaLargo('2026-10-02'), /viernes,? 2 de octubre/);
  assert.equal(formatearDiaLargo('no-es-fecha'), '—');
});
