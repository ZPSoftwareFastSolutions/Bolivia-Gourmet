# Análisis de `INFORMACION-INSTITUTO.md`

> Lectura completa del documento institucional (212 líneas) para extraer
> entidades, relaciones, categorías, reglas, contenido y vacíos. Es la base
> del modelo de dominio (`docs/domain/modelo-de-dominio.md`) y del contenido
> de la página pública. Fecha: 2026-09-30.

---

## 1. Instituciones y nombres

| Denominación | Papel aparente | Dónde |
|---|---|---|
| Instituto Técnico Nacional de la Integración Boliviana | Nombre del instituto (probablemente el legal/académico) | Documento |
| Corporación Bolivia Gourmet | Marca comercial y entidad que contrata este proyecto; nombre en Facebook e Instagram | Documento, logotipos |
| Bolivia Gastronómica | Segunda marca; nombre del logotipo con gorro; TikTok y YouTube usan «Bolivia Gourmet» | Documento, logotipos |

Regla de trabajo: las tres denominaciones se respetan literalmente; ninguna
sustituye a otra. Qué nombre va en qué lugar de la web (título, pie legal,
metadatos) **está pendiente de confirmar** con el cliente.

Fundador: **Chef Oscar Mora**. Antigüedad: **más de 16 años**. Lema:
**«Descubre el chef que llevas dentro!»**. Título: **Técnico Superior en
Gastronomía** (Provisión Nacional).

## 2. Entidades detectadas

### 2.1 Oferta académica

El documento describe **dos naturalezas de oferta** con estructura distinta:

**Carrera técnica** (una sola: Gastronomía).

| Atributo | Valor |
|---|---|
| Duración | 3 años |
| Días | Lunes a viernes |
| Turnos | Mañana 08:30 · Tarde 15:00 · Noche 18:00 · Horario especial (según coordinación) |
| Inicio | Febrero 2027 |
| Plan de estudios | 8 materias en 1.er año, 7 en 2.º, 7 en 3.º (22 materias) |
| Título | Técnico Superior en Gastronomía; convalidación a licenciatura con 4 universidades |
| Requisitos | 5 documentos/objetos (CI, certificado de nacimiento, título de bachiller, 4 fotografías, folder con fastener) |
| Costo | Paquete Económico `[Consultar]` · Paquete Ahorrador `[Consultar]` |
| Uniforme | `[Costo a consultar]` |
| Insumos | No incluidos; los compran los estudiantes de forma grupal |

**Cursos y especialidades** (cinco, con atributos parecidos pero valores
distintos):

| Curso | Duración | Horarios | Turnos | Módulos / temáticas | Beneficio | Requisitos |
|---|---|---|---|---|---|---|
| Cocina | 1, 2 o 3 meses | Semana (jueves y viernes) / sábados | — | Módulos: Nacional, Internacional, Eventos. 9 temáticas | Matrícula gratis, 100 % práctico | (no indica) |
| Coctelería | 1 o 2 meses | Semana (jueves y viernes) / sábados | — | 9 temáticas | Matrícula gratis | (no indica) |
| Repostería y Panadería | 2, 4 o 6 meses | Semana (lunes, martes y miércoles) / sábados | Mañana, Noche, Único turno | 8 bloques de repostería + 7 de panadería | Matrícula gratis | (no indica); insumos de compra grupal |
| Tortas | 2, 4 o 6 meses | Semana (lunes, martes y miércoles) / sábados | — | 3 bloques de contenido | Matrícula gratis | (no indica) |
| Cursos de temporada | `[Consultar]` | `[Consultar]` | — | Modalidades: Práctico, Magistral, Virtual | — | CI, funda transparente, fotos 3×3 fondo celeste |

Todos con inicio `[Consultar]`, costo `[Consultar]` y uniforme `[Consultar]`.

**Lectura clave:** cada curso se ofrece con **opciones** (duración elegible,
día de semana o sábado, turno) que se concretan **en cada apertura**. El
folleto impreso lo confirma: esos campos están en blanco para rellenarlos a
mano. Por tanto el modelo necesita separar **la oferta** (el programa y sus
opciones posibles) de **la apertura concreta** (cohorte: fecha de inicio,
duración elegida, horario, sede, costo vigente).

### 2.2 Sedes

| Sede | Zona | Dirección | Teléfono |
|---|---|---|---|
| La Paz | Miraflores | Calle Francisco de Miranda #1986 entre Villalobos y Díaz Romero | 77706890 |
| El Alto | La Ceja | Calle 4 esq. Jorge Carrasco, Edificio Kollasuyo #225 (5.º piso) | 77708027 |

Dos sedes desde el día uno: toda operación (inscripción, inventario,
entrega, cobro) debe poder atribuirse a una sede.

### 2.3 Personas

- **Estudiante**: la persona que se inscribe. Se relaciona con una o varias
  inscripciones (puede cursar la carrera y además un curso; puede repetir
  cursos de temporada).
- **Personal**: quien opera el sistema (administración, recepción/secretaría,
  responsable de almacén). El documento no lo describe; se deduce del
  encargo.
- **Docentes**: mencionados solo como «docentes especializados». Fuera del
  alcance inicial.

### 2.4 Convenios y alianzas

Contenido informativo para la web, no datos operativos: 17 empresas y 4
universidades (nombres en el documento, con discrepancias frente al folleto:
ver `docs/brand/identidad-visual.md` §11).

### 2.5 Contenido de marketing

Pilares (Titúlate · Convalida · Practica · Aprende), sección «¿Sueñas
emprender?» con 4 beneficios, requisitos, redes sociales (Facebook, TikTok,
Instagram, YouTube). Todo esto es **contenido estático versionado**, no tablas.

## 3. Relaciones principales

```text
Sede 1─n Cohorte n─1 Programa (carrera | curso | curso de temporada)
                │
                └─n Inscripción n─1 Estudiante
                        │
                        ├─n Pago (matrícula, cuota/paquete, uniforme, curso)
                        ├─n Entrega de inventario (uniforme u otro artículo) ─┐
                        └─n Asistencia a sesión ◄─── Sesión n─1 Cohorte       │
                                                                              │
Artículo (tipo: utensilio | insumo | uniforme | otro) 1─n Variante (talla…)   │
                                        │                                     │
                                        └─n Movimiento (entrada, salida, entrega, devolución, ajuste, baja) ◄┘
                                                    │
                                                    └─1 Sede · 1 Responsable (usuario)
```

## 4. Categorización de estudiantes (sin inventar)

Las categorías **surgen de la oferta**, no de una tabla de tipos de estudiante:

| Eje | Valores que da el documento |
|---|---|
| Tipo de programa | Carrera técnica · Curso · Curso de temporada |
| Programa | Gastronomía · Cocina · Coctelería · Repostería y Panadería · Tortas · (temporada, variable) |
| Turno / horario | Mañana · Tarde · Noche · Especial (carrera); Semana · Sábados; Mañana · Noche · Único (repostería) |
| Sede | La Paz · El Alto |
| Gestión / cohorte | Febrero 2027 (carrera); las demás `[Consultar]` |
| Año de carrera | 1.º · 2.º · 3.º (solo carrera) |
| Paquete de pago | Económico · Ahorrador (solo carrera) |
| Modalidad | Práctico · Magistral · Virtual (solo temporada) |

Un estudiante «es» estas cosas **a través de su inscripción**, no por un
atributo propio. Un mismo estudiante puede estar en la carrera (turno noche,
La Paz, 2.º año) y en un curso de Tortas (sábados, El Alto). Por eso la
categoría vive en `Inscripción` + `Cohorte`, y añadir una carrera o un curso
nuevo es **insertar datos**, no tocar código.

## 5. Reglas de negocio que el documento permite afirmar

| # | Regla | Fuente |
|---|---|---|
| R1 | La carrera dura 3 años y se cursa de lunes a viernes en uno de tres turnos (o especial) | §2 |
| R2 | Los cursos tienen duración elegible entre opciones fijas por curso (p. ej. Cocina: 1, 2 o 3 meses) | §4 |
| R3 | Los cursos tienen «matrícula gratis» | §4.1–4.4 |
| R4 | El costo de la carrera y de los cursos **no incluye insumos**; los estudiantes los compran de forma grupal | §4.3, §6 |
| R5 | El uniforme tiene un costo propio, distinto de la matrícula/paquete | §6, §4 |
| R6 | Cada tipo de oferta tiene su lista de requisitos de inscripción | §4.5, §6 |
| R7 | La carrera se paga por paquete (Económico o Ahorrador); el detalle de cada paquete está pendiente | §6 |
| R8 | Los cursos de temporada admiten modalidad práctica, magistral o virtual | §4.5 |
| R9 | Hay dos sedes con teléfono propio | §7 |

## 6. Reglas que el encargo pide pero que el documento NO define (pendientes)

| # | Pregunta abierta | Por qué importa |
|---|---|---|
| P1 | ¿Qué piezas componen el uniforme de la carrera y el de cada curso? ¿Tallas? | Define las variantes del inventario de uniformes |
| P2 | ¿Cuándo se entrega el uniforme: al inscribirse, en la primera clase, al pagar? ¿Se entrega una vez por inscripción o puede haber reposiciones? | El encargo dice que «cada sesión o clase puede estar relacionada con la entrega de un uniforme» y pide **no asumir** que todos reciben uno en cada clase. El modelo deja la sesión como contexto **opcional** de la entrega hasta definir la regla |
| P3 | ¿El instituto almacena insumos o solo los compran los estudiantes? Si almacena, ¿con qué unidades (kg, l, unidad)? | Decide si los insumos tienen stock propio o solo control de compras grupales |
| P4 | ¿Los utensilios se prestan a estudiantes y se devuelven, o solo se controla existencia y bajas? | Decide si existe el movimiento «devolución» para utensilios |
| P5 | ¿Cuáles son los importes: paquetes, uniforme, cada curso, cursos de temporada? | Necesarios para cobros y dashboard; hoy `[Consultar]` |
| P6 | ¿Qué incluye cada paquete (Económico / Ahorrador)? ¿Son planes de pago o niveles de servicio? | Modelo de pagos de la carrera |
| P7 | ¿Cómo se cobra: contado, cuotas, QR bancario, efectivo? ¿Quién registra? | Módulo contable |
| P8 | ¿Qué gastos quiere ver el instituto (compras de inventario, servicios, sueldos)? | Alcance del módulo administrativo |
| P9 | ¿Quiénes usan el sistema y con qué rol? ¿Una cuenta por sede? | Roles y permisos |
| P10 | ¿Se registra asistencia por sesión? ¿Quién la toma? | Existencia de la entidad Sesión en la primera versión |
| P11 | ¿Fechas de inicio y horarios concretos de los cursos? | Contenido público y cohortes iniciales |
| P12 | ¿Dominio web? ¿Correo institucional? | Despliegue y SEO |

Ninguna de estas preguntas bloquea la arquitectura: el modelo las soporta con
campos opcionales y catálogos configurables. Sí bloquean **publicar** costos y
**automatizar** la entrega de uniformes.

## 7. Datos del documento con posible errata

- «Alt Paocha» (folleto: Alí Pacha) · «La Carindera» (folleto: La Cordobesa) ·
  «Auroras» (folleto: Aurora) · «UNIGEN» (folleto: UNICEN).
- «Trotas» en el contenido de Tortas (probable «Tortas»); «Buttercreem»
  (probable «Buttercream»); «Cuissine» (así aparece también en el logotipo,
  se respeta).
- «Michelline» coincide con el logotipo (Pastelería Michelline).

Se transcriben tal cual en el contenido hasta que el cliente confirme; el
código que muestre estos textos los lee de un archivo de contenido, no los
incrusta, para corregirlos en un solo lugar.
