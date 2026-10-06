/**
 * Cruce de horarios (ADR 0009 §3). Los casos son los mismos que prueba la
 * base con `app.cruce_de_grupos` (batería del panel, N113–N128): si una de
 * las dos gemelas cambia, estas pruebas o la batería lo delatan.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cruceDeHorarios,
  describirHorario,
  diasDeClase,
  horarioSemanal,
  type HorarioDeGrupo,
} from '../src/core/domain/academico/horario.ts';

const sabados: HorarioDeGrupo = { dias: 'sab', horaInicio: '09:00', horaFin: '13:00', fechaInicio: '2026-10-24', fechaFin: '2026-12-19' };

test('diasDeClase: rangos, un solo día y códigos desconocidos', () => {
  assert.deepEqual(diasDeClase('lun-vie'), ['lun', 'mar', 'mie', 'jue', 'vie']);
  assert.deepEqual(diasDeClase('lun-mie'), ['lun', 'mar', 'mie']);
  assert.deepEqual(diasDeClase('jue-vie'), ['jue', 'vie']);
  assert.deepEqual(diasDeClase('sab'), ['sab']);
  assert.deepEqual(diasDeClase(undefined), []);
  assert.deepEqual(diasDeClase(''), []);
  assert.deepEqual(diasDeClase('vie-lun'), [], 'un rango al revés no es un horario');
  assert.deepEqual(diasDeClase('feriado'), []);
  assert.deepEqual(diasDeClase('lun-mar-mie'), []);
});

test('cruce: horas que se solapan el mismo día se cruzan (N117: sábados 10–12 dentro de 9–13)', () => {
  assert.equal(cruceDeHorarios(sabados, { ...sabados, horaInicio: '10:00', horaFin: '12:00' }), 'se_cruza');
});

test('cruce: terminar a la hora en que el otro empieza no es cruce', () => {
  assert.equal(cruceDeHorarios(sabados, { ...sabados, horaInicio: '13:00', horaFin: '15:00' }), 'no_se_cruza');
});

test('cruce: sin un día en común no se cruzan (N118: lunes a miércoles frente a sábados)', () => {
  assert.equal(cruceDeHorarios(sabados, { ...sabados, dias: 'lun-mie', horaInicio: '09:00', horaFin: '13:00' }), 'no_se_cruza');
});

test('cruce: la carrera de lunes a viernes choca con un curso de lunes a miércoles en la noche (N121)', () => {
  const carrera: HorarioDeGrupo = { dias: 'lun-vie', turno: 'noche', horaInicio: '18:00', horaFin: '22:00', fechaInicio: '2026-02-02' };
  const reposteria: HorarioDeGrupo = { dias: 'lun-mie', turno: 'noche', horaInicio: '19:00', horaFin: '21:00', fechaInicio: '2026-10-12', fechaFin: '2026-12-11' };
  assert.equal(cruceDeHorarios(carrera, reposteria), 'se_cruza');
  assert.equal(cruceDeHorarios(reposteria, carrera), 'se_cruza', 'la regla es simétrica');
});

test('cruce: si las fechas no se tocan no se cruzan, aunque coincidan días y horas', () => {
  const antes: HorarioDeGrupo = { ...sabados, fechaInicio: '2026-08-15', fechaFin: '2026-10-14' };
  assert.equal(cruceDeHorarios(antes, sabados), 'no_se_cruza');
});

test('cruce: un grupo sin fecha de fin sigue abierto (la carrera)', () => {
  const carrera: HorarioDeGrupo = { dias: 'sab', horaInicio: '08:00', horaFin: '12:00', fechaInicio: '2026-02-02' };
  assert.equal(cruceDeHorarios(carrera, sabados), 'se_cruza');
});

test('cruce: sin días no se sabe; sin horas se compara el turno', () => {
  assert.equal(cruceDeHorarios(sabados, { fechaInicio: '2026-10-24', fechaFin: '2026-11-30' }), 'sin_horario');
  const nocheA: HorarioDeGrupo = { dias: 'lun-vie', turno: 'noche', fechaInicio: '2026-02-02' };
  const nocheB: HorarioDeGrupo = { dias: 'lun-mie', turno: 'noche', fechaInicio: '2026-10-12', fechaFin: '2026-12-11' };
  const tarde: HorarioDeGrupo = { ...nocheB, turno: 'tarde' };
  assert.equal(cruceDeHorarios(nocheA, nocheB), 'se_cruza');
  assert.equal(cruceDeHorarios(nocheA, tarde), 'no_se_cruza');
  assert.equal(cruceDeHorarios(nocheA, { ...nocheB, turno: undefined }), 'sin_horario', 'un curso sin turno ni horas no se puede comparar');
  assert.equal(cruceDeHorarios(nocheA, { ...nocheB, turno: 'especial' }), 'sin_horario', 'el horario especial no se compara por turno');
});

test('describirHorario: días y horas, o «Horario por confirmar»', () => {
  assert.equal(describirHorario(sabados), 'Sábados · 09:00–13:00');
  assert.equal(describirHorario({ dias: 'lun-vie', horaInicio: '18:00', horaFin: '21:00' }), 'Lun–Vie · 18:00–21:00');
  assert.equal(describirHorario({ dias: 'lun-vie' }), 'Lun–Vie');
  assert.equal(describirHorario({}), 'Horario por confirmar');
});

test('horarioSemanal: cada clase en sus días, por hora; lo que no tiene horas va aparte', () => {
  const clases = [
    { nombre: 'Carrera', horario: { dias: 'lun-vie', horaInicio: '18:00', horaFin: '21:00', fechaInicio: '2026-02-02' } },
    { nombre: 'Cocina', horario: sabados },
    { nombre: 'Tortas', horario: { dias: 'lun-mie', horaInicio: '15:00', horaFin: '17:00', fechaInicio: '2026-11-02' } },
    { nombre: 'Temporada', horario: { fechaInicio: '2026-12-01' } },
  ];
  const semana = horarioSemanal(clases, (c) => c.horario);
  assert.deepEqual(
    semana.dias.map((d) => d.dia),
    ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
  );
  assert.deepEqual(
    semana.dias[0]?.bloques.map((b) => `${b.inicio} ${b.elemento.nombre}`),
    ['15:00 Tortas', '18:00 Carrera'],
    'el lunes, por hora',
  );
  assert.deepEqual(semana.dias[5]?.bloques.map((b) => b.elemento.nombre), ['Cocina']);
  assert.deepEqual(semana.sinHora.map((c) => c.nombre), ['Temporada']);
});
