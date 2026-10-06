/**
 * Inscripciones por convocatoria (ADR 0009): qué grupos ofrece cada página
 * del portal, cuándo un grupo no se puede pedir (y con qué frase, la misma de
 * la base) y cómo se lee lo que devuelven `oferta_abierta()` y `mis_grupos()`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  disponibilidadDeGrupo,
  gestionAnteriorSugerida,
  gruposPara,
  programasEnConvocatoria,
  SIN_GRUPOS,
  type GrupoDelPortal,
  type MisGrupos,
  type SolicitudPropia,
} from '../src/core/domain/portal/convocatoria.ts';
import type { Id } from '../src/core/domain/shared/tipos-base.ts';
import { grupoDesdeBase, gruposDesdeBase, misGruposDesdeBase } from '../src/infrastructure/supabase/convocatoria-desde-base.ts';

export function grupo(id: string, cambios: Partial<GrupoDelPortal> = {}): GrupoDelPortal {
  return {
    id: id as Id,
    programaCodigo: 'cocina',
    programaNombre: 'Cocina',
    programaTipo: 'curso',
    sedeId: 'sede-lp' as Id,
    sedeNombre: 'La Paz',
    nombre: `Grupo ${id}`,
    gestion: 2026,
    dias: 'sab',
    horaInicio: '09:00',
    horaFin: '13:00',
    fechaInicio: '2026-11-07',
    fechaFin: '2027-01-02',
    inscripcionDesde: '2026-10-01',
    inscripcionHasta: '2026-11-04',
    capacidad: 15,
    libres: 15,
    precios: [],
    ...cambios,
  };
}

const CARRERA_1 = grupo('c1', {
  programaCodigo: 'gastronomia',
  programaNombre: 'Gastronomía',
  programaTipo: 'carrera',
  anioDeCarrera: 1,
  turno: 'noche',
  dias: 'lun-vie',
  horaInicio: '18:00',
  horaFin: '21:00',
  fechaInicio: '2026-02-02',
  fechaFin: undefined,
  nombre: 'Gastronomía · 1.er año · Noche · 2026 · La Paz',
});
const CARRERA_2 = grupo('c2', { ...CARRERA_1, id: 'c2' as Id, anioDeCarrera: 2, gestion: 2027, fechaInicio: '2027-02-01' });
const TORTAS_SEMANA = grupo('t1', {
  programaCodigo: 'tortas',
  programaNombre: 'Tortas',
  dias: 'lun-mie',
  horaInicio: '19:00',
  horaFin: '21:00',
  nombre: 'Tortas · Lun–Mié · nov 2026 · El Alto',
});
const COCINA_SABADO = grupo('k1', { nombre: 'Cocina · Sábados · nov 2026 · La Paz' });

/** Diego: cursa el 1.er año de la carrera (lunes a viernes, 18:00–21:00). */
const DIEGO: MisGrupos = { inscripciones: [{ inscripcionId: 'i1' as Id, estado: 'inscrito', paquete: 'economico', grupo: CARRERA_1 }], solicitudes: [] };

test('«Nueva inscripción» ofrece los cursos y el 1.er año; «Renovar», el 2.º y el 3.er año', () => {
  const oferta = [CARRERA_1, CARRERA_2, TORTAS_SEMANA, COCINA_SABADO];
  assert.deepEqual(gruposPara('inscripcion', oferta).map((g) => g.id), ['c1', 't1', 'k1']);
  assert.deepEqual(gruposPara('renovacion', oferta).map((g) => g.id), ['c2']);
});

test('los programas en convocatoria salen en el orden de la oferta, con sus grupos', () => {
  const otraCocina = grupo('k2', { sedeNombre: 'El Alto' });
  const programas = programasEnConvocatoria([COCINA_SABADO, TORTAS_SEMANA, otraCocina]);
  assert.deepEqual(programas.map((p) => [p.codigo, p.grupos.map((g) => g.id)]), [
    ['cocina', ['k1', 'k2']],
    ['tortas', ['t1']],
  ]);
});

test('sin cursos ni solicitudes, todo grupo con cupo se puede pedir', () => {
  assert.deepEqual(disponibilidadDeGrupo(COCINA_SABADO, 'inscripcion', SIN_GRUPOS, []), { estado: 'disponible' });
  assert.deepEqual(disponibilidadDeGrupo(grupo('x', { libres: 0 }), 'inscripcion', SIN_GRUPOS, []), {
    estado: 'bloqueado',
    motivo: 'Ese grupo ya no tiene cupos.',
  });
  assert.equal(disponibilidadDeGrupo(grupo('x', { capacidad: undefined, libres: undefined }), 'inscripcion', SIN_GRUPOS, []).estado, 'disponible', 'sin límite de cupos');
});

test('el curso que se cruza con la carrera se bloquea con la frase de la base (N121)', () => {
  assert.deepEqual(disponibilidadDeGrupo(TORTAS_SEMANA, 'inscripcion', DIEGO, []), {
    estado: 'bloqueado',
    motivo: 'Ese horario se cruza con tu curso «Gastronomía · 1.er año · Noche · 2026 · La Paz».',
  });
  assert.equal(disponibilidadDeGrupo(COCINA_SABADO, 'inscripcion', DIEGO, []).estado, 'disponible', 'los sábados no chocan');
});

test('ya inscrito en el grupo: no se vuelve a pedir; un curso concluido no cuenta', () => {
  assert.deepEqual(disponibilidadDeGrupo(CARRERA_1, 'inscripcion', DIEGO, []), { estado: 'bloqueado', motivo: 'Ya estás inscrito en ese grupo.' });
  const concluido: MisGrupos = { inscripciones: [{ ...DIEGO.inscripciones[0]!, estado: 'concluido' }], solicitudes: [] };
  assert.equal(disponibilidadDeGrupo(TORTAS_SEMANA, 'inscripcion', concluido, []).estado, 'disponible');
});

test('renovar al 2.º año no choca con su propio 1.er año (N122)', () => {
  assert.deepEqual(disponibilidadDeGrupo(CARRERA_2, 'renovacion', DIEGO, []), { estado: 'disponible' });
  assert.equal(disponibilidadDeGrupo(CARRERA_2, 'inscripcion', DIEGO, []).estado, 'bloqueado', 'como inscripción nueva sí se compara');
});

test('se compara con los grupos de sus solicitudes abiertas, no con las cerradas (N117)', () => {
  const pidio: MisGrupos = { inscripciones: [], solicitudes: [{ solicitudId: 's1' as Id, grupo: COCINA_SABADO }] };
  const abierta: SolicitudPropia = { id: 's1' as Id, programaCodigo: 'cocina', tipo: 'inscripcion', estado: 'pendiente' };
  const tortasSabado = grupo('t2', { programaCodigo: 'tortas', horaInicio: '10:00', horaFin: '12:00' });
  assert.deepEqual(disponibilidadDeGrupo(tortasSabado, 'inscripcion', pidio, [abierta]), {
    estado: 'bloqueado',
    motivo: 'Ese horario se cruza con el grupo que ya pediste: «Cocina · Sábados · nov 2026 · La Paz».',
  });
  assert.deepEqual(disponibilidadDeGrupo(COCINA_SABADO, 'inscripcion', pidio, [abierta]), {
    estado: 'bloqueado',
    motivo: 'Ya pediste este grupo. Espera la respuesta de recepción.',
  });
  for (const estado of ['cancelada', 'rechazada', 'aprobada'] as const) {
    assert.equal(disponibilidadDeGrupo(tortasSabado, 'inscripcion', pidio, [{ ...abierta, estado }]).estado, 'disponible', estado);
  }
});

test('si un horario no se puede comparar, se puede pedir con un aviso', () => {
  const sinHoras = grupo('v1', { dias: undefined, horaInicio: undefined, horaFin: undefined, nombre: 'Cursos de temporada · Virtual · dic 2026 · La Paz' });
  const conTemporada: MisGrupos = { inscripciones: [{ inscripcionId: 'i9' as Id, estado: 'inscrito', grupo: sinHoras }], solicitudes: [] };
  const resultado = disponibilidadDeGrupo(COCINA_SABADO, 'inscripcion', conTemporada, []);
  assert.equal(resultado.estado, 'disponible');
  assert.ok(resultado.estado === 'disponible' && resultado.aviso?.includes('confírmalo con recepción'));
});

test('la gestión anterior sugerida sale de su inscripción más reciente en la carrera', () => {
  assert.equal(gestionAnteriorSugerida(DIEGO), '1.er año · gestión 2026');
  const dos: MisGrupos = {
    inscripciones: [
      ...DIEGO.inscripciones,
      { inscripcionId: 'i2' as Id, estado: 'concluido', grupo: { ...CARRERA_2, gestion: 2025, fechaInicio: '2025-02-03' } },
    ],
    solicitudes: [],
  };
  assert.equal(gestionAnteriorSugerida(dos), '1.er año · gestión 2026', 'la más reciente por fecha de inicio');
  assert.equal(gestionAnteriorSugerida({ inscripciones: [{ inscripcionId: 'i3' as Id, estado: 'inscrito', grupo: COCINA_SABADO }], solicitudes: [] }), undefined);
  assert.equal(gestionAnteriorSugerida(SIN_GRUPOS), undefined);
});

// ---------------------------------------------------------------- lectura de la base

const DE_LA_BASE = {
  id: 'g-1',
  programa_codigo: 'gastronomia',
  programa_nombre: 'Gastronomía',
  programa_tipo: 'carrera',
  sede_id: 's-1',
  sede_nombre: 'La Paz',
  nombre: 'Gastronomía · 2.º año · Noche · 2027 · La Paz',
  gestion: 2027,
  anio_de_carrera: 2,
  turno: 'noche',
  dias: 'lun-vie',
  hora_inicio: '18:00',
  hora_fin: '21:00',
  duracion: 3,
  modalidad: null,
  fecha_inicio: '2027-02-01',
  fecha_fin: null,
  inscripcion_desde: '2026-10-03',
  inscripcion_hasta: '2026-12-15',
  capacidad: 30,
  libres: 28,
  precios: [{ paquete: 'economico', monto_cuota: 65000, cuotas: 1, cada_meses: 1 }, { paquete: 'economico', monto_cuota: -1, cuotas: 1 }],
};

test('un grupo de la base se lee completo; un precio inválido se descarta', () => {
  const g = grupoDesdeBase(DE_LA_BASE);
  assert.ok(g);
  assert.equal(g.anioDeCarrera, 2);
  assert.equal(g.turno, 'noche');
  assert.equal(g.modalidad, undefined);
  assert.equal(g.fechaFin, undefined);
  assert.equal(g.libres, 28);
  assert.deepEqual(g.precios, [{ paquete: 'economico', montoCuota: 65000, cuotas: 1, cadaMeses: 1 }]);
});

test('lo ilegible no entra: sin id o fecha se descarta; un horario o plazo a medias se ignora', () => {
  assert.equal(grupoDesdeBase({ ...DE_LA_BASE, id: null }), null);
  assert.equal(grupoDesdeBase({ ...DE_LA_BASE, fecha_inicio: '1/2/2027' }), null);
  assert.equal(grupoDesdeBase({ ...DE_LA_BASE, programa_tipo: 'maestria' }), null);
  assert.equal(grupoDesdeBase('no es un grupo'), null);
  const aMedias = grupoDesdeBase({ ...DE_LA_BASE, hora_fin: null, inscripcion_hasta: null, turno: 'madrugada' });
  assert.ok(aMedias);
  assert.equal(aMedias.horaInicio, undefined, 'sin hora de fin no hay horario');
  assert.equal(aMedias.inscripcionDesde, undefined, 'sin fin de plazo no hay plazo');
  assert.equal(aMedias.turno, undefined, 'un turno desconocido no entra');
  assert.deepEqual(gruposDesdeBase([DE_LA_BASE, { id: 'roto' }, null]).map((x) => x.id), ['g-1']);
  assert.deepEqual(gruposDesdeBase(null), []);
});

test('mis_grupos se lee con sus inscripciones y el grupo de cada solicitud', () => {
  const mios = misGruposDesdeBase({
    inscripciones: [
      { inscripcion_id: 'i-1', estado: 'inscrito', paquete: 'economico', grupo: DE_LA_BASE },
      { inscripcion_id: 'i-2', estado: 'retirado', grupo: DE_LA_BASE },
    ],
    solicitudes: [{ solicitud_id: 's-1', grupo: DE_LA_BASE }, { solicitud_id: 's-2', grupo: null }],
  });
  assert.deepEqual(mios.inscripciones.map((i) => [i.inscripcionId, i.estado, i.paquete]), [['i-1', 'inscrito', 'economico']]);
  assert.deepEqual(mios.solicitudes.map((s) => s.solicitudId), ['s-1']);
  assert.deepEqual(misGruposDesdeBase(undefined), { inscripciones: [], solicitudes: [] });
});
