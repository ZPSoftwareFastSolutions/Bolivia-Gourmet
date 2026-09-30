# Modelo de dominio

> Entidades, relaciones y reglas del sistema interno y de la página pública.
> Deriva de `docs/analisis/analisis-informacion-instituto.md`. Cada regla
> lleva su estado: **definida** (el documento la sostiene), **decidida** (la
> fijó el equipo, con ADR) o **pendiente** (la debe confirmar el cliente).
> Fecha: 2026-09-30.

Convención: los nombres de dominio van en **español** (`Articulo`,
`Movimiento`, `Inscripcion`), como en los módulos operativos de los proyectos
anteriores del equipo. Las carpetas de capa se mantienen en inglés
(`core/domain`, `application`, `infrastructure`, `presentation`).

---

## 1. Mapa de módulos

```text
academico      Programa · Cohorte · Sesion · Requisito
estudiantes    Estudiante · Inscripcion · DocumentoEntregado
inventario     Articulo · Variante · Movimiento · Entrega
administracion Pago · Gasto · Concepto · Periodo
identidad      Usuario · Rol · Permiso · Sede
contenido      (página pública) Institucion · Convenio · Beneficio · Contacto
```

`contenido` es estático y versionado (archivo TypeScript validado en el
build), como en los proyectos anteriores. Los demás módulos viven en la base de
datos.

---

## 2. Académico

### `Programa`
La oferta, tal como se publica. No cambia por apertura.

| Campo | Tipo | Notas |
|---|---|---|
| `codigo` | slug | `gastronomia`, `cocina`, `cocteleria`, `reposteria-y-panaderia`, `tortas`, `temporada-*` |
| `tipo` | `carrera` · `curso` · `curso_de_temporada` | Enum abierto a nuevos tipos |
| `nombre`, `descripcion` | texto | |
| `tituloOtorgado` | texto opcional | Solo carrera |
| `duracion` | `{ unidad: 'anios' \| 'meses', opciones: number[] }` | Carrera `{anios,[3]}`; Cocina `{meses,[1,2,3]}` |
| `diasDeClase` | lista de opciones | «Lunes a viernes», «Jueves y viernes», «Sábados»… |
| `turnos` | lista de `Turno` | `manana`, `tarde`, `noche`, `especial`, `unico` |
| `modalidades` | lista | Solo temporada: `practico`, `magistral`, `virtual` |
| `modulos` / `tematicas` / `planDeEstudios` | estructura por tipo | Carrera: años → materias. Cursos: bloques → temas |
| `beneficios` | lista de texto | «Matrícula gratis», «100 % práctico» |
| `requisitos` | lista de `Requisito` | Documentos u objetos a entregar |
| `costo` | `Pendiente` o estructura de precios | Hoy **pendiente** para todos |
| `uniforme` | `Pendiente` o referencia a kit de uniforme | Hoy **pendiente** |
| `activo` | boolean | Para retirar ofertas sin borrarlas |

### `Cohorte`
Una apertura concreta de un programa. Es a lo que se inscribe un estudiante.

| Campo | Notas |
|---|---|
| `programaCodigo` | FK |
| `sedeId` | FK |
| `nombre` | «Gastronomía · Feb 2027 · Noche», «Tortas · Sábados · Oct 2026» |
| `fechaInicio`, `fechaFin` (opcional) | |
| `duracionElegida` | Debe ser una de `programa.duracion.opciones` |
| `turno`, `diasDeClase`, `modalidad` | Deben estar entre las opciones del programa |
| `costoVigente` | Congelado en la cohorte (si el programa cambia de precio, la cohorte abierta no) |
| `anioDeCarrera` | 1, 2 o 3; solo carrera |
| `estado` | `planificada` · `abierta` · `en_curso` · `cerrada` |
| `capacidad` | opcional |

### `Sesion` (fase posterior, ver P10)
Una clase de una cohorte en una fecha. Existe en el modelo porque el encargo
la relaciona con las entregas de uniforme; **no se implementa hasta definir
P2 y P10**.

### Reglas

| # | Regla | Estado |
|---|---|---|
| A1 | Una cohorte solo puede elegir duración, turno, días y modalidad entre las opciones de su programa | decidida |
| A2 | El costo se congela en la cohorte al abrirla | decidida (misma regla que membresías en GYM PLATFORM) |
| A3 | Un programa inactivo no admite cohortes nuevas, pero sus cohortes en curso siguen | decidida |
| A4 | La carrera tiene plan de estudios por año; los cursos, bloques de contenido; el tipo decide la estructura | definida |
| A5 | Los cursos llevan «matrícula gratis» como beneficio | definida |

---

## 3. Estudiantes

### `Estudiante`
| Campo | Notas |
|---|---|
| `nombres`, `apellidos` | obligatorios |
| `documento` (CI) | opcional al crear, único si se informa |
| `telefono` | 8 dígitos bolivianos (empieza por 6 o 7), opcional |
| `correo` | opcional |
| `fechaDeNacimiento` | opcional (los cursos son «sin límite de edad») |
| `sedeHabitual` | opcional |
| `archivadoEn` | nunca se borra; se archiva |

### `Inscripcion`
| Campo | Notas |
|---|---|
| `estudianteId`, `cohorteId` | par único |
| `fecha` | |
| `estado` | `preinscrito` · `inscrito` · `en_curso` · `retirado` · `concluido` |
| `paquete` | `economico` · `ahorrador` (solo carrera; P6) |
| `documentosEntregados` | checklist contra `programa.requisitos` |
| `observaciones` | |

### Reglas

| # | Regla | Estado |
|---|---|---|
| E1 | Un estudiante no se inscribe dos veces en la misma cohorte | decidida |
| E2 | Un estudiante puede tener inscripciones simultáneas en cohortes distintas | definida (carrera + curso) |
| E3 | Los estudiantes no se borran: se archivan | decidida |
| E4 | La inscripción registra qué requisitos se entregaron; no bloquea por requisitos faltantes (la secretaría decide) | decidida, revisable |
| E5 | El paquete de pago solo aplica a la carrera | definida |

---

## 4. Inventario

### `Articulo`
Producto o bien que el instituto controla.

| Campo | Notas |
|---|---|
| `nombre`, `descripcion` | |
| `tipo` | `utensilio` · `insumo` · `uniforme` · `otro` — **decide el comportamiento** |
| `categoriaId` | Clasificación libre del usuario (p. ej. «Cuchillería», «Lácteos», «Chaquetas») |
| `unidad` | `unidad` · `kg` · `g` · `l` · `ml` · `paquete`… |
| `stockMinimo` | Para avisos |
| `activo` | |

### `Variante`
Todo artículo tiene al menos una variante («Única»). Los uniformes tienen una
por talla; los insumos pueden tener una por presentación.

| Campo | Notas |
|---|---|
| `articuloId` | |
| `etiqueta` | «Única», «S», «M», «L», «XL», «Bolsa 1 kg» |
| `sku` | opcional |
| `stockPorSede` | derivado de movimientos (ver I3) |

### Comportamiento por tipo (regla I1)

| Tipo | Se entrega a estudiantes | Admite devolución | Usa tallas | Cantidad fraccionaria | Foco |
|---|---|---|---|---|---|
| `uniforme` | sí | sí (cambio de talla, error) | sí | no | trazabilidad de entregas |
| `utensilio` | según P4 (hoy: sí, como préstamo) | sí | no | no | existencia, bajas, responsables |
| `insumo` | no | no | no | sí (según unidad) | existencias, entradas, salidas |
| `otro` | no | no | no | no | genérico |

### `Movimiento`
Libro inmutable. Nunca se edita ni se borra; un error se corrige con el
movimiento inverso.

| Campo | Notas |
|---|---|
| `varianteId`, `sedeId` | |
| `tipo` | `entrada` · `salida` · `entrega` · `devolucion` · `ajuste` · `baja` |
| `cantidad` | > 0; entera salvo insumos fraccionarios |
| `fecha` | |
| `responsableId` | usuario de la sesión, nunca del formulario |
| `motivo` | obligatorio en `ajuste` y `baja` |
| `referencia` | `Entrega` (si `entrega`/`devolucion`), compra, etc. |
| `nota` | |

### `Entrega`
Qué se entregó, a quién, cuándo y en qué contexto.

| Campo | Notas |
|---|---|
| `inscripcionId` | a quién (la inscripción, no el estudiante suelto: así se sabe para qué programa) |
| `varianteId`, `cantidad`, `fecha`, `sedeId`, `responsableId` | |
| `contexto` | `{ tipo: 'inscripcion' }` · `{ tipo: 'sesion', sesionId }` · `{ tipo: 'reposicion' }` · `{ tipo: 'otro', detalle }` |
| `estado` | `entregado` · `devuelto` |
| `pagoId` | opcional: si el uniforme se cobra, el pago asociado |

### Reglas

| # | Regla | Estado |
|---|---|---|
| I1 | El `tipo` del artículo decide qué movimientos admite (tabla de arriba) | decidida (ADR 0003) |
| I2 | El stock nunca queda negativo: una salida, entrega o baja mayor que la existencia se rechaza | decidida |
| I3 | El stock es la suma de movimientos por variante y sede; no se edita a mano. Un `ajuste` fija la existencia a un valor y exige motivo | decidida |
| I4 | Los movimientos son inmutables; se corrigen con el inverso | decidida |
| I5 | Toda entrega genera exactamente un movimiento `entrega`; toda devolución, uno `devolucion` | decidida |
| I6 | La entrega apunta a una **inscripción** y lleva un **contexto**; la sesión es un contexto posible, no obligatorio | decidida hasta resolver P2 |
| I7 | Cuándo corresponde entregar un uniforme (al inscribirse, en una sesión, tras pagar) | **pendiente (P2)**; el sistema registra, no decide |
| I8 | Los insumos comprados por los estudiantes de forma grupal **no** pasan por el inventario del instituto | definida (§4.3, §6), revisable con P3 |
| I9 | Un artículo por debajo de `stockMinimo` aparece en el tablero | decidida |

---

## 5. Administración y contabilidad

Alcance inicial: **información importante y accionable**, no contabilidad
completa.

### `Pago` (ingreso)
| Campo | Notas |
|---|---|
| `inscripcionId` | opcional (hay ingresos sin inscripción: venta de uniforme suelto, otros) |
| `concepto` | `matricula` · `cuota` · `paquete` · `uniforme` · `curso` · `otro` |
| `monto`, `moneda` (BOB) | |
| `fecha`, `sedeId`, `registradoPor` | |
| `medio` | `efectivo` · `qr` · `transferencia` · `otro` (P7) |
| `comprobante` | opcional |

### `Gasto`
| Campo | Notas |
|---|---|
| `concepto` (texto o catálogo), `monto`, `fecha`, `sedeId`, `registradoPor` | |
| `referencia` | opcional: compra de inventario (movimiento `entrada`) |

### Tablero (lo mínimo que decide algo)

| Indicador | Por qué |
|---|---|
| Ingresos de la semana y del mes, con variación frente al período anterior | Salud del negocio |
| Estudiantes activos y nuevas inscripciones del mes | Volumen |
| Gastos del mes | Contraste con ingresos |
| Artículos bajo stock mínimo | Acción: comprar |
| Entregas de uniforme pendientes (inscritos sin entrega) | Acción: entregar (cuando I7 se defina) |
| Cohortes por iniciar en 30 días | Acción: preparar |

Sin gráficos decorativos: una serie de ingresos por semana/mes y tablas.

### Reglas

| # | Regla | Estado |
|---|---|---|
| C1 | Un pago registrado no se edita ni se borra; se anula con un asiento inverso | decidida |
| C2 | Todo ingreso y gasto pertenece a una sede | decidida |
| C3 | Los importes se guardan en centavos enteros (o `numeric(12,2)` en la base) y nunca en coma flotante | decidida |
| C4 | Períodos: hoy, semana, mes, mes anterior, año, personalizado; en la zona horaria de Bolivia (`America/La_Paz`) | decidida |

---

## 6. Identidad y permisos

| Rol | Permisos (módulo.acción) |
|---|---|
| `administrador` | todo, incluida gestión de usuarios |
| `secretaria` (recepción) | estudiantes.*, inscripciones.*, pagos.crear, pagos.leer, cohortes.leer |
| `almacen` | inventario.*, entregas.*, movimientos.* |
| `direccion` (lectura) | tablero.leer, reportes.leer |

Los nombres de rol y su reparto son **pendientes (P9)**; el modelo es
Usuario → Rol → Permiso en tablas, como en el proyecto anterior, para que un
rol nuevo sea un insert. **No hay multi-tenant**: una sola institución. Sí hay
**alcance por sede** (un usuario puede operar una o ambas).

---

## 7. Contenido público (estático)

Archivo `apps/web/contenido/instituto.ts` (validado en el build): nombres
institucionales, lema, fundador, pilares, oferta publicada (derivada del
catálogo académico), convenios, beneficios, requisitos, sedes, teléfonos,
redes. Los valores `[Consultar]` se representan como `pendiente` y la interfaz
los muestra como «Consultar» con enlace a WhatsApp, **nunca como un número
inventado**.

---

## 8. Glosario

| Término | Significado en este proyecto |
|---|---|
| Programa | Oferta publicable (la carrera o un curso) |
| Cohorte | Apertura concreta de un programa en una sede con fecha y horario |
| Inscripción | Vínculo estudiante ↔ cohorte |
| Artículo / Variante | Producto controlado y su talla o presentación |
| Movimiento | Asiento inmutable del inventario |
| Entrega | Salida de inventario hacia un estudiante inscrito, con contexto |
| Sesión | Clase concreta de una cohorte (fase posterior) |
