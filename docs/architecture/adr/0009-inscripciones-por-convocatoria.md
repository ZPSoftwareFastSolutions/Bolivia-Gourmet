# ADR 0009 — Inscripciones por convocatoria

**Estado:** Aceptada y construida (2026-10-06) · **Fecha:**
2026-10-05 · **Ámbito:** portal de estudiantes y panel (alumnos y grupos) ·
Modifica ADR 0005 (qué pide un estudiante) y las reglas de solicitud del
modelo de dominio.

> **Cómo se construyó.** En tres pasos, para no romper el portal en uso:
> 1. Ampliar la base: `20261005130000` (grupos con horario y plazo,
>    `solicitudes.cohorte_id`, cruce, lecturas del portal) y `20261005130100`
>    (año de la carrera).
> 2. Una transición (`20261005130200`) mientras el portal viejo seguía en uso:
>    sin grupo, reglas de antes.
> 3. Con el portal y el panel nuevos (2026-10-06), `20261005130300` vuelve
>    obligatorio el grupo.
>
> Dónde vive cada parte:
> - dominio: `academico/horario.ts` (cruce y horario semanal),
>   `portal/convocatoria.ts` (qué se ofrece y por qué un grupo se bloquea) y
>   `portal/solicitud.ts` (validación);
> - lectura de la base: `infrastructure/supabase/convocatoria-desde-base.ts`;
> - datos de demostración: `supabase/seed/convocatorias-demo.sql`.

## Contexto

Hasta la v1, un estudiante podía pedir cualquier programa activo del catálogo
el día que quisiera: elegía programa, sede, turno, días, duración y
modalidad, y recepción buscaba después un grupo que encajara. En las oficinas
de la institución se vio que no funciona así:

- La institución **abre** un curso (un grupo con sede, días y horario) y da
  un **plazo de inscripciones**. Fuera de ese plazo no se inscribe por la
  web, aunque el curso exista.
- Si solo hay dos cursos de capacitación abiertos y la inscripción a la
  carrera cerró, el estudiante debe ver solo esos dos.
- Quien ya cursa algo no puede pedir un horario que se cruce con el suyo, y le
  sirve ver su horario.

Pedido del usuario, 2026-10-05: al inscribirse, ver primero sus cursos; si no
tiene, el catálogo; al elegir uno, una ficha del contenido y si las
inscripciones están abiertas; validar el cruce de horarios y darle un horario
personal; y adecuar el panel.

## Decisión

### 1. Lo que se abre es el grupo, con un plazo

`cohortes` gana el **horario** (`hora_inicio`, `hora_fin`) y el **plazo de
inscripción por el portal** (`inscripcion_desde`, `inscripcion_hasta`).
Administración lo escribe al abrir o editar el grupo.

- Un grupo está **en convocatoria** si: estado `abierto` o `en_curso`, hoy
  (La Paz) dentro del plazo y cupos libres (o sin límite de cupos).
- Un grupo con plazo tiene horario (la base lo exige): el estudiante sabe a
  qué se compromete y el cruce se puede calcular.
- El plazo solo rige el portal. Recepción sigue inscribiendo en persona en
  cualquier grupo que admita inscripciones (regla A7).

### 2. La solicitud pide un grupo

`solicitudes.cohorte_id`. La base:

- exige el grupo en toda solicitud nueva (salvo en modo mantenimiento, para
  cargar historial de demostración);
- copia del grupo la sede, el turno, los días, la duración y la modalidad
  (lo que mande el navegador no cuenta);
- comprueba que el grupo sea del programa, esté en convocatoria y tenga
  cupos, y que el estudiante no esté ya inscrito en él;
- la renovación solo se pide en un grupo de la carrera, y por el portal la
  carrera se empieza en el 1.er año y se renueva al 2.º o 3.er
  (`app.validar_anio_de_solicitud`, disparador aparte);
- rechaza el **cruce de horarios** con sus cursos vigentes y con los grupos
  de sus otras solicitudes abiertas;
- conserva las reglas de antes: una solicitud abierta por programa y tipo,
  como mucho 5 abiertas, solo se cancela lo pendiente.

Los errores son frases completas (códigos 23514/23505): el portal las muestra
tal cual (`errores.ts`).

### 3. Cruce de horarios: una regla, dos gemelas

`app.cruce_de_grupos(a, b)` y `cruceDeHorarios(a, b)`
(`core/domain/academico/horario.ts`), probadas con los mismos casos:

1. Si las fechas no se tocan (sin fin = sigue abierto), **no se cruzan**.
2. Si a alguno le faltan los días, **sin horario** (no se sabe).
3. Si no comparten ningún día, **no se cruzan** (`lun-vie` = lunes a
   viernes; `sab` = sábados).
4. Con horario en los dos: **se cruzan** si las horas se solapan.
5. Sin horario en alguno pero con turno (mañana, tarde, noche) en los dos:
   **se cruzan** si es el mismo turno.
6. Si no, **sin horario**.

Solo «se cruzan» bloquea; «sin horario» se avisa en el portal («confírmalo
con recepción»). En una renovación no se compara con los grupos de su misma
carrera: pasa de un año al siguiente.

### 4. Lecturas del portal

El estudiante no lee `cohortes`, `inscripciones` ni `planes_de_pago` (RLS).
Dos lecturas DEFINER en `app` con fachada INVOKER en `public`, solo para
`authenticated`, que devuelven columnas seguras:

- `oferta_abierta()`: los grupos en convocatoria, con nombre, sede, días,
  horario, fechas, plazo, cupos libres y precio del grupo.
- `mis_grupos()`: sus inscripciones vigentes y concluidas (por
  `estudiantes.perfil_id`) y los grupos de sus solicitudes, con la misma
  forma.

### 5. Portal

- **Panel del estudiante:** «Mis cursos» y «Mi horario» (lunes a domingo,
  por hora) si tiene inscripciones vigentes; en «Mis solicitudes», el grupo
  pedido.
- **Nueva inscripción:** solo los programas con grupos en convocatoria (la
  carrera, solo primer año); si no hay, lo dice y enlaza a la oferta completa
  de la web y a WhatsApp. Al elegir uno: la ficha del programa (catálogo) y
  sus grupos abiertos, cada uno con horario, fechas, plazo, cupos y precio;
  el que se cruza con lo suyo aparece desactivado con el motivo.
- **Renovación:** igual, con los grupos de la carrera de 2.º y 3.º año; la
  gestión anterior se propone desde su inscripción en la carrera.

### 6. Panel

- **Grupo:** campos de horario y de plazo de inscripción por el portal, con
  las mismas reglas que la base (`validarCohorte`). En la lista y en la ficha,
  una etiqueta dice si el grupo recibe solicitudes por el portal
  (`convocatoriaDelGrupo`): «inscripciones hasta el …», «abre el …», «ábrelo
  para recibir solicitudes» (planificado), «sin cupos» o «cerradas».
- **Bandeja de solicitudes:** muestra el grupo pedido («Grupo elegido en el
  portal»); al aprobar, ese grupo va primero y marcado («El grupo que
  eligió»), y recepción puede elegir otro si hace falta.
- Las solicitudes viejas (sin grupo) se atienden como antes.

## Casos negativos (batería N113 en adelante)

Pedir sin grupo · grupo de otro programa · plazo sin abrir o ya cerrado ·
grupo planificado o cerrado · sin cupos · ya inscrito en él · horario que se
cruza con un curso vigente · horario que se cruza con otra solicitud abierta ·
renovación en un curso de capacitación · plazo sin horario (la base lo
rechaza) · la estudiante solo ve grupos en convocatoria y solo sus propios
cursos · anon no lee nada.

## Consecuencias

- Las pruebas del portal que validaban turno, días, duración y modalidad
  elegidos por el estudiante se reescriben: ahora los fija el grupo.
- `pruebas-rls-entrega2.sql` crea un grupo en convocatoria para sus
  solicitudes; `datos-demo.sql` carga su historial en modo mantenimiento.
- Los datos de demostración ganan horarios y plazos
  (`supabase/seed/convocatorias-demo.sql`).

## Supuestos que el usuario puede revertir

1. El plazo rige solo el portal; en persona se inscribe sin plazo.
2. Un grupo lleno no se ofrece; las solicitudes pendientes no reservan cupo
   (recepción ve los cupos al aprobar).
3. El cruce bloquea solo cuando es seguro; si falta el horario, se avisa.
4. La carrera por el portal: primer año en «Nueva inscripción», 2.º y 3.º en
   «Renovar».
5. El catálogo completo sigue en la web pública; el portal muestra solo lo
   que tiene inscripciones abiertas.
