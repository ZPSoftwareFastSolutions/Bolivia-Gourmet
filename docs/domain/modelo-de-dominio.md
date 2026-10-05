# Modelo de dominio

> Entidades, relaciones y reglas del sistema interno y de la página pública,
> **tal como las implementan hoy** `apps/web/src/core/domain` y las
> migraciones `supabase/migrations/20261002*.sql`. Deriva de
> `docs/analisis/analisis-informacion-instituto.md` y, para el panel interno,
> de `docs/sistema-interno/especificacion-v1.md` corregida por
> `docs/sistema-interno/enmiendas-v1.md` (**las enmiendas mandan**; la crítica
> solo explica). Las decisiones de arquitectura del panel están en los ADR
> 0007 (libro valorizado: PEPS, promedio y conteo) y 0008 (permisos, sedes,
> RPC, caja y contabilidad). Cada regla lleva su estado: **definida** (el
> documento del instituto la sostiene), **decidida** (la fijó el equipo: ADR,
> decisión `D` de la especificación o enmienda `B`), **pendiente** (la debe
> confirmar el cliente) o **v1.1** (diferida por las enmiendas A.2: hoy no
> existe). Fecha: 2026-10-02 (primera versión: 2026-09-30).

Convención: los nombres de dominio van en **español** (`Articulo`,
`Movimiento`, `Inscripcion`), como en los módulos operativos de los proyectos
anteriores del equipo. Las carpetas de capa se mantienen en inglés
(`core/domain`, `application`, `infrastructure`, `presentation`).

**Cómo se reparte una regla.** El dominio (TypeScript puro, sin I/O) escribe
la regla y hace las cuentas; la base **repite** la regla en su motor (`app.*`,
`security definer`, con la fila bloqueada) y es la que decide. No todo el
dominio se ejecuta en la aplicación:

- Los casos de uso (`core/application/panel/*`) llaman, antes de ir a la
  base, a los validadores de lo que llega de un formulario: `validarArticulo`,
  `validarVariantes`, `validarEstudiante` (vía `validarFicha`), `validarCohorte`
  (vía `validarGrupo`), `validarPlanDePago`, `validarCambioDeEstado` y
  `validarCobro`, además de los del portal.
- `validarMovimiento`, `validarLineaDeConteo`, `validarEntrega`,
  `validarPrestamo`, `validarCargo`, `validarAnulacion`,
  `validarAnulacionDeCargo`, `validarInscripcion` y `validarRenovacion` no los
  llama ninguna pantalla: documentan con pruebas la regla que la base hace
  cumplir (cada tabla de reglas nombra su guarda en la base).
- Varias piezas tienen una **gemela en SQL** que se prueba con los mismos
  números; de ellas, la aplicación solo usa `formatearRecibo` y
  `resultadoDelMes`/`flujoDelMes`; las demás existen para las pruebas:
`nombreDeGrupo` ↔ `app.nombre_de_grupo`, `generarCuotas` ↔
`app.generar_cuotas`, `salidaPeps`/`salidaPromedio` ↔ `app.sacar`,
`valorDeDevolucion` ↔ `app.devolver_uniforme`, `totalesDeCaja` ↔
`app.caja_por_cerrar`/`app.cerrar_caja`, `formatearRecibo` ↔
`app.numero_de_recibo`, `resultadoDelMes`/`flujoDelMes` ↔
`public.resumen_del_mes`.

**Cómo leer las tablas de reglas.** «Dominio» da el archivo (relativo a
`apps/web/src/core/domain/`) y la función, y después del punto medio su
gemela o su guarda en la base. «Prueba» da el archivo de `apps/web/tests/` y
el comienzo del título de la prueba, y el caso de la batería
`docs/runbooks/pruebas-rls-panel-v1.sql` (`N51`). Una regla que solo vive en
la base dice «base:».

---

## 1. Mapa de módulos

```text
academico      Programa · Cohorte («grupo») · PlanDePago · Cuota · Sesion (fase posterior)
estudiantes    Estudiante (la ficha) · Inscripcion (con sus requisitos entregados)
portal         Solicitud (inscripción o renovación pedida desde la web)
inventario     Articulo · Variante · Movimiento · Lote · Entrega · Prestamo · Conteo · Compra*
caja           Cargo · Cobro y su aplicación · Recibo · Arqueo
contabilidad   Gasto* · Resumen del mes · Dinero del mes · Cuadre · Tarjeta PEPS · Tablero
identidad      Perfil · Rol · Permiso · Sede · ContextoDePanel · Credenciales
contenido      (página pública) Institucion · Convenio · Beneficio · Contacto
shared         Centavos · Milesimas · FechaISO · Pendiente/Definido · calendario · dinero
```

`*` Solo en la base (tabla y motor) y en el caso de uso: no tiene tipo propio
en el dominio.

`contenido` es estático y versionado (archivo TypeScript validado en el
build), como en los proyectos anteriores. La oferta académica (`Programa`)
también: vive en `infrastructure/catalogo/oferta-academica.ts`, validada en el
build; la tabla `programas` de la base solo es la referencia de las claves
foráneas. Los demás módulos viven en la base de datos.

### Reglas que valen para todo el panel

| Regla | Dónde |
|---|---|
| **Una operación, una vez**: cada formulario manda una clave; si llega dos veces (doble clic, red lenta, recargar), la base devuelve lo que guardó la primera. Otra persona no puede reutilizar esa clave | base `operaciones`, `app.iniciar_operacion`, `app.terminar_operacion` · batería N06, N07, N16, N34 |
| **Quién lo hizo** sale de la sesión (`auth.uid()`), nunca del formulario | todas las tablas del panel (`registrado_por`) |
| **Fecha de negocio** = la de La Paz (`app.hoy()`); inventario, cobros e inscripciones siempre con la fecha de hoy (D10). Solo la semilla de demostración, desde el editor SQL, puede simular otra fecha | base `app.hoy`, `app.en_mantenimiento` · N09, N10 |
| **Errores por código**: el motor lanza el código (`stock_insuficiente`) con los datos en `detail`; la pantalla lo traduce a una frase | `infrastructure/supabase/errores-del-panel.ts` · `errores-de-panel.test.ts` › «todo código que lanzan las migraciones tiene su frase» |

---

## 2. Académico

### `Programa`
La oferta, tal como se publica. No cambia por apertura.

| Campo | Tipo | Notas |
|---|---|---|
| `codigo` | slug | `gastronomia`, `cocina`, `cocteleria`, `reposteria-y-panaderia`, `tortas`, `cursos-de-temporada` |
| `tipo` | `carrera` · `curso` · `curso_de_temporada` | Enum abierto a nuevos tipos |
| `nombre`, `descripcion` | texto | |
| `tituloOtorgado` | texto opcional | Solo carrera |
| `duracion` | `Definido<{ unidad: 'anios' \| 'meses', opciones: number[] }>` | Carrera `{anios,[3]}`; Cocina `{meses,[1,2,3]}`; temporada: pendiente |
| `diasDeClase` | lista de `{ codigo, etiqueta }` | `lun-vie`, `jue-vie`, `lun-mie`, `sab`; vacía = no definidos (temporada) |
| `turnos` | lista de `Turno` | `manana`, `tarde`, `noche`, `especial`, `unico`; vacía = no distingue turnos |
| `horaPorTurno` | opcional | Solo turnos que el programa ofrece |
| `modalidades` | lista | Solo temporada: `practico`, `magistral`, `virtual` |
| `planDeEstudios` / `modulos` / `contenido` | estructura por tipo | Carrera: años → materias. Cursos: módulos y bloques → temas |
| `beneficios`, `requisitos`, `notas` | listas | «Matrícula gratis», «100 % práctico»; requisitos = documentos a entregar |
| `costo` | `Pendiente` o lista de `PrecioPublicado` (`etiqueta`, `monto`, `periodicidad?`) | Gastronomía: **Paquete Económico Bs 650** y Paquete Ahorrador pendiente (aclaración del 2026-10-01). Cursos: pendiente |
| `uniforme` | `Pendiente` o `PrecioPublicado` | Gastronomía: **Bs 650**. Cursos: pendiente |
| `inicioPublicado` | `Definido<string>` | «Febrero 2027» hasta que existan grupos |
| `activo` | boolean | Para retirar ofertas sin borrarlas |

El **precio publicado** es lo que dice la web; **lo que cobra el panel** vive
en el plan de pagos de cada grupo (D3). La periodicidad de los Bs 650 no está
confirmada: la web no la muestra y el panel la lleva como dato del plan, con
su nota, nunca como regla del código (D4).

### `Cohorte` (en pantalla, «grupo»)
Una apertura concreta de un programa. Es a lo que se inscribe un estudiante.

| Campo | Notas |
|---|---|
| `programaCodigo`, `sedeId` | FK. Con inscripciones, no cambian (base: `grupo_con_inscripciones`) |
| `gestion` | Año (2020–2100) |
| `anioDeCarrera` | 1 a la duración de la carrera; obligatorio en la carrera, vacío en los cursos |
| `fechaInicio`, `fechaFin` | Fin no anterior al inicio; **obligatorio si el programa no define duración** (temporada) |
| `duracionElegida` | Una de `programa.duracion.opciones`; vacía si el programa no la define |
| `turno`, `diasDeClase` (código), `modalidad` | Obligatorios si el programa los ofrece; vacíos si no |
| `capacidad` | Opcional; sin capacidad = sin límite. La base no la deja bajar de los inscritos |
| `estado` | `planificado` · `abierto` · `en_curso` · `cerrado` (en masculino, B.12-30) |

`nombre` y `costoVigente` **ya no existen** (B.12-30): el nombre se arma y el
precio vive en el plan de pagos.

| Estado | Admite inscripciones | Cómo se llega |
|---|---|---|
| `planificado` | no | Al crearlo (por defecto) |
| `abierto` | sí | Edición directa de administración |
| `en_curso` | sí | Edición directa de administración |
| `cerrado` | no, y ya no cambia | Solo con `cerrar_grupo`, que concluye a sus inscritos (B.3) |

**Nombre visible.** No se guarda: lo arman `nombreDeGrupo()` y su gemela
`app.nombre_de_grupo()` con las mismas reglas. Carrera: programa · año ·
turno · gestión · sede («Gastronomía · 1.er año · Noche · 2026 · La Paz»).
Cursos: programa · días · turno · modalidad · mes de inicio · sede, solo con
las partes que el grupo tiene («Tortas · Sábados · oct 2026 · La Paz»). Los
días se rotulan desde su **código** (`sab` → «Sábados», `jue-vie` →
«Jue–Vie»), porque la base solo ve el código.

### `PlanDePago` y `Cuota`
Cuánto y cuándo se cobra en un grupo (D3). Lo carga administración; sin plan,
el grupo no tiene precio («Consultar») y se inscribe sin cuotas (la base lo
avisa con `sin_plan`).

| Campo | Notas |
|---|---|
| `paquete` | `economico` · `ahorrador`. Obligatorio en la carrera (un plan por paquete); prohibido en los cursos (un solo plan) |
| `montoCuota` | Centavos, > 0 |
| `cuotas` | 1 a 24 |
| `primerVencimiento` | Fecha |
| `cadaMeses` | 1 a 12 |
| `nota` | Hasta 200 caracteres («Periodicidad por confirmar») |
| (base) `concepto_id` | De ingreso; por defecto `colegiatura-carrera` o `curso-capacitacion` según el tipo de programa |

**Cuota** `k`: vence el `primerVencimiento + (k − 1) × cadaMeses` meses,
calculado **desde el primer vencimiento, sin encadenar**, y recortado al fin
de mes como PostgreSQL (31/01 + 1 mes = 28/02; 31/01 + 2 meses = 31/03). Su
`fecha` (mes en que cuenta como ingreso) es el vencimiento. Con `desde`
(puesta en marcha, B.7) no se generan las que vencen antes de esa fecha y se
conserva su número. La base crea un cargo por cuota («Cuota 2 de 3 · Paquete
Económico · <grupo>»); `generar_cuotas_de_grupo` crea las de quien no tiene
ninguna (el plan llegó después de la inscripción) y no repone las que se
anularon a propósito; si todas se anularon y el plan cambió, las vuelve a
crear desde el primer vencimiento anulado (ADR 0008 §8, con su límite: un
cambio de precio trae de vuelta las becas del grupo). `describirPlan`: «1 cuota de
Bs 650», «3 cuotas de Bs 100 cada mes».

### `Sesion` (fase posterior, ver P10)
Una clase de un grupo en una fecha. **No se implementa hasta definir P2 y
P10**; el contexto «sesión» de la entrega de uniformes se retiró (regla I6).

### Reglas

| # | Regla | Estado | Dominio | Prueba |
|---|---|---|---|---|
| A1 | Un grupo solo elige duración, turno, días y modalidad entre las opciones de su programa; lo que el programa ofrece es obligatorio y lo que no ofrece va vacío | decidida | `academico/programa.ts` `validarCohorte` (la base no conoce las opciones: las valida el caso de uso antes de escribir) | `academico.test.ts` › «regla A1: un grupo válido…», «una duración fuera de las opciones…», «el turno es obligatorio…», «los días de clase deben ser…», «el grupo se valida contra SU programa»; `panel-alumnos.test.ts` › «abrir un grupo valida contra las opciones…»; N11 |
| A2 | El precio se **congela con el primer cargo**: con un cargo vigente, el plan no cambia monto, cuotas, fechas ni paquete, ni se borra | decidida (ADR 0008 §8, B.12-30; antes «al abrir la cohorte») | base: `app.congelar_plan` (`plan_congelado`) | N31 |
| A3 | Un programa inactivo no admite grupos nuevos; los que ya tiene siguen | decidida | `validarCohorte` · base `app.validar_grupo` (`programa_inactivo`) | `academico.test.ts` › «un programa inactivo no admite grupos nuevos» |
| A4 | La carrera tiene plan de estudios por año; los cursos, bloques de contenido; el tipo decide la estructura | definida | `validarPrograma` + catálogo `oferta-academica.ts` | `academico.test.ts` › «la carrera dura 3 años, con 22 materias…», «el catálogo transcrito es válido» |
| A5 | Los cursos llevan «matrícula gratis» como beneficio | definida | catálogo `oferta-academica.ts` | `academico.test.ts` › «los cursos llevan matrícula gratis…» |
| A6 | Un curso de temporada abre grupos con modalidad y fechas de inicio y fin, sin días ni duración | decidida (B.4) | `validarCohorte` | `academico.test.ts` › «B.4: un curso de temporada abre grupos…» |
| A7 | Solo `abierto` y `en_curso` admiten inscripciones; un grupo `cerrado` ya no cambia y solo se cierra con `cerrar_grupo` | decidida (B.2, B.3) | `admiteInscripciones` · base `app.validar_grupo` (`usa_cerrar_grupo`, `grupo_cerrado`) | `academico.test.ts` › «B.2: solo «abierto» y «en curso» admiten inscripciones»; N24 |
| A8 | El año de carrera es obligatorio en la carrera y está dentro de su duración; los cursos no lo llevan | decidida | `validarCohorte` · base `app.validar_grupo` (`anio_de_carrera_invalido`) | `academico.test.ts` › «solo los grupos de carrera llevan año…»; N12 |
| A9 | La capacidad es opcional (sin ella, sin límite) y no baja de los inscritos | decidida | `validarCohorte` · base `capacidad_menor_que_inscritos` | `academico.test.ts` › «la capacidad, si se indica, es un entero positivo»; N18b |
| A10 | El nombre del grupo no se guarda; el dominio y la base lo arman igual | decidida (B.13-36) | `nombreDeGrupo`, `etiquetaCortaDeDias` · base `app.nombre_de_grupo`, `app.etiqueta_de_dias` | `academico.test.ts` › «nombreDeGrupo de la carrera…», «nombreDeGrupo de los cursos…», «los días se rotulan desde su código…»; `panel-alumnos.test.ts` › «el nombre del grupo del dominio coincide con app.nombre_de_grupo…»; N15, N29 |
| A11 | Plan por paquete en la carrera y sin paquete en los cursos; 1 a 24 cuotas, cada 1 a 12 meses; concepto de ingreso | decidida (D3) | `validarPlanDePago` · base `app.validar_plan_de_pago`, índices únicos por grupo y paquete | `academico.test.ts` › «el plan de la carrera es por paquete…», «el plan valida monto, cuotas (1 a 24)…»; `panel-alumnos.test.ts` › «el precio de un grupo de la carrera es por paquete…»; N13 |
| A12 | Una cuota por número, desde el primer vencimiento sin encadenar y con el recorte de fin de mes de PostgreSQL; cuenta como ingreso en el mes en que vence | decidida | `generarCuotas`, `shared/calendario.ts` `sumarMeses` · base `app.generar_cuotas` | `academico.test.ts` › «generarCuotas: una por cuota…», «generarCuotas suma meses como PostgreSQL…»; N30, N43 |
| A13 | Puesta en marcha: con «desde» no se generan las cuotas que vencen antes (alumnos que ya pagaban antes del sistema) | decidida (B.7) | `generarCuotas(…, desde)` · base `inscribir(…, p_desde)` | `academico.test.ts` › «B.7: con «desde» no se generan…» |
| A14 | Una cuota de un mes ya cerrado cuenta como ingreso del mes en curso | **v1.1** (sin cierre de mes) | `generarCuotas` conserva `fechaDeInscripcion` en la firma, sin usarla | — |

---

## 3. Estudiantes

### `Estudiante` (la ficha)
La persona, tenga o no cuenta del portal. No lleva «tipo», «turno» ni
«gestión»: eso lo dice su inscripción (ADR 0004).

| Campo | Notas |
|---|---|
| `nombres`, `apellidos` | Obligatorios; sin espacios sobrantes (1 a 80 en la base) |
| `documento` (CI) | Opcional; letras, números y guiones (4 a 20); en mayúsculas; **único entre las fichas no archivadas** |
| `telefono` | Celular boliviano de 8 dígitos que empieza por 6 o 7; opcional |
| `correo` | Opcional, en minúsculas |
| `fechaDeNacimiento` | Opcional (los cursos son «sin límite de edad») |
| `sedeHabitualId` | Opcional en el dominio; obligatoria en la base (`sede_id`) |
| `archivadoEn` | Nunca se borra; se archiva (regla E3) |
| (base) `codigo` | `BG-2026-0007`: correlativo por año, con candado consultivo (B.13-42) |
| (base) `perfil_id` | La cuenta del portal, si la tiene (única) |
| (base) `observaciones`, `nombre_busqueda` | Hasta 500 caracteres; búsqueda sin tildes y en minúsculas (B.15) |

### `Inscripcion`
| Campo | Notas |
|---|---|
| `estudianteId`, `cohorteId` | Una sola inscripción `inscrito` por par (regla E1) |
| `fecha` | La de hoy (la pone la base) |
| `estado` | `inscrito` · `retirado` · `concluido` (D6). «En curso» no es un estado: se deduce del grupo |
| `paquete` | `economico` · `ahorrador`: obligatorio en la carrera, prohibido en los cursos (E5; qué incluye cada uno: P6) |
| `documentosEntregados` | Requisitos entregados, como texto: sin vacíos ni repetidos, hasta 20 (E4) |
| `solicitudId` | La solicitud del portal de la que nació (única; si se borra la cuenta, queda nula) |
| `renuevaA` | La inscripción del año anterior que esta renueva (única: no se renueva dos veces) |
| `motivoDeRetiro` | Obligatorio si está `retirado` |
| `observaciones` | Hasta 500 caracteres |

Transiciones: `inscrito → retirado` (con motivo) o `inscrito → concluido`;
lo retirado o concluido ya no cambia. Al cerrar un grupo, sus inscritos pasan
a `concluido`. Al retirar, se anulan solas las cuotas que todavía no vencen
y no tienen cobros (regla E9).

### De la solicitud del portal a la inscripción
**Aprobar = inscribir** (B.9), en una sola transacción (`aprobar_solicitud`):
la solicitud debe estar pendiente o en revisión y el grupo ser del mismo
programa. La ficha es la del perfil si ya existe; si no, **el personal
elige** entre una ficha nueva (con los datos del perfil) o una ficha existente
**sin cuenta**: la base nunca enlaza sola por el carnet (B.8). En una
renovación se enlaza con la última inscripción no retirada y no renovada del
mismo programa, si el alumno tiene historia en el sistema. «Rechazar» y
«Pedir más datos» exigen una respuesta que verá el alumno (caso de uso). La
solicitud en sí está en `portal/solicitud.ts` (opciones exactas del programa,
renovación con gestión anterior, sin duplicados, máximo 5 abiertas).

### Reglas

| # | Regla | Estado | Dominio | Prueba |
|---|---|---|---|---|
| E1 | Un estudiante no se inscribe dos veces en el mismo grupo mientras esté `inscrito` | decidida | `estudiantes/estudiante.ts` `validarInscripcion`, `ESTADOS_VIGENTES` · base índice `inscripciones_vigente_unica`, `ya_inscrito` | `estudiantes.test.ts` › «regla E1…», «D6: solo «inscrito» es vigente…»; N17 |
| E2 | Puede tener inscripciones simultáneas en grupos distintos | definida (carrera + curso) | `validarInscripcion` | `estudiantes.test.ts` › «regla E2…» |
| E3 | Los estudiantes no se borran: se archivan, con motivo, sin inscripción vigente y solo por administración | decidida | `Estudiante.archivadoEn` · base `app.preparar_estudiante` (`alumno_con_inscripcion`, `motivo_requerido`, permiso `estudiantes.archivar`) | `panel-alumnos.test.ts` › «archivar exige motivo…»; N22, N23 |
| E4 | La inscripción anota qué requisitos se entregaron; no bloquea por los que faltan | decidida, revisable | `Inscripcion.documentosEntregados` · caso de uso `limpiarRequisitos` · base (hasta 20, de hasta 80 caracteres) | `panel-alumnos.test.ts` › «limpiarRequisitos quita vacíos y repetidos…», «inscribir: persona nueva válida…»; N15 |
| E5 | El paquete solo aplica a la carrera, y ahí es obligatorio | definida | `validarInscripcion` · base `app.validar_inscripcion` y el motor (`paquete_requerido`, `paquete_no_admitido`) | `estudiantes.test.ts` › «regla E5…»; `panel-alumnos.test.ts` › «aprobar e inscribir pide el paquete…»; N17 |
| E6 | Estados `inscrito`, `retirado`, `concluido`; una inscripción nueva empieza `inscrito` | decidida (D6) | `EstadoDeInscripcion`, `validarInscripcion` | `estudiantes.test.ts` › «una inscripción nueva empieza «inscrito»…» |
| E7 | Solo se inscribe en un grupo abierto o en curso y con cupo (el motor bloquea el grupo antes de contar) | decidida (B.2) | `validarInscripcion(…, grupo)` · base `app.inscribir_en_grupo` (`grupo_no_disponible`, `grupo_lleno`) | `estudiantes.test.ts` › «B.2: solo un grupo abierto o en curso, y con cupo…»; N18 |
| E8 | El estado solo cambia desde `inscrito`: a `retirado` con motivo o a `concluido` | decidida | `validarCambioDeEstado` · base `app.cambiar_estado_de_inscripcion` (`transicion_no_valida`, `motivo_requerido`) | `estudiantes.test.ts` › «cambio de estado…»; `panel-alumnos.test.ts` › «retirar pide motivo; concluir no»; N21 |
| E9 | Al retirar se anulan las cuotas del plan sin cobros que vencen después de hoy; las vencidas se siguen debiendo | decidida (B.12-15) | `caja/cargo.ts` `cuotasQueSeAnulanAlRetirar` · base `app.al_retirar` | `caja.test.ts` › «B.12 (crítica 15): al retirar…»; N44 |
| E10 | Renovar solo enlaza (`renuevaA`): la inscripción anterior sigue `inscrito` hasta que se cierre su grupo | decidida (B.3) | `validarRenovacion` · base `app.inscribir_en_grupo` (`renovacion_no_corresponde`); el dominio y la base no piden lo mismo (§9) | `estudiantes.test.ts` › «renovación: mismo programa, gestión posterior…»; N20 |
| E11 | Cerrar un grupo concluye a sus inscritos y avisa cuántos deben (no bloquea) | decidida (B.3) | base: `app.cerrar_grupo` + `app.alumnos_que_deben` | N24 |
| E12 | Aprobar una solicitud es inscribir; la ficha se enlaza a la cuenta solo si el personal la elige | decidida (B.8, B.9) | base `app.aprobar_solicitud` (`solicitud_cerrada`, `grupo_no_corresponde`, `ficha_con_cuenta`) · caso de uso `responderSolicitud` | `panel-alumnos.test.ts` › «rechazar o pedir datos exige una respuesta…»; N25, N26 |
| E13 | Código de alumno `BG-AAAA-NNNN`, correlativo por año y sin duplicados en altas simultáneas | decidida (B.13-42) | base: `app.siguiente_codigo_de_estudiante` | N15 |

---

## 4. Inventario

En simple: **las cantidades las ve todo el personal; lo que costaron, solo
administración** (tablas `*_costo`, `movimiento_lotes`, `compras` y
`conteos`; D2).

### `Articulo`
Producto o bien que el instituto controla.

| Campo | Notas |
|---|---|
| `codigo` | `INS-0001`, `UNI-0001`, `UTE-0001`, `OTR-0001`: lo pone la base, por tipo y con candado |
| `nombre` | 1 a 80; único entre los activos (sin distinguir mayúsculas) |
| `tipo` | `insumo` · `uniforme` · `utensilio` · `otro` — **decide el comportamiento**; no cambia si ya hay movimientos (`tipo_bloqueado`) |
| (base) `valuacion` | Derivada del tipo: `peps` en insumos, `promedio` en el resto |
| `categoria` | Texto libre con sugerencias, hasta 40 (D23); no cambia nada |
| `icono` | Lista cerrada: `trigo`, `huevo`, `lacteo`, `torta`, `copa`, `plato`, `chaqueta`, `gorro`, `cubiertos`, `bol`, `batidor`, `almacen`, `paquete` |
| `unidad` | `unidad` · `kg` · `g` · `l` · `ml` · `paquete`; `kg`, `g`, `l` y `ml` solo en insumo y otro; no cambia si ya hay movimientos |
| `controlaVencimiento` | Solo insumos: cada lote lleva fecha de vencimiento |
| `stockMinimo` | Milésimas, ≥ 0, vale para cada sede; entero si el artículo no admite decimales (regla I9) |
| `precioVenta` | Solo uniformes; sin precio no se puede cobrar (`precio_no_definido`) |
| `activo` | Un inactivo no admite compras, usos, saldos iniciales, entregas ni préstamos (regla I22) |

### `Variante`
Todo artículo tiene al menos una variante («Única»). Los uniformes tienen una
por talla; **un insumo tiene exactamente una**.

| Campo | Notas |
|---|---|
| `articuloId` | No cambia |
| `etiqueta` | «Única», «S», «M», «L», «XL»: 1 a 20, única por artículo (sin distinguir mayúsculas) |
| `orden`, `activa` | |

La existencia vive en la base, por variante y sede: `existencias`
(`disponible` en el estante, `prestado` fuera, `total`) y su valor en
`existencias_costo` (solo administración). La vista `v_existencias` marca
`agotado` o `bajo` comparando lo **usable** (disponible menos lo vencido) con
el stock mínimo.

### Comportamiento por tipo (regla I1)

| Tipo | Valuación | Se usa en clase | Se entrega | Se presta | Vencimiento por lote | Precio de venta | Tallas | Decimales |
|---|---|---|---|---|---|---|---|---|
| `uniforme` | promedio | no | sí (y se cobra) | no | no | sí | sí | no |
| `utensilio` | promedio | no | **no: se presta** | sí | no | no | no | no |
| `insumo` | **PEPS** | sí | no | no | sí | no | no | sí, si la unidad es kg, g, l o ml |
| `otro` | promedio | sí | no | no | no | no | no | sí, si la unidad es kg, g, l o ml |

Cambio respecto de la versión del 2026-09-30: el utensilio ya no se entrega
ni se devuelve como una entrega; se presta (custodia) y vuelve.

### Cantidades en milésimas (`shared/cantidad.ts`)
Una cantidad es un `bigint` de **milésimas** de su unidad (2,5 kg = `2500n`;
3 chaquetas = `3000n`), lo mismo que guarda la base (`numeric(12,3)`).
`parsearCantidad` lee «2,5» o «2.5» con hasta 3 decimales, sin separador de
miles y sin redondear en silencio; `formatearCantidad` muestra «12,5 kg»,
«1.250 unidades». Toda proporción de costo se calcula con enteros:
`redondearProporcion(v, t, c) = (2·v·t + c) / (2·c)`, la mitad hacia arriba,
igual que `round(v * t / c)` sobre `numeric` en PostgreSQL. Con coma flotante,
`3 × 0,350 / 2,100` daba 0; así da 1 (B.6). Hacia la base viajan como texto
con punto (`infrastructure/supabase/cantidades.ts`).

### `Movimiento` (el libro o kárdex)
**Inmutable**: nunca se edita ni se borra; un error se corrige con una
anulación (el asiento inverso exacto) o con un conteo.

| Campo | Notas |
|---|---|
| `operacionId` | Agrupa las líneas de un mismo documento: un uso en clase son los movimientos de su operación (D22) |
| `varianteId`, `sedeId` | |
| `tipo` | Tabla siguiente |
| `fecha` | Siempre la de hoy (D10) |
| `cantidad` | Siempre positiva; el signo lo dan los deltas. Entera en uniformes y utensilios |
| (base) `delta_disponible`, `delta_prestado`, saldos resultantes | Saldos ≥ 0: la columna «Queda» del kárdex |
| `destino` | Solo `consumo`: `clase`, `practica`, `evento`, `degustacion`, `uso_interno`, `otro` (este exige detalle) |
| `cohorteId` | Solo `consumo`: el grupo de la clase (de la misma sede) |
| `detalle` | Hasta 300: tema de la clase, motivo de la baja o del ajuste |
| `motivoBaja` | Solo y siempre en `baja`: `vencimiento`, `dano`, `rotura`, `perdida`, `merma`, `otro` |
| `desdePrestado` | Baja de algo que estaba prestado (se perdió o se rompió en un préstamo) |
| `compraId`, `entregaId`, `prestamoId`, `conteoId` | El documento que exige cada tipo |
| `loteId` | Lote creado (entrada PEPS) o elegido |
| `anulaA` | El movimiento que esta anulación deshace (único: no se anula dos veces) |

| `tipo` | Rótulo | Δ disponible | Δ prestado | Valor | Artículos | Documento |
|---|---|---|---|---|---|---|
| `saldo_inicial` | Saldo inicial | + | 0 | El declarado | Todos | Conteo de clase `saldo_inicial` |
| `compra` | Compra | + | 0 | Lo pagado por la línea | Todos | Compra |
| `consumo` | Usado en clase | − | 0 | PEPS o promedio | Insumo, otro | Su operación |
| `entrega` | Entrega de uniforme | − | 0 | Promedio | Uniforme | Entrega |
| `devolucion_entrega` | Devolución de uniforme | + | 0 | Al costo con que salió | Uniforme | Entrega |
| `prestamo` | Préstamo | − | + | **Sin cambio** | Utensilio | Préstamo |
| `devolucion_prestamo` | Devolución de préstamo | + | − | Sin cambio | Utensilio | Préstamo |
| `baja` | Baja | − (0 si estaba prestado) | 0 (− si estaba prestado) | PEPS o promedio | Todos | Préstamo, si salió de lo prestado |
| `ajuste_faltante` | Faltante por conteo | − | 0 | PEPS (lo vencido primero) o promedio | Todos | Conteo |
| `ajuste_sobrante` | Sobrante por conteo | + | 0 | Ver «Sobrante» | Todos | Conteo |
| `anulacion` | Anulación | Inverso | Inverso | Inverso exacto (mismos lotes, mismo valor) | Saldo inicial, compra, uso, baja | `anulaA` |

### `Lote` (solo insumos, PEPS)
Lo que llegó en una compra, un saldo inicial o un sobrante; en pantalla, «la
compra del 12/09».

| Campo | Notas |
|---|---|
| `fechaIngreso`, `secuencia` | Orden PEPS: fecha de ingreso (hoy) y, a igual fecha, orden de escritura |
| `venceEl` | Obligatorio si el artículo controla vencimiento; en una compra no puede ser una fecha pasada (`vencimiento_pasado`) |
| `cantidadInicial`, `cantidadRestante` | Solo cambia lo restante (`app.proteger_lote`) |
| `valorInicial`, `valorRestante` | Centavos: el total de la línea, no un unitario redondeado (solo administración) |

Vencido = `venceEl < hoy`: un lote que vence hoy todavía se usa. Por vencer =
vence en 7 días o menos (vista `v_lotes_vigentes`). La tabla
`movimiento_lotes` dice qué tomó cada movimiento de cada lote («¿de qué compra
salió esta harina?»); con ella una anulación devuelve exactamente a los
mismos lotes.

### Valuación: dos métodos, un solo motor (`inventario/valuacion.ts`)
Los dos métodos comparten la **fórmula proporcional con remanente exacto**:
una salida parcial vale `round(valor_que_queda × lo_que_sale /
cantidad_que_queda)` y **la salida que agota el lote o la capa se lleva el
valor que quede**, al centavo. Así la suma de las salidas es siempre lo que
se pagó. PEPS y promedio son los dos métodos de la NIC 2; **el contador del
instituto debe validar la elección**.

**PEPS (insumos).** `salidaPeps(lotes, cantidad, hoy, opciones)` recorre los
lotes con existencia en orden PEPS y toma de cada uno lo que haga falta. Si no
alcanza, no toca nada y devuelve `stock_insuficiente` con lo usable, lo pedido
y lo vencido. El orden depende de la operación:

| Operación | Lotes que mira | Base |
|---|---|---|
| Uso en clase | Solo los vigentes: lo vencido no se usa (D14); el error dice cuánto hay vencido | `app.sacar(…, p_incluir_vencidos = false)` |
| Faltante de conteo y bajas que no son por vencimiento | **Primero lo vencido**, después el orden PEPS (B.5) | `app.sacar(…, true)` |
| Baja por vencimiento | Solo el lote indicado, que debe estar vencido | `app.dar_de_baja` |
| Uso con lote elegido por línea | Solo ese lote (cuando uno nuevo vence antes que uno antiguo; por defecto, PEPS) (B.12-16) | `usar_insumos` (`lote` por línea) |

Ejemplo de prueba (harina, §5.8-1): compra A de 25 kg por Bs 170 y compra B
de 25 kg por Bs 180. Usar 30 kg agota A (17 000 c) y toma 5 kg de B
(`round(18 000 × 5 / 25)` = 3 600 c): 20 600 c. Después 0,333 kg cuestan
240 c y los 19,667 kg restantes se llevan 14 160 c. Suma: 35 000 c, lo
pagado. Fracciones (§5.8-2): 3 kg por Bs 10 usados de a 1 kg → 333 + 334 +
333 c.

**Costo promedio ponderado (uniformes, utensilios y otros).** Una sola capa
por variante y sede: `salidaPromedio` vale `round(valor × q / total)`, con
`total = disponible + prestado` (lo prestado sigue siendo del instituto y
sigue valiendo); la salida que agota la capa se lleva el resto. El costo por
unidad (`costoPromedio`) solo se **muestra**. Ejemplo (§5.8-4): 10 juegos M
por Bs 3.000 y 10 por Bs 3.400 → cada uno sale a Bs 320; 3 juegos por
Bs 100 entregados de a uno → 3 333 + 3 334 + 3 333 c.

**Devolución de un uniforme.** Vuelve **a lo que valía al salir**, no al
promedio de hoy: `valorDeDevolucion` = `round(valor_entrega × q /
cantidad_entrega)`, con tope en lo que le queda a la entrega, y la última
pieza devuelta se lleva el resto exacto. Entrega y devolución se anulan al
centavo.

**Sobrante de conteo** (D16, crítica 24). Insumo: lote nuevo al costo por
unidad del **último lote ingresado**, aunque esté agotado
(`round(valor_inicial × q / cantidad_inicial)`); sin ningún lote, al costo que
escribe administración. Promedio: con existencia, al promedio vigente; sin
existencia, al costo de la última compra o saldo inicial no anulado; si nunca
hubo, al que escribe administración. Sin costo posible: `costo_requerido`. Si
el insumo controla vencimiento, se pide la fecha.

### Conteo físico y saldo inicial
**Conteo** (D15): `conteo(existenciaVista, contado)` compara lo que mostraba
la pantalla con lo contado: falta → `ajuste_faltante`; sobra →
`ajuste_sobrante`; igual → **constancia** (sin movimiento; la línea queda en
el documento). Cada diferencia exige motivo y las piezas se cuentan enteras.
Si alguien movió el artículo mientras se contaba, el conteo entero se rechaza
(`existencia_cambio`) y se vuelve a contar; la base compara con `disponible`,
que incluye lo vencido (B.5). Solo administración.

**Saldo inicial** (puesta en marcha): un documento de clase `saldo_inicial`
con un movimiento por línea; solo para variantes sin movimientos en esa sede
(`ya_tiene_movimientos`); en un mismo envío una variante puede llevar varias
líneas, cada una su lote (B.12-23). No es salida de dinero.

### Compra (solo en la base)
Su propio documento (D11): fecha de hoy, fecha de la nota del proveedor
(informativa), proveedor, comprobante (`factura`, `recibo`, `nota_de_venta`,
`sin_comprobante`), medio y número de operación (obligatorio en QR y
transferencia). `total` = suma de las líneas; hasta 30 líneas; la misma
variante se repite solo con distinto vencimiento (B.12-23). Es dinero e
inventario, **nunca gasto**; en efectivo, sale de la caja en el arqueo
siguiente. Solo administración (D12).

### `Entrega` (uniformes)
Qué juego salió, hacia qué **inscripción** (no hacia el alumno suelto: así se
sabe para qué programa), cuándo, en qué sede y bajo qué contexto.

| Campo | Notas |
|---|---|
| `inscripcionId` | Debe estar `inscrito` (`inscripcion_no_vigente`) |
| `sedeId`, `varianteId` (la talla), `fecha` | |
| `cantidad` | Piezas enteras |
| `devuelta` | Solo crece, siempre con su movimiento |
| `contexto` | `inscripcion` (por defecto) · `reposicion` · `cambio_de_talla` · `otro` (exige detalle) |

Al entregar (`entregar_uniforme`): salida a costo promedio. Con «cargar», un
cargo «Venta de uniforme» de precio × cantidad, con fecha y vencimiento el
día de la entrega (B.13-33); sin precio, `precio_no_definido`. Con «cobrar»
(que exige cargar), el cobro paga ese cargo en el acto y emite su recibo.
Una entrega **no se anula: se devuelve**. El **cambio de talla** es una
devolución más una entrega nueva de otra talla del mismo uniforme
(`cambio_de_talla`), **sin cargo**. La vista `v_sin_uniforme` lista a los
alumnos con inscripción vigente en la carrera que no tienen ningún juego en
su poder (informa; no decide, regla I7).

### `Prestamo` (utensilios)
Prestar es **custodia**: el utensilio pasa del estante a «prestado», sigue
siendo del instituto y su valor no cambia. Una fila por utensilio (D19).

| Campo | Notas |
|---|---|
| `sedeId`, `varianteId`, `fecha` | |
| `cantidad`, `devuelta`, `perdida` | Piezas enteras; `devuelta + perdida ≤ cantidad`; solo crecen |
| Destinatario | **Exactamente uno**: `estudianteId` (ficha no archivada), `cohorteId` (grupo de la misma sede) o `persona` (un docente, por nombre) |
| `devolverEl` | No anterior al préstamo; en la base, además, a lo sumo 120 días después |
| `cerradoEn` | Cuando ya no queda nada fuera |

Recibir: lo que vuelve regresa al estante (`devolucion_prestamo`); lo que no
vuelve es una **baja desde lo prestado**, a costo promedio, por pérdida o
rotura y con explicación, y cuenta como pérdida del mes. Atraso: queda algo
fuera y `devolverEl < hoy`. Cobrar la reposición al alumno es un cargo manual
aparte (concepto «Reposición de utensilio», enlazado al préstamo).

### Reglas

| # | Regla | Estado | Dominio | Prueba |
|---|---|---|---|---|
| I1 | El tipo del artículo decide valuación, operaciones, vencimiento, precio, tallas y decimales | decidida (ADR 0003 y 0007, D18) | `inventario/articulo.ts` `COMPORTAMIENTO_POR_TIPO`, `admiteCantidadFraccionaria`; `movimiento.ts` `admiteMovimiento` · base `check` de `articulos`, `app.exigir_cantidad`, `uso_no_admitido`, `entrega_no_admitida`, `prestamo_no_admitido` | `inventario.test.ts` › «cada tipo de artículo declara su comportamiento completo», «D18: los insumos van por PEPS…», «el utensilio se presta (ya no se entrega)…», «la fracción depende del tipo Y de la unidad…», «regla I1…»; N50, N58, N64 |
| I2 | Ni el estante ni lo prestado quedan negativos | decidida | `aplicarMovimiento`, `calcularSaldo` · base `check` de `existencias` y `movimientos` | `inventario.test.ts` › «regla I2…», «calcularSaldo aplica en orden de escritura…» |
| I3 | La existencia es la suma de los movimientos y solo la escribe el motor, con la fila bloqueada. **No hay ajuste que fije la existencia**: el conteo registra la diferencia | decidida (cambió: D15, ADR 0007) | `conteo`, `validarLineaDeConteo`, `existenciaCambio` · base `app.mover`, `app.registrar_conteo` (`existencia_cambio`) | `inventario.test.ts` › «D15: el conteo produce faltante, sobrante o constancia…», «la línea de conteo exige motivo si difiere…»; `panel-inventario.test.ts` › «conteo: cada diferencia pide su motivo…»; N55, N60 |
| I4 | Los movimientos son inmutables; se corrigen con una anulación que es el inverso exacto (mismos lotes, mismo valor, aunque el lote estuviera agotado) | decidida | `deltasDe` · base `app.solo_sellos`, `app.revertir` | `inventario.test.ts` › «la anulación es el inverso exacto…»; `panel-contabilidad.test.ts` › «la anulación de la primera salida devuelve exacto…»; N45, N56, N59 |
| I5 | Toda entrega genera exactamente un movimiento `entrega` que la referencia; toda devolución, uno `devolucion_entrega` | decidida | `movimientoDeEntrega`, `devolverEntrega` · base `check` `movimientos_documento` | `inventario.test.ts` › «regla I5…», «la devolución apunta a la misma entrega…», «cada tipo exige la referencia a su documento»; N63 |
| I6 | La entrega apunta a una inscripción vigente y lleva contexto (`inscripcion`, `reposicion`, `cambio_de_talla`, `otro` con detalle); ya no existe el contexto «sesión» | decidida (cambió: sin sesiones, P10) | `inventario/entrega.ts` `validarEntrega` · base `inscripcion_no_vigente`, `check` `entregas_detalle_en_otro` | `inventario.test.ts` › «la entrega es de uniformes, por piezas enteras y con contexto explícito»; N64 |
| I7 | Cuándo corresponde entregar un uniforme (al inscribirse, tras pagar…) | **pendiente (P2)**; el sistema registra y `v_sin_uniforme` informa, no decide | base: `v_sin_uniforme` | N62 |
| I8 | Los insumos comprados por los estudiantes de forma grupal **no** pasan por el inventario del instituto | definida (§4.3, §6), revisable con P3 | catálogo `oferta-academica.ts` (`NOTA_INSUMOS_CARRERA`) | — |
| I9 | Por debajo del stock mínimo (por sede, sobre lo usable) el artículo se marca `bajo`; sin nada usable, `agotado` | decidida | `Articulo.stockMinimo`, `validarArticulo` · base `v_existencias` | — (se ve en la pantalla de Inventario) |
| I10 | Insumos por PEPS, con salida proporcional y remanente exacto: la suma de las salidas es lo pagado | decidida (D18, ADR 0007) | `inventario/valuacion.ts` `salidaPeps`, `entradaPeps`, `ordenPeps` · base `app.sacar`, `app.entrar` | `valuacion.test.ts` › «§5.8-1 PEPS…», «§5.8-2 fracciones…», «varias capas…», «si no alcanza, no se toca nada», «entradaPeps crea el lote…»; N51, N52 |
| I11 | Aritmética exacta: cantidades en milésimas `bigint`, valores en centavos, la mitad hacia arriba con enteros | decidida (B.6) | `shared/cantidad.ts` `redondearProporcion`, `parsearCantidad`, `formatearCantidad` · base `round()` sobre `numeric` | `valuacion.test.ts` › «B.6: 3 × 0,350 / 2,100 redondea a 1…», «redondearProporcion: la mitad hacia arriba…», «parsearCantidad lee coma o punto…», «parsearCantidad rechaza…»; `panel-inventario.test.ts` › «las cantidades viajan a la base con punto…» |
| I12 | Lo vencido no se usa en clase; el faltante y las bajas que no son por vencimiento consumen primero lo vencido; un lote que vence hoy todavía se usa | decidida (D14, B.5) | `salidaPeps({ incluirVencidos })`, `estaVencido`, `resumenDeLotes` · base `app.sacar(p_incluir_vencidos)` | `valuacion.test.ts` › «§5.8-3 vencido saltado…», «un lote que vence HOY todavía se usa…», «B.5: el faltante consume PRIMERO lo vencido…», «B.5: el uso en clase con los mismos lotes…», «B.5: la leche…»; N53 |
| I13 | La baja por vencimiento indica el lote, que debe estar vencido y ser de esa variante y sede, y saca ese lote | decidida | `validarMovimiento`, `salidaPeps({ loteElegido })` · base `app.dar_de_baja` (`lote_requerido`, `lote_no_corresponde`, `lote_no_vencido`) | `inventario.test.ts` › «una baja exige motivo y explicación; la de un insumo vencido, el lote»; `valuacion.test.ts` › «baja por vencimiento: saca ESE lote…»; `panel-inventario.test.ts` › «dar de baja: lo vencido pide el lote…»; N53 |
| I14 | En el uso se puede elegir el lote por línea; por defecto, PEPS | decidida (B.12-16) | `salidaPeps({ loteElegido })` · base `usar_insumos` (`lote` por línea); ver §9 | `valuacion.test.ts` › «B.12 (crítica 16): el lote elegido en el uso sale aunque no sea el primero» |
| I15 | Uniformes, utensilios y otros a costo promedio ponderado; la salida que agota la capa se lleva el resto; el costo por unidad solo se muestra | decidida (D18, ADR 0007) | `salidaPromedio`, `entradaPromedio`, `costoPromedio` · base `app.sacar` (rama promedio) | `valuacion.test.ts` › «§5.8-4 promedio: juego M…», «§5.8-4 promedio: 3 juegos…», «promedio: no se saca más de lo que hay…»; N54 |
| I16 | Prestar es custodia y no cambia el valor; lo que no vuelve es baja desde lo prestado, a promedio | decidida | `prestar`, `recibirPrestado`, `salidaPromedio({ desde: 'prestado' })`, `inventario/prestamo.ts` `recibirPrestamo` · base `app.prestar_utensilios`, `app.recibir_devolucion` | `valuacion.test.ts` › «§5.8-6 préstamo…»; `inventario.test.ts` › «recibir: lo que vuelve regresa al estante…», «recibir en partes deja el préstamo abierto…», «atraso: venció ayer y sigue fuera»; N68, N69 |
| I17 | Un préstamo va a exactamente uno: un alumno, un grupo u otra persona; solo utensilios, por piezas | decidida (D19) | `validarPrestamo`, `movimientoDePrestamo` · base `check` `prestamos_un_destinatario`, `destinatario_requerido` | `inventario.test.ts` › «un préstamo va a exactamente uno…», «solo se prestan utensilios…»; `panel-inventario.test.ts` › «prestar: exactamente un destinatario…»; N68 |
| I18 | Un uniforme devuelto vuelve al costo con que salió; la última pieza se lleva el resto; nunca queda negativo | decidida | `valorDeDevolucion` · base `app.devolver_uniforme` | `valuacion.test.ts` › «§5.8-5 devolución…», «devolución en partes…», «devolución con piezas de valor ínfimo…»; N66, N67 |
| I19 | Cambio de talla: devolución más entrega nueva de otra talla del mismo uniforme, sin cargo | decidida | `devolverEntrega(…, cambiarPor)` · base `app.devolver_uniforme` (`talla_igual`, `pieza_distinta`) | `inventario.test.ts` › «el cambio de talla devuelve una y entrega otra…»; `panel-inventario.test.ts` › «devolver o cambiar la talla pide el motivo»; N65 |
| I20 | Sobrante: PEPS al costo del último lote; promedio al vigente, a la última compra o al que escribe administración | decidida (D16, crítica 24) | `valorDeSobrantePeps`, `valorDeSobrantePromedio` · base `app.registrar_conteo` (`costo_requerido`) | `valuacion.test.ts` › «§5.8-7 conteo: el sobrante de un insumo…», «crítica 24…», «el sobrante entra al lote o a la capa…», «§5.8-7 conteo: el faltante sale por PEPS…»; N55 |
| I21 | Se anulan el saldo inicial (sin movimientos posteriores vigentes), la compra (si nada de lo comprado se movió después; en costo promedio, cuentan solo los movimientos posteriores que no se anularon: se anulan los usos y después la compra, enmiendas A.2), el uso (por operación) y la baja (salvo la que nació de un préstamo). Anular dos veces responde `ya_anulado`. Entregas y préstamos se devuelven | decidida (B.12-12, B.12-25, A.2) | `validarAnulacion`, `TIPOS_ANULABLES` · base `app.anular` (`compra_con_movimientos_posteriores`, `baja_de_prestamo`, `ya_anulado`; migración `20261002190000_panel_anular_lo_deshecho.sql`) | `inventario.test.ts` › «B.12: qué se anula y qué no»; N56, N57, N70, N84–N86 |
| I22 | Un artículo inactivo no admite compras, usos, saldos iniciales, entregas ni préstamos (`articulo_inactivo`); sí admite lo que cierra lo que ya está fuera o mal contado: baja, conteo, devolución de uniforme, recepción de un préstamo y anulaciones. El dominio (`validarMovimiento`) es más estricto: rechaza toda operación nueva | decidida | `validarMovimiento` · base `articulo_inactivo` en `registrar_saldo_inicial`, `registrar_compra`, `usar_insumos`, `entregar_uniforme`, `prestar_utensilios` | `inventario.test.ts` › «un artículo inactivo no admite operaciones nuevas…» |
| I23 | Una baja exige motivo; la explicación en una frase se pide según la capa (ver §9) | decidida | `validarMovimiento` · caso de uso `bajaPideExplicacion` · base `check` `movimientos_baja_con_motivo` | `inventario.test.ts` › «una baja exige motivo y explicación…», «la baja desde lo prestado solo es de utensilios…»; `panel-inventario.test.ts` › «dar de baja…» |
| I24 | Catálogo: código por tipo, nombre único entre los activos, una sola variante en insumos, tallas sin repetir; tipo y unidad fijos en cuanto hay movimientos | decidida | `validarArticulo`, `validarVariantes` · base `app.preparar_articulo` (`tipo_bloqueado`), `app.validar_variante` (`insumo_una_variante`) | `inventario.test.ts` › «validarArticulo…», «variantes: «Única» por defecto…»; `panel-inventario.test.ts` › «alta de artículo…», «agregar una talla que ya existe…»; N50 |
| I25 | Devolver un sobrante de insumos a los mismos lotes. Hoy: registrar lo usado al terminar la clase; administración puede anular el uso y registrarlo bien | **v1.1** (A.2) | — | — |
| I26 | Ajuste de valor sin cantidad. Hoy: anular los usos posteriores y la compra, y registrarla bien | **v1.1** (A.2) | — | — |

---

## 5. Caja y contabilidad

Alcance: **información importante y accionable**, no contabilidad completa.
En simple: un **cargo** es lo que el alumno debe; un **cobro**, el dinero que
entró (con su recibo); un **gasto**, el dinero que salió para que el
instituto funcione; una **compra**, el dinero que salió y se volvió
inventario.

### 5.1 Caja

#### `Cargo` (cuentas por cobrar, `caja/cargo.ts`)
| Campo | Notas |
|---|---|
| `estudianteId` o `cliente` | De un alumno o, en una venta, de alguien de fuera (nombre); uno de los dos |
| `inscripcionId` | Opcional; si está, del mismo alumno |
| `conceptoId` | De ingreso |
| `descripcion` | Hasta 200: «Cuota 2 de 3 · Paquete Económico · …», «Juego de uniforme · talla M» |
| `monto` | Centavos, > 0 |
| `fecha` | Mes en que cuenta como ingreso |
| `venceEl` | Desde cuándo está vencido |
| `sedeId` | |
| `origen` | `plan` (con plan, inscripción y número de cuota) · `entrega` (con su entrega) · `venta_directa` · `manual` |
| `prestamoId` | Opcional: el préstamo cuya pérdida se cobra |
| `registradoEn` | Desempata el orden «del más antiguo al más nuevo» |
| `anuladoEl` | Sello de anulación (con quién, cuándo y motivo en la base) |

Estado: `pendiente`, `parcial`, `pagado` o `anulado`. Lo pagado sale de sus
aplicaciones de cobros **no anulados**: si se anula un cobro, el cargo vuelve
a quedar pendiente. Vencido = le falta algo y `venceEl < hoy`; días de
atraso. La base lo calcula en `v_saldos_de_cargo` y `v_saldos_de_alumno` («lo
que deben», con lo vencido aparte).

#### `Cobro` y su aplicación (`caja/cobro.ts`)
| Campo | Notas |
|---|---|
| `monto` | Centavos, > 0 |
| `medio` | `efectivo` · `qr` · `transferencia` |
| `referencia` | Número de operación del comprobante: obligatorio en QR y transferencia (3 a 60), no se repite por medio entre cobros vigentes (sin distinguir mayúsculas); en efectivo no se guarda |
| `nota` | Hasta 300 |
| (base) `fecha`, `anio`, `numero` | Fecha de hoy y recibo correlativo por sede y año |
| (base) `estudiante_id` o `cliente` | |

Un cobro **se aplica entero** a cargos del alumno: la suma aplicada es igual
al monto, **sin anticipos** (D5). Sin cargos indicados, se reparte del más
antiguo al más nuevo (vencimiento, registro, id) y la base lo exige igual;
con cargos indicados, se respeta lo indicado y solo se exige que nada supere
lo pendiente (B.12-21). Un ingreso suelto es una **venta directa**: cargo y
cobro en el mismo acto.

#### Recibo
«**LP-2026-000123**»: iniciales del código de la sede (`la-paz` → LP,
`el-alto` → EA), año y correlativo de 6 cifras **sin huecos** por sede y año
(D21): un candado serializa y una transacción revertida no deja número.
Monto en letras (`caja/monto-en-letras.ts`): «seiscientos cincuenta 00/100
bolivianos», con «cien» pero «ciento uno», «veintiún mil», «un millón», «mil»
(no «un mil») y las tildes de dieciséis, veintidós, veintitrés y veintiséis.
Es un recibo interno: no es factura.

#### Arqueo o cierre de caja (`caja/arqueo.ts`)
```text
esperado   = saldo inicial + entradas de efectivo − salidas de efectivo
diferencia = contado − esperado        (negativa = falta; positiva = sobra)
queda      = contado − retiro          (saldo inicial del arqueo siguiente)
```
Cuenta **todo lo no arqueado** de la sede (D7): cobros en efectivo entran;
gastos y compras en efectivo salen; las anulaciones mueven el dinero al revés
(un cobro ya arqueado que se anula después sale en el arqueo siguiente). El
saldo inicial es lo que quedó en el arqueo anterior; en el primero de la sede
lo escribe quien cierra. Puede haber varios por día y nunca bloquea un cobro.
Si no cuadra, se explica; no se retira más de lo contado; sin nada nuevo,
`nada_que_arquear`. «Por cerrar» (`caja_por_cerrar`) es la misma cuenta que el
cierre y lista las salidas en efectivo sin concepto ni proveedor («Salida
registrada por Carla · 10:20 · Bs 150»), para que recepción arquee lo que no
puede leer (B.12-22, B.13-31). QR y transferencias se informan aparte, para
cotejar con el banco.

#### Gasto (solo en la base)
Lo registra administración: concepto de gasto, descripción, monto, medio,
número de operación (salvo efectivo), comprobante y proveedor. En efectivo,
con fecha de hoy; por banco, hasta 30 días atrás; nunca a futuro. Los
conceptos son una **semilla fija** (5 de ingreso y 10 de gasto, con su grupo
para el resumen; «internet» va en «Servicios básicos»).

#### Reglas
| # | Regla | Estado | Dominio | Prueba |
|---|---|---|---|---|
| C1 | Lo registrado no se edita ni se borra: se **anula con un sello en la fila** (quién, cuándo, qué día y por qué), una sola vez; en inventario, además, el asiento inverso | decidida (cambió: D8, ya no hay contra-asiento de dinero) | `Cargo.anuladoEl`, `DocumentoDeDinero.anuladoEl` · base `app.solo_sellos`, `app.anular` | `panel-caja.test.ts` › «anular exige motivo…»; N36, N45 |
| C2 | Todo cargo, cobro, gasto, compra y arqueo pertenece a una sede; recepción opera solo en la suya | decidida | `identidad/contexto-de-panel.ts` · base `app.exigir_sede` | N04, N19 |
| C3 | Los importes son **centavos enteros** (`bigint` en la base), nunca coma flotante | decidida | `shared/tipos-base.ts` `Centavos`; `shared/dinero.ts` `parsearMonto`, `formatearMonto` | `dinero.test.ts` › «lee los montos como los escribe la gente en Bolivia», «rechaza lo que no es un monto válido»; `estudiantes.test.ts` › «los importes son enteros en centavos» |
| C4 | La fecha de negocio es la de La Paz; los resúmenes van por mes | decidida (D10) | `shared/calendario.ts` · base `app.hoy()` | `panel.test.ts` › «la hora se toma en La Paz (UTC−4)…»; N09, N10 |
| C5 | Un cargo es de un alumno o de un cliente de fuera; una cuota indica plan, inscripción y número; un cargo por entrega, la entrega | decidida | `validarCargo` · base `check` `cargos_de_alguien`, `cargos_cuota_de_plan` | `caja.test.ts` › «validarCargo: de un alumno o de un cliente de fuera…» |
| C6 | Estado del cargo, pendiente y vencido; lo aplicado por cobros anulados no cuenta | decidida | `estadoDeCargo`, `pendienteDeCargo`, `estaVencido`, `diasDeAtraso` · base `v_saldos_de_cargo`, `app.pendiente_de_cargo` | `caja.test.ts` › «saldo de un cargo…», «la cuota de Diego venció hace 12 días…»; N30 |
| C7 | Un cargo solo se anula sin cobros vigentes aplicados | decidida | `validarAnulacionDeCargo` · base `cargo_con_cobros` | `caja.test.ts` › «un cargo con cobros no se anula…»; N41 |
| C8 | Un cobro se aplica entero a cargos del mismo alumno, sin anticipos; ninguna aplicación supera lo pendiente | decidida (D5) | `aplicarCobro` · base `app.registrar_cobro` (`aplicacion_excede_saldo`, `cobro_sin_aplicar`, `cargo_de_otro_alumno`, `cargo_anulado`) | `caja.test.ts` › «§5.8-8 sin anticipos…», «§5.8-8 con cargos indicados…»; `panel-caja.test.ts` › «los cargos marcados no pueden pasar lo que se debe…»; N32, N46 |
| C9 | Sin cargos indicados, del más antiguo al más nuevo, y la base lo exige | decidida (B.12-21) | `aplicarCobro`, `ordenDeAplicacion` · base `app.registrar_cobro` | `caja.test.ts` › «§5.8-8 sin indicar cargos…»; N33 |
| C10 | QR y transferencia exigen el número de operación, que no se repite por medio entre cobros vigentes | decidida | `validarCobro`, `exigeReferencia`, `esReferenciaRepetida` · base índice `pagos_referencia_unica`, `referencia_repetida` | `caja.test.ts` › «§5.8-8 el número de operación…»; `panel-caja.test.ts` › «cobrar por QR o transferencia exige…»; N35 |
| C11 | Recibo correlativo por sede y año, sin huecos | decidida (D21) | `formatearRecibo` · base `app.siguiente_recibo`, `app.numero_de_recibo` | `caja.test.ts` › «el recibo se numera por sede y año…»; N33, N35 |
| C12 | Venta directa: cargo y cobro en el mismo acto; a alguien de fuera, con su nombre | decidida (D5) | caso de uso `cobrar`, `totalDelCobro` · base `registrar_cobro(p_venta)` | `panel-caja.test.ts` › «el total de un cobro suma…», «un cobro sin nada elegido no llega a la base…»; N37 |
| C13 | Arqueo: esperado, diferencia y lo que queda; explicación si no cuadra; retiro ≤ contado; nada que arquear es error | decidida (D7) | `calcularArqueo`, `describirDiferencia` · base `app.cerrar_caja` y los `check` de `cierres_de_caja` | `caja.test.ts` › «§6.14 arqueo…», «arqueo: no se retira más de lo contado…»; `panel-caja.test.ts` › «cerrar caja: si no cuadra…»; N39 |
| C14 | El arqueo cuenta todo lo no arqueado, compras incluidas; «por cerrar» es la misma cuenta que el cierre | decidida (D7, B.12-22, B.13-31) | `totalesDeCaja` · base `app.caja_por_cerrar`, `app.cerrar_caja` | `caja.test.ts` › «lo que hay por arquear…»; N38, N57 |
| C15 | Una anulación tardía cuenta en el arqueo siguiente y en el mes en que se anula; el mes original no cambia | decidida (§5.7) | `totalesDeCaja`, `totalesDeDineroDelMes`, `ingresosDelMes` | `caja.test.ts` › «§5.8-9 anulación tardía…»; N40 |
| C16 | Orden de candados: la caja de la sede primero (lo que mueve efectivo), luego saldos, lotes, grupo, cargos y recibo | decidida (B.10) | base: `app.candado_de_caja` | — |
| C17 | Solo administración anula (cobro, cargo, gasto, compra, uso, baja, saldo inicial): quien cobra no anula | decidida (D9) | base `app.anular` (`caja.anular`, `inventario.anular`) | N36, N58 |
| C18 | Gasto: concepto de gasto; en efectivo, de hoy; por banco, hasta 30 días atrás | decidida (D10) | base `app.registrar_gasto` (`concepto_no_es_gasto`, `fecha_invalida`) · caso de uso `registrarGasto` | `panel-caja.test.ts` › «anular exige motivo; cargo manual y gasto revisan su forma»; N42 |
| C19 | Cargo manual de administración: alumno, concepto de ingreso y, si corresponde, su inscripción y el préstamo que repone | decidida | base `app.crear_cargo` · caso de uso `crearCargoManual`; ver §9 | `panel-caja.test.ts` › «anular exige motivo; cargo manual…» |
| C20 | Monto en letras del recibo | decidida | `montoEnLetras`, `enteroEnLetras` | `caja.test.ts` › «montoEnLetras: los casos del recibo», «enteroEnLetras: apócopes…» |
| C21 | Un arqueo con diferencia queda «por revisar» hasta que administración (`caja.supervisar`) lo revisa con una nota, una sola vez; la diferencia no cambia (sigue en el resultado del mes) y el aviso del inicio cuenta solo los que faltan revisar, de cualquier mes. Un arqueo que cuadró no se revisa | decidida (2026-10-05, pedido del usuario; adelanta esa parte de A.2) | base `app.revisar_arqueo` (`nota_requerida`, `arqueo_sin_diferencia`, `ya_revisado`), `tablero_de_administracion` | `panel-tablero.test.ts` › «alertasDeAdministracion: frases completas…»; N109–N112 |
| C22 | Verificar los cobros por QR contra el banco | **v1.1** (A.2) | — | — |
| C22 | Pantalla de conceptos de ingreso y gasto (hoy, semilla fija sin escritura por la API) | **v1.1** (A.2) | — | — |

### 5.2 Contabilidad (administración)

#### Resumen del mes (`contabilidad/resumen.ts`)
Un estado de resultados simple, calculado **a partir de totales**: los suma
la base en `public.resumen_del_mes(p_mes, p_sede)` y el dominio los combina
igual. Es una vista de gestión, no un estado financiero oficial (ADR 0008
§9).

```text
INGRESOS             cargos con fecha en el mes − cargos anulados en el mes
COSTO DE LO USADO    valor que salió por uso, entrega, baja o faltante
                     − lo que volvió (devoluciones, sobrantes, anulaciones de usos y bajas);
                     compras y saldos iniciales (y sus anulaciones) no son costo
GASTOS               gastos del mes − gastos anulados en el mes
DIFERENCIAS DE CAJA  faltantes − sobrantes de los arqueos del mes
RESULTADO            ingresos − costo − gastos − diferencias → ganancia, pérdida o sin resultado
```

| Hecho | En qué mes cuenta |
|---|---|
| Cuota de un plan | El de su vencimiento |
| Uniforme cargado al entregarlo, venta directa, cargo manual | El día en que se registra |
| Cobro, gasto | Su fecha |
| Compra | Su fecha, solo como dinero (nunca gasto) |
| Costo de lo usado | La fecha del movimiento; una anulación cuenta como su original, al revés |
| Anulación de cualquier cosa | El mes de `anuladoEl`, restando; **el mes original no cambia** |

**Dinero del mes** (`flujoDelMes`, por medio): entró = cobros − anulados;
salió = gastos + compras − sus anulaciones; las diferencias de caja también
salen (B.13-34); neto.

**Cuadre del inventario del mes** (`cuadreDelInventario`): valor al inicio +
compras − compras anuladas + saldos iniciales − saldos iniciales anulados −
costo de lo usado = valor al final (0 = cuadra).

Encima del resumen, el caso de uso `resumenParaPantalla` explica en frases la
distancia entre el resultado y el dinero: compras que todavía no se usaron
(salió dinero, no es gasto), lo generado que falta cobrar, lo que faltó o
sobró en los arqueos y el inventario que no cuadra. Las cifras de cierre son
lo que deben hoy los alumnos y el valor del inventario hoy.

#### Verificación del cuadre (solo en la base)
`public.verificar_cuadre(p_sede)` responde si el libro y los saldos dicen lo
mismo y lista cada diferencia con el artículo o documento que la causa:
existencia (disponible y prestado) = suma de los movimientos; valor =
suma de `delta_valor`; en insumos, existencia y valor = suma de los lotes;
total de cada compra = suma de sus líneas; cada cobro = suma de sus
aplicaciones; y valor total del libro = valor total de los saldos.

#### Tarjeta kárdex PEPS (`contabilidad/tarjeta-peps.ts`)
Por insumo y sede, solo administración, imprimible (A.1, crítica 17).
`tarjetaPeps` recorre los movimientos en orden de escritura y, después de
cada uno, da sus tomas por lote y las **capas** que quedan (cuánto queda de
cada compra y cuánto vale). **No recalcula el PEPS**: acumula lo que guardó la
base en `movimiento_lotes`, para mostrar exactamente los centavos que se
descontaron. El sentido lo da el movimiento (las tomas se guardan en
positivo): la anulación de una salida devuelve a sus lotes, aunque
estuvieran agotados. `costoUnitario` solo se muestra (25 kg por Bs 180 →
Bs 7,20 el kg); el costo de una salida se calcula siempre sobre el valor
total del lote.

#### Tableros de inicio (`contabilidad/tablero.ts`, R7)
Piezas: el dominio (`contabilidad/tablero.ts`), el caso de uso
`application/panel/tablero/tablero.usecase.ts` (`pendientesDeRecepcion`,
`alertasDeAdministracion`, `cifrasDelMes`), el puerto `tablero.port.ts`, la
lectura de la base `infrastructure/supabase/tablero-desde-base.ts`
(`tableroDesdeBase`, `deudoresDesdeBase`) y las migraciones
`20261002180000_panel_tablero.sql` y `20261002180100_panel_tablero_sedes.sql`.
Pruebas: `panel-tablero.test.ts` y los casos N79–N83 y N87–N89 de la batería.

- `variacion(actual, anterior)`: porcentaje entero frente al mes anterior a la
  misma fecha. Sin base (anterior ≤ 0) no hay porcentaje (`sin_base`, o
  `igual` si los dos son 0); una diferencia que redondea a 0 % es `igual`.
- `barrasDeSemanas(semanas, alto)`: alturas del gráfico «Entró y salió» de
  las últimas 8 semanas, en una sola escala (el mayor valor de todas); una
  barra con valor mide al menos 2; un neto negativo se dibuja en 0 (la tabla
  da la cifra exacta).
- La base (`public.tablero_de_administracion(p_sede)`, exige
  `contabilidad.leer`) suma: efectivo de días anteriores sin arquear, arqueos
  del mes con diferencia, bajas y faltantes de los últimos 7 días, grupos con
  inscritos y sin precio, entregas y pérdidas de préstamos sin cargo (30
  días), el dinero del mes frente al mes anterior a la misma fecha y las
  últimas 8 semanas. Con todas las sedes, devuelve además la sede del
  efectivo sin arqueo más antiguo y la del arqueo con diferencia más reciente
  (el aviso lleva a esa caja: «Ver caja · El Alto») y en cuántas sedes hay.
- Las cifras que una lista recortada daría mal se cuentan en la base: lo que
  deben los alumnos y lo vencido (`public.resumen_de_deudores(p_sede)`, exige
  `caja.leer`), los lotes vencidos y por vencer y las solicitudes abiertas
  (conteos exactos).
- Avisos: en cero no aparecen; se ven los 4 primeros y el resto queda en «Ver
  N más»; cada frase se entiende sola y ya lleva la cantidad. Mientras una
  fuente no responde, la pantalla no dice «¡Todo al día!».

#### Reglas
| # | Regla | Estado | Dominio | Prueba |
|---|---|---|---|---|
| K1 | Resultado del mes = ingresos − costo de lo usado − gastos − diferencias de caja | decidida (§5.7) | `resultadoDelMes`, `diferenciasDeCaja` · base `resumen_del_mes` | `caja.test.ts` › «§5.7 seguimiento completo…», «una pérdida y un mes sin movimiento»; `panel-contabilidad.test.ts` › «resumen del mes (§5.7)…», «un mes vacío no tiene resultado ni frases»; N73 |
| K2 | Una anulación cuenta en el mes en que se hace, restando; el mes original no cambia. Excepción: un cargo anulado ANTES de su propia fecha (una cuota futura que anula un retiro) nunca se devengó y no cuenta en ningún mes | decidida (§5.7; la excepción, revisión final 2026-10-03) | `ingresosDelMes`, `totalesDeDineroDelMes` · base `resumen_del_mes` (migración `20261003120000`) | `caja.test.ts` › «§5.8-9 anulación tardía…», «una cuota futura anulada por un retiro no cuenta en ningún mes…»; N76, N93 |
| K3 | El costo de lo usado va por el tipo original; compras, saldos iniciales y sus anulaciones no son costo; prestar no mueve valor | decidida | `costoDeLoUsado` · base `resumen_del_mes` | `caja.test.ts` › «costo de lo usado: devoluciones, sobrantes y anulaciones de usos restan…»; `panel-contabilidad.test.ts` › «cada línea del costo de lo usado dice qué pasó…»; N73 |
| K4 | Las compras son dinero e inventario, nunca gasto; las diferencias de caja también salen del dinero | decidida (D11, B.13-34) | `flujoDelMes` · base `resumen_del_mes` | `caja.test.ts` › «§5.7 seguimiento completo…»; `panel-contabilidad.test.ts` › «un saldo inicial o un sobrante no se explican como compras…»; N74 |
| K5 | Cuadre del inventario del mes | decidida | `cuadreDelInventario` | `caja.test.ts` › «cuadre del inventario…»; `panel-contabilidad.test.ts` › «resumen del mes: sobrantes de caja e inventario que no cuadra…»; `contabilidad-desde-base.test.ts` › «cuadre completo…»; N75 |
| K6 | El libro y los saldos dicen lo mismo | decidida (A.2: entra en la v1) | base: `public.verificar_cuadre(p_sede)` | N60, N72, N78 |
| K7 | Tarjeta PEPS con los centavos que guardó la base | decidida (A.1, crítica 17) | `tarjetaPeps`, `costoUnitario` | `panel-contabilidad.test.ts` › «tarjeta PEPS de la harina (§5.8)…», «la anulación de la primera salida…», «anular una entrada saca su lote…», «los lotes sin orden conocido van al final…», «costo por unidad: solo se muestra…» |
| K8 | Costos, compras, gastos, conteos y contabilidad solo los ve administración | decidida (D2) | base: RLS con `contabilidad.leer` | N58, N77 |
| K9 | Tablero: variación frente al mes anterior a la misma fecha y barras de 8 semanas | decidida (B.12-29) | `contabilidad/tablero.ts` `variacion`, `barrasDeSemanas` · base `tablero_de_administracion` | `panel-tablero.test.ts` › «variacion: sin base…», «variacion: una base negativa…», «variacion: iguales, y una diferencia que redondea a 0 %…», «barrasDeSemanas: alturas enteras proporcionales…», «barrasDeSemanas: un valor positivo nunca mide menos de 2», «barrasDeSemanas: los negativos cuentan como 0…»; N79–N83 |
| K10 | Cierre y reapertura de mes (`periodos`), con fotografía del resumen; un mes cerrado no cambia | **v1.1** (A.2) | — | — |
| K11 | Auditoría de datos maestros y accesos (`auditoria`) | **v1.1** (A.2); los documentos ya llevan autor y fecha | — | — |
| K12 | Avisos de los tableros: orden de urgencia (recepción) o de gravedad (administración), 4 a la vista, frases completas con la cantidad; con todas las sedes, el aviso de caja lleva a la sede del problema; lo que deben y lo vencido se cuentan en la base | decidida (§7.6, §7.7, B.12-29) | `application/panel/tablero/tablero.usecase.ts` `pendientesDeRecepcion`, `alertasDeAdministracion` · base `tablero_de_administracion`, `resumen_de_deudores` | `panel-tablero.test.ts` › «pendientesDeRecepcion: orden de urgencia…», «alertasDeAdministracion: orden de gravedad…», «alertasDeAdministracion: si el efectivo o los arqueos están en más de una sede…», «deudoresDesdeBase: cifras exactas…»; N87–N89 |

La lectura de los totales que devuelve la base vive en
`infrastructure/supabase/contabilidad-desde-base.ts` (`totalesDesdeBase`,
`cuadreDesdeBase`), probada en `contabilidad-desde-base.test.ts`.

---

## 6. Identidad y permisos

**Tres roles fijos** (ADR 0005 y 0008, `identidad/rol.ts`): `administrador` y
`recepcion` (el personal, sistema interno) y `estudiante` (portal web). Todo
registro web es `estudiante`; el rol nunca sale de los metadatos del usuario.
Los permisos viven en la tabla `permisos_de_rol` (Usuario → Rol → Permiso),
para que cambiar lo que hace un rol sea insertar o borrar una fila. El
estudiante no tiene ningún permiso del panel.

| Permiso | Qué permite | Administración | Recepción |
|---|---|:-:|:-:|
| `panel.entrar` | Entrar a `/panel` | ✓ | ✓ |
| `sedes.todas` | Operar en cualquier sede | ✓ | — |
| `perfiles.leer` · `perfiles.gestionar` | Ver cuentas · cambiar rol, sede y estado | ✓ · ✓ | ✓ · — |
| `sedes.gestionar` · `programas.gestionar` | Sedes y programas | ✓ | — |
| `solicitudes.leer` · `solicitudes.gestionar` | Bandeja del portal | ✓ | ✓ |
| `estudiantes.leer` · `estudiantes.gestionar` | Fichas e inscripciones · crear y editar fichas | ✓ | ✓ |
| `estudiantes.archivar` | Archivar una ficha | ✓ | — |
| `cohortes.leer` | Grupos, cupos y precios (para informar) | ✓ | ✓ |
| `cohortes.gestionar` | Abrir, editar y cerrar grupos | ✓ | — |
| `inscripciones.gestionar` | Inscribir, renovar, aprobar solicitudes, retirar | ✓ | ✓ |
| `inventario.leer` · `inventario.operar` | Existencias, lotes y kárdex sin costos · usar, entregar, prestar, recibir, dar de baja | ✓ | ✓ |
| `inventario.catalogo` · `inventario.comprar` · `inventario.ajustar` · `inventario.anular` | Catálogo y precios · compras · conteo y saldo inicial · anulaciones | ✓ | — |
| `caja.leer` · `caja.cobrar` · `caja.cerrar` | Lo que deben, cobros, recibos · cobrar y vender · arquear | ✓ | ✓ |
| `caja.anular` | Anular cobros, cargos y gastos | ✓ | — |
| `contabilidad.leer` · `contabilidad.gestionar` | Costos, compras, gastos, resumen · gastos, planes de pago, cargos manuales | ✓ | — |
| `caja.supervisar` | Revisar los arqueos con diferencia (verificar QR, en la v1.1) | ✓ | — |
| `contabilidad.cerrar_mes`, `auditoria.leer` | Cerrar meses, auditoría | **v1.1** | — |

**Alcance por sede.** La sede de trabajo es `perfiles.sede_id`. Recepción
**opera solo en su sede** y consulta las dos; administración opera en
cualquiera (`sedes.todas`). La base lo exige con `app.exigir_sede`
(`sede_no_operable`; sin sede asignada, `sede_no_asignada`) en los motores
que registran algo en una sede (ADR 0008 §3). Las lecturas no filtran por
sede, y lo que solo hace administración (anular, cerrar un grupo, cuotas de
un grupo, alta de artículo) no la comprueba. **No hay multi-tenant**: una sola
institución.

**Contexto del panel** (`identidad/contexto-de-panel.ts`): lo calcula la base
(`public.mi_contexto()`): perfil, rol, permisos, sede, sedes operables y
fecha de negocio. Entra al panel quien tiene `panel.entrar` y su cuenta está
activa (`puedeEntrarAlPanel`); la sede por defecto es la propia o, si opera
todas, la primera (`sedeDeTrabajo`). La pantalla usa los permisos para **no
mostrar** lo que no se puede hacer, nunca para permitirlo: autoriza la base.
Pruebas: `panel.test.ts` › «entra al panel quien tiene panel.entrar…», «la
sede de trabajo es la propia…», «recepción ve Inicio, Alumnos, Inventario y
Caja…»; batería N02, N03, N04, N08.

Credenciales del portal (`identidad/credenciales.ts`): contraseña de 10 o más
caracteres con letras y números, sin palabras triviales ni el correo
(`portal.test.ts`).

---

## 7. Contenido público (estático)

El contenido de la web se reparte en tres archivos:

- `apps/web/contenido/instituto.ts`: nombres institucionales, lema y lemas
  secundarios, fundador, pilares, «¿Sueñas emprender?», redes y datos de
  pago (QR).
- `apps/web/contenido/convenios.ts`: aliados y universidades, con su
  logotipo.
- `apps/web/src/infrastructure/catalogo/oferta-academica.ts`: sedes (con
  teléfonos y ubicación) y programas (carrera y cursos, con requisitos,
  turnos y precios). Se valida al arrancar y, por tanto, en el build
  (`catalogo.validator.ts`).

Los valores `[Consultar]` se representan como `pendiente` y la interfaz
los muestra como «Consultar» con enlace a WhatsApp, **nunca como un número
inventado**.

---

## 8. Glosario

| Término | Significado en este proyecto |
|---|---|
| Programa | Oferta publicable (la carrera o un curso) |
| Cohorte / grupo | Apertura concreta de un programa en una sede, gestión y horario; en pantalla, «grupo» |
| Plan de pagos / cuota | Cuánto y cuándo se cobra en un grupo; cada cuota es un cargo |
| Inscripción | Vínculo estudiante ↔ grupo: inscrito, retirado o concluido |
| Ficha | El estudiante en el panel, tenga o no cuenta del portal |
| Artículo / Variante | Producto controlado y su talla o presentación |
| Movimiento / kárdex | Asiento inmutable del inventario / historial de un artículo con lo que queda después de cada asiento |
| Lote | Lo que llegó en una misma compra, con su fecha, su vencimiento y su costo |
| PEPS | «Lo primero que entra es lo primero que sale», y sale a lo que costó |
| Costo promedio ponderado | Cada pieza vale lo mismo: lo que costaron todas juntas entre cuántas hay |
| Costo de lo usado | Lo que valía el inventario que salió; es costo del mes aunque se haya pagado antes |
| Entrega | Salida de un uniforme hacia una inscripción, con contexto; se devuelve, no se anula |
| Préstamo | Custodia de un utensilio: sigue siendo del instituto y vale lo mismo |
| Conteo físico | Contar el estante y corregir el sistema por la diferencia |
| Cargo | Lo que el alumno debe |
| Cobro | El dinero que entró, con su recibo |
| Arqueo | Contar el efectivo y compararlo con lo que debería haber |
| Anulación | Sello en la fila (y, en inventario, asiento inverso); nunca un borrado |
| Sesión | Clase concreta de un grupo (fase posterior) |

---

## 9. Diferencias entre el dominio y la base (2026-10-02)

Lo que hoy no coincide entre el dominio, el caso de uso, la base y las
enmiendas. Se anota para decidir; no se corrige en este documento.

1. **Renovación.** `validarRenovacion` acepta cualquier tipo de programa con
   el mismo programa y una gestión posterior (en la carrera, el año
   siguiente) y exige que la anterior siga `inscrito`. La base
   (`app.inscribir_en_grupo`) solo renueva en la **carrera**, exige la gestión
   **siguiente exacta** y el año siguiente, acepta una anterior `concluido`
   (rechaza solo la `retirado`) y no deja renovar dos veces la misma.
2. **Lote elegido en el uso.** Resuelto el 2026-10-03 (migración
   `20261003120000`, N92): `app.sacar` con un lote elegido también respeta
   el vencimiento salvo que la operación admita lo vencido (baja, faltante
   de un conteo), igual que `salidaPeps({ loteElegido })` del dominio.
   `usar_insumos` con un lote vencido responde `stock_insuficiente`.
3. **Explicación de la baja.** `validarMovimiento` pide una frase en toda
   baja; el caso de uso (`bajaPideExplicacion`), en toda baja salvo la de
   vencimiento; la base (`app.dar_de_baja`) solo con el motivo `otro`.
4. **Devolver un uniforme y su cargo.** Resuelto el 2026-10-03 (migración
   `20261003120100`, N96–N101, N106, N107): sin cambio de talla, cuando ya no
   queda ninguna pieza de la entrega ni de sus cambios de talla en poder del
   alumno, la RPC anula el cargo si no tiene cobros (motivo «Devolución del
   uniforme»); si está cobrado responde `anula_el_cobro` (administración
   anula el cobro y después el cargo); si queda alguna pieza,
   `devolucion_parcial`. El dominio no modela el cargo de la entrega.
5. **Cargo manual.** `app.crear_cargo` recibe el préstamo pero no la entrega
   ni un cliente de fuera, y exige alumno; la enmienda B.12-13 preveía
   `p_entrega` y `p_cliente`.
6. **Verificación del cuadre.** `public.verificar_cuadre` recibe una sede, no
   un mes, y no comprueba el cuadre por lote ni el efectivo sin arqueo del
   mes (esa comprobación era del cierre de mes, v1.1). Lo que comprueba está
   en §5.2.
7. **Resumen del mes.** No existen las vistas `v_resumen_mensual` ni
   `v_flujo_mensual` de la especificación: el resumen y el dinero del mes los
   devuelve la función `public.resumen_del_mes(p_mes, p_sede)`.
8. **Fecha de devolución de un préstamo.** El dominio solo exige que no sea
   anterior al préstamo; la base, además, que no pase de 120 días.
9. **Opciones del grupo.** La base no conoce las opciones de cada programa
   (están en el catálogo estático): turno, días, duración y modalidad los
   valida el dominio en el caso de uso antes de escribir (regla A1); la base
   solo comprueba su formato.
