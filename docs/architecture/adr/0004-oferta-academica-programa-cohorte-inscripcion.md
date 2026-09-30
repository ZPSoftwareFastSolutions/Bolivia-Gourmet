# ADR 0004 — Oferta académica: Programa → Cohorte → Inscripción

**Estado:** Aceptada · **Fecha:** 2026-09-30 · **Ámbito:** ambos sistemas

## Contexto

`INFORMACION-INSTITUTO.md` describe una carrera de 3 años con tres turnos y
cinco cursos con duración elegible (1, 2 o 3 meses; 2, 4 o 6 meses…), días
alternativos (semana o sábados), turnos y modalidades. El folleto impreso deja
en blanco inicio, duración, horario, costo y uniforme de cada curso: se
rellenan a mano en cada apertura. El encargo pide no inventar categorías de
estudiante y dejar preparado el camino para nuevas carreras, cursos,
promociones o gestiones sin rehacer el sistema.

## Decisión

Tres entidades, en cadena:

- **`Programa`**: la oferta publicable (carrera o curso) con sus **opciones**
  (duraciones posibles, días, turnos, modalidades), su contenido (plan de
  estudios o bloques), sus requisitos, beneficios y su costo (hoy pendiente).
  `tipo` es un enum abierto: `carrera · curso · curso_de_temporada`.
- **`Cohorte`**: una apertura concreta de un programa en una sede, con fecha
  de inicio y **una elección** de cada opción (duración, turno, días,
  modalidad) y el **costo congelado**.
- **`Inscripcion`**: el vínculo estudiante ↔ cohorte, con estado, paquete de
  pago (solo carrera) y checklist de requisitos entregados.

Las «categorías» de estudiantes (carrera/curso, turno, sede, gestión, año)
**se derivan de la inscripción y su cohorte**; el estudiante no lleva ninguna
de ellas como atributo propio.

## Motivos

- Es la estructura que el propio folleto usa: oferta impresa + campos en
  blanco por apertura.
- Un curso nuevo, una promoción, una gestión o un turno nuevo son **datos**,
  no código.
- Un estudiante puede cursar la carrera y un curso a la vez; con categorías
  en el estudiante habría que elegir una.
- Congelar el costo en la cohorte es la misma regla que protegió a las
  membresías en GYM PLATFORM: si el precio del programa sube, la cohorte
  vendida no cambia.

## Consecuencias

- La página pública muestra **programas** (la oferta) y, cuando existan,
  **cohortes abiertas** («Inicio: febrero 2027 · turno noche»). Sin cohortes
  en la base, muestra la oferta con «Consultar» donde falte el dato.
- El panel inscribe **en cohortes**, nunca en programas. La primera cohorte
  real de la carrera es «Gastronomía · Febrero 2027» por sede y turno.
- La validación «la cohorte elige entre las opciones del programa» vive en el
  dominio (`validarCohorte`) y se repite como `CHECK`/disparador en la base.
- `Sesion` (clase concreta) queda definida en el modelo pero no se implementa
  hasta resolver si se toma asistencia (P10) y cómo se relaciona con la
  entrega de uniformes (P2).

## Alternativas descartadas

| Opción | Motivo |
|---|---|
| `Estudiante.tipo = 'carrera' \| 'curso'` | Impide inscripciones simultáneas; mezcla persona con oferta |
| Inscribir directamente en el programa | Pierde fecha de inicio, turno elegido y costo congelado; imposible distinguir promociones |
| Tablas separadas `carreras` y `cursos` | Duplica cohortes, inscripciones y pantallas; el tipo ya expresa la diferencia |
