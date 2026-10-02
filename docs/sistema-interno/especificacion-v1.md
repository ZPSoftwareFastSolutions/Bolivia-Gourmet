# Sistema interno v1: especificación definitiva

> Corporación Bolivia Gourmet (área de gastronomía del TEC-NIB). Fecha:
> 2026-10-02. Rama de trabajo: `feat/sistema-interno` (hoy en `08df150`, que
> ya incluye la web y el portal). Rama de entrega: `sistema-interno-v1`.
>
> Este documento une tres propuestas («datos y control», «facilidad de uso»
> y «contabilidad e inventario») en **una sola especificación construible por
> un equipo pequeño en una entrega**. Toma la estructura de datos y las
> garantías de la primera, la experiencia y el lenguaje de la segunda, y la
> lógica contable de la tercera. Cuando chocan, la tabla «Decisiones» dice qué
> se eligió y por qué en una línea.
>
> Hechos del repositorio comprobados al escribirla:
> - `apps/web/tests/base-de-datos.test.ts` (l. 68–74) hace fallar toda función
>   `security definer` que no empiece por `app.` o no fije `search_path = ''`.
> - Los permisos deben cumplir `^[a-z_]+\.[a-z_]+$` (migración de identidad, l. 47).
> - `solicitudes.estudiante_id` apunta a `perfiles(id)`; la aprobación directa
>   está permitida hoy a quien tiene `solicitudes.gestionar`, y
>   `supabase/seed/datos-demo.sql` (l. 170) aprueba así cuatro solicitudes.
> - Carla (administración) y Rosa (recepción) son de La Paz: en El Alto no hay
>   recepción.
> - `proxy.ts` (l. 30) solo renueva la sesión en `/portal` y `/auth`.
>
> Reglas que se respetan siempre: CLEAN y Dependency Rule; CSP estricta (sin
> atributo `style`, sin `next/image`, sin librerías de gráficos ni de
> animación); RLS en todas las tablas; Server Components por defecto; español
> neutro sin voseo; **ningún dato institucional inventado** (lo que falta se
> muestra «Consultar» o «Sin precio»).

---

## Decisiones

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| D1 | RPC = **fachada `SECURITY INVOKER` en `public`** que llama a un **motor `SECURITY DEFINER` en `app`** con `search_path = ''` | DEFINER directo en `public` (facilidad) | La prueba del repositorio y la regla 4 de migraciones lo exigen; los lints 0028/0029 de Supabase avisan de DEFINER expuesto |
| D2 | Los **costos viven en tablas espejo `*_costo`** que solo lee administración | Costos en las mismas tablas, ocultos solo en pantalla (facilidad) | RLS filtra filas, no columnas: con costos en `movimientos`, recepción los leería por REST |
| D3 | **Ingreso devengado por cargos** (lo que debe el alumno), generados por un **plan de pagos por grupo que carga administración** | Ingreso al cobrar (facilidad); un precio fijo por concepto con un cargo por gestión (control) | La periodicidad de los Bs 650 no está confirmada: el plan la dice como dato, no el código; da «lo que deben» y el resultado del mes |
| D4 | Demo: carrera con **1 cuota de Bs 650 por gestión**, nota «periodicidad por confirmar»; **cursos sin plan** | 10 cuotas mensuales y cursos a Bs 100 × 2 (contabilidad) | Eso sería inventar datos institucionales |
| D5 | Un cobro se **aplica entero** a cargos, del más antiguo al más nuevo; sin anticipos; un ingreso suelto es una **venta directa** (cargo + cobro en el mismo acto) | Cobros sin cargo con concepto propio (control) | Un solo invariante para todo cobro: «suma aplicada = monto» |
| D6 | Estados de inscripción: **`inscrito`, `retirado`, `concluido`**; «en curso» se deduce del grupo | `preinscrito` que pasa a `inscrito` con el primer pago (facilidad) | Sería inventar una regla de negocio; la deuda ya se muestra aparte |
| D7 | **Cierre de caja = arqueo de todo lo no arqueado** (`cierre_id` en cada registro), varios por día si se quiere; el saldo inicial es lo que se dejó en el arqueo anterior | Caja diaria que bloquea al cerrar y pide reabrir (control); abrir caja con fondo (contabilidad) | Menos pasos, nunca bloquea un cobro y una anulación tardía cae sola en el arqueo siguiente |
| D8 | **Anulación = sello en la fila** (`anulado_en`, `anulado_el`, `anulado_por`, `anulacion_motivo`, `anulacion_cierre_id`); en inventario, además, **asiento inverso** en el libro | Contra-asiento con monto negativo en cobros (facilidad) | Conserva montos positivos y aplicaciones; el sello dice en qué mes (`anulado_el`) y en qué arqueo cuenta |
| D9 | **Solo administración anula** | Recepción anula lo propio del día (facilidad) | Quien cobra no anula (control interno); se compensa con el resumen previo a cada guardado |
| D10 | **Inventario y cobros siempre con fecha de hoy** (`app.hoy()`); gastos por QR o transferencia hasta 30 días atrás si el mes está abierto; la compra guarda `fecha_documento` informativa | Elegir fecha hacia adelante por artículo (control, contabilidad) | Elimina los errores de orden en PEPS y promedio y una decisión menos para el personal |
| D11 | **La compra es su propio documento** con medio y total; no crea una fila de gasto | Gasto automático «compra de inventario» (contabilidad, facilidad) | Dos filas que sincronizar y anular a la vez; la caja suma gastos y compras |
| D12 | **Compras, conteo, saldo inicial y catálogo: solo administración** | Recepción compra (facilidad) | Es salida de dinero y valoriza el inventario; si el cliente lo pide, es una fila en `permisos_de_rol` |
| D13 | Recepción **usa, entrega, presta, recibe, da de baja, inscribe, convierte solicitudes, cobra y arquea**, solo en **su sede**; consulta las dos sedes | Recepción en ambas sedes | Aclaraciones §3; la base lo exige en cada RPC |
| D14 | **Los lotes vencidos no se usan**: la salida PEPS los salta y el error dice cuánto hay vencido | PEPS estricto (facilidad) | Regla sanitaria de cocina; lo vencido se da de baja aparte |
| D15 | **Desaparece el «ajuste que fija la existencia»**: el conteo físico registra **faltante o sobrante por la diferencia** | Mantener el ajuste de `movimiento.ts` | Con lotes no se sabe de qué lote sale o entra la diferencia |
| D16 | Sobrante sin costo de referencia: **administración escribe el costo** | Entrar a costo 0 con aviso (facilidad, contabilidad) | No subvaluar el inventario; el conteo ya es de administración |
| D17 | Uniforme = artículo **«Juego de uniforme de la carrera»** por talla, con **precio de venta Bs 650 en el artículo**; uniforme de cursos sin precio | Kit con piezas (control); piezas sueltas (facilidad) | Las piezas (P1) no están confirmadas; el precio conocido es por juego |
| D18 | Insumos: **PEPS**. Uniformes, utensilios y otros: **costo promedio ponderado**. Prestar no cambia el valor; perder o romper es baja | — (coinciden las tres) | Comida: se rota lo más antiguo; piezas idénticas: un costo por pieza |
| D19 | **Préstamo = una fila por utensilio** (varias en una misma operación) | Cabecera + líneas (control) | Una tabla menos; la pantalla agrupa por persona |
| D20 | **Idempotencia única**: tabla `operaciones` con la clave que genera cada formulario | Una clave por documento (control) | Un mecanismo para todas las RPC, también anulaciones y cierres |
| D21 | **Numeración sin huecos solo en recibos** (por sede y año, con candado) | Correlativos para todo documento (control); `identity` con huecos (facilidad) | El recibo es el único número que se entrega a un tercero |
| D22 | **El «uso en clase» no tiene cabecera**: lo forman los movimientos de una misma operación | Tabla `consumos` (control, contabilidad) | Una tabla menos; anular un uso es anular su operación |
| D23 | Categoría = **texto libre** con sugerencias; **icono** del artículo de una lista cerrada; proveedor = texto con sugerencias | Tablas `categorias` y `proveedores` | Dos pantallas de ajustes menos; no hay NIT ni compras a crédito en la v1 |
| D24 | **Aprobar = inscribir**: solo `aprobar_solicitud`; el disparador lo exige salvo en modo mantenimiento, y `datos-demo.sql` activa ese modo | Dos caminos para aprobar | Ninguna aprobación queda sin inscripción y la demo existente sigue cargando |
| D25 | Datos maestros de una fila (estudiante, grupo, plan, concepto, datos de artículo) por **escritura directa** con grants por columna; todo lo de varios pasos, por RPC | Todo por RPC (control) | Menos funciones que mantener; la RLS y los disparadores bastan |
| D26 | Navegación: **Inicio · Alumnos · Inventario · Caja**, más **Contabilidad · Ajustes** para administración; grupos y solicitudes son pestañas de Alumnos | Sección «Oferta» aparte (facilidad) | Cuatro secciones para recepción, al alcance del pulgar |
| D27 | Personal: administración da acceso de **recepción o de administración** desde Ajustes | Solo recepción por pantalla (control) | La base ya lo permite a `perfiles.gestionar`; ocultarlo no protege nada; sigue la guarda del último administrador |
| D28 | Tableros: **una RPC `INVOKER` por tablero**; tarjetas en cero ocultas y «¡Todo al día!» si no queda ninguna; **un solo gráfico** SVG con su tabla | Consultas en paralelo y tarjetas «Todo al día» (facilidad) | Una ida a la base; nada que no pida una acción |
| D29 | Confirmación: **redirección con `?hecho=&ref=`**; la página **relee el documento** y muestra un bloque que **no se esconde solo** | Aviso que se cierra a los 5 s | Las personas mayores leen a su ritmo; la URL no lleva datos ni cifras |
| D30 | Marca en el panel: Kaushan solo en saludo, sello y estado vacío; Bebas en cifras; vino = Capacitación; hexágonos en Inventario; polaroid en Inicio (**enmienda a `identidad-visual.md` §9, a confirmar**) | El panel sobrio de §9 | El usuario pidió no perder la esencia del instituto |
| D31 | **Auditoría** solo de datos maestros y accesos (precios, planes, roles, mínimos, grupos) | Sin auditoría; auditoría de todo | Los documentos ya llevan autor y sello; lo que cambia sin dejar documento es lo que hay que auditar |
| D32 | **Verificación de cobros por QR** por administración contra el banco | Sin verificación | El QR se registra a mano con el número de operación |
| D33 | Cinta «Demostración» por **variable de entorno del servidor** (`PANEL_MODO_DEMO=si`) | Columna en una tabla de ajustes | Una tabla menos; antes de producción se borra toda la demo |
| D34 | Orden: **dominio puro → base y esqueleto → alumnos → caja → inventario → contabilidad → tableros → demo** | Inventario primero (control) | Respeta dependencias (entregas usan inscripciones y cargos); el riesgo PEPS se cubre en R0 con el dominio |
| D35 | Rama de entrega **`sistema-interno-v1`** | `feat/sistema-interno/v1` (Git no lo admite) · `v1` (ambigua con etiquetas) | Nombre claro, admite `sistema-interno-v2` |
| D36 | Rótulos: **«Carrera»** (no «Licenciatura») y **«Capacitación»**; «Grupo» en vez de cohorte | «Licenciatura» | La web dice «Carrera» hasta que el cliente confirme |

---

## 1. Alcance de la v1

### 1.1 Lo que entra

| Módulo | Qué incluye |
|---|---|
| **Acceso y panel** | `/panel` con el mismo inicio de sesión del portal; el personal llega a `/panel` y el estudiante a `/portal`; navegación por permisos; sede de trabajo; Inicio con tablero por rol |
| **Alumnos** | Ficha única (con o sin cuenta del portal) para **Carrera** y **Capacitación**; grupos con cupos y plan de pagos; inscripción, renovación al año siguiente, retiro y conclusión; requisitos entregados; **bandeja de solicitudes del portal con conversión en inscripción** |
| **Inventario** | Artículos por tipo (insumo, uniforme, utensilio, otro) con tallas; existencias por sede; **insumos con lotes PEPS y vencimientos**; uniformes, utensilios y otros con **costo promedio ponderado**; compra, uso en clase, entrega de uniforme (con cobro), cambio de talla y devolución, préstamo y devolución de utensilios, baja, conteo físico, saldo inicial, anulación; historial (kárdex) por artículo y sede |
| **Caja** | Lo que debe cada alumno (cargos del plan, del uniforme o manuales); cobros en **efectivo, QR o transferencia** con número de operación; recibo interno numerado e imprimible; ventas directas; arqueo (cierre de caja); verificación de QR |
| **Contabilidad** (administración) | Gastos por concepto; resumen del mes (resultado y dinero); valor del inventario; cuadre del inventario; cierre y reapertura de mes; auditoría |
| **Ajustes** (administración) | Personal (rol, sede, activo), conceptos de ingreso y gasto |
| **Datos de demostración** | Semilla ficticia, marcada, borrable y coherente con las 5 cuentas que ya existen |

### 1.2 Lo que queda para después

| Qué | Por qué no en la v1 |
|---|---|
| QR bancario en pantalla (panel y portal) | El cliente no lo envió; la v1 registra el número de operación del comprobante |
| Foto del comprobante (Storage) | Más superficie de seguridad; el número de operación único ya evita duplicados |
| Traspasos entre sedes | Nadie los pidió; el modelo los admite (salida PEPS en origen y lote igual en destino) |
| Compras a crédito y devolución a proveedor | En la v1 toda compra se paga al registrarse; una compra mal cargada y sin usar se anula |
| Anticipos, becas, descuentos, mora | No hay reglas del instituto; se corrige anulando el cargo con motivo |
| Uniforme por piezas (kit) | Pendiente P1; la v1 maneja el juego por talla |
| Recetas y costo por plato | Requiere recetas del instituto; el uso por grupo ya da el costo real |
| Sesiones de clase y asistencia (P10) | Fuera de esta fase; el uso de insumos se liga al grupo y a la fecha |
| Activos fijos y depreciación | Hornos y batidoras industriales no son inventario; lo define el contador |
| Facturación fiscal, plan de cuentas, partida doble | La v1 emite recibos internos («no es factura»); los conceptos tienen un `grupo` para enlazar después |
| Saldo, uniforme y préstamos del estudiante en el portal | Primero lo valida el personal; las tablas ya enlazan `estudiantes.perfil_id` |
| Exportar CSV o PDF | El recibo, el resumen del mes y el kárdex se imprimen (`@media print`) |
| Insumos comprados en grupo por los estudiantes | Según el documento (regla I8) no pasan por el instituto; si el cliente lo pide, entran como insumo sin cambiar el modelo |
| Docentes, horarios y notas | Fuera del encargo |

### 1.3 Principios de integridad (no negociables)

1. **Lo registrado no se edita ni se borra.** Se corrige con una anulación
   (sello en la fila más asiento inverso en el libro) o con un conteo.
2. **Nada queda negativo**: existencias, lotes, valores, saldos de cargos. Lo
   garantizan los `check` de la base, no la pantalla.
3. **Una operación de varios pasos es una sola transacción** (una RPC).
4. **El costo cuadra al centavo**: la salida que agota un lote o una existencia
   se lleva el valor restante exacto.
5. **Quién hizo qué sale de la sesión** (`auth.uid()`), nunca del formulario.
6. **Un mes cerrado no cambia**: no entra nada con su fecha y las anulaciones
   posteriores cuentan en el mes en que se hacen.
7. **RLS en todas las tablas**; permisos en `permisos_de_rol`; recepción no
   lee costos, gastos ni compras.

### 1.4 Supuestos de alcance (se confirman en §10.2)

- El inventario de insumos es **solo lo que compra el instituto**.
- El uniforme de la carrera es un **juego por talla** a **Bs 650**; se entrega
  al inscribirse por primera vez (P2). El de capacitación (polera beige y
  delantal negro, según el folleto) no tiene precio.
- Los Bs 650 del Paquete Económico se cargan **una vez por gestión** en la demo,
  hasta que el cliente diga su periodicidad. El Paquete Ahorrador y los cursos
  no tienen precio.

---

## 2. Modelo de datos

### 2.0 Convenciones

| Elemento | Regla |
|---|---|
| Importes | `bigint` en **centavos**, columnas `monto`, `valor`, `total`; nunca `numeric` con decimales ni `float` |
| Cantidades | `numeric(12,3)`; el dominio redondea a 3 decimales. Uniformes y utensilios en enteros (lo exige la RPC según el tipo) |
| Fecha de negocio | `date` con `app.hoy()` = `(now() at time zone 'America/La_Paz')::date`. Nunca la fecha UTC |
| Autor | `registrado_por uuid not null default auth.uid() references perfiles(id)`; ningún grant permite escribirla |
| Identificadores | `uuid default gen_random_uuid()`; `numero bigint generated always as identity` para referirse a un documento en pantalla («Compra n.º 12») |
| Operación | `operacion_id uuid not null references operaciones(clave)` en todo documento y movimiento: agrupa lo que nació en el mismo envío |
| Sello de anulación | `anulado_en timestamptz`, `anulado_el date`, `anulado_por uuid`, `anulacion_motivo text`; en lo que mueve efectivo, además `anulacion_cierre_id uuid` |
| Enumeraciones | Tipos `enum` en español |
| Vistas | `with (security_invoker = true)` |
| Funciones | Siempre `create or replace function` (la prueba del repositorio solo ve esas) |

**Tablas nuevas: 26** (3 de núcleo, 4 de alumnos, 6 de dinero y 13 de
inventario, de las que 3 son espejos de costo). Ninguna es decorativa.

### 2.1 Núcleo

**Funciones de apoyo (`app`, fuera de la API):**

| Función | Qué hace |
|---|---|
| `app.hoy()` | Fecha de negocio de Bolivia |
| `app.en_mantenimiento()` | `session_user = 'postgres' and current_setting('app.mantenimiento', true) = 'si'`. Lo usan solo los scripts de `supabase/seed/` desde el editor SQL. **En R1 se comprueba con `select session_user` en el editor**; si fuera otro usuario, se ajusta esta única línea |
| `app.exigir_permiso(p text)` | Lanza `sin_permiso` |
| `app.sede_de_sesion()` | `perfiles.sede_id` de quien llama |
| `app.puede_operar_sede(p_sede uuid)` | `tiene_permiso('sedes.todas') or sede_de_sesion() = p_sede` |
| `app.exigir_sede(p_sede uuid)` | Lanza `sede_no_operable` (o `sede_no_asignada` si el perfil no tiene sede) |
| `app.exigir_periodo_abierto(p_fecha date)` | Lanza `periodo_cerrado` |
| `app.iniciar_operacion(p_clave uuid, p_tipo text) returns jsonb` | Idempotencia (§3.3) |
| `app.terminar_operacion(p_clave uuid, p_resultado jsonb)` | Guarda el resultado para devolverlo si el envío se repite |
| `app.auditar()` | Disparador `after insert or update` de datos maestros |
| `app.libro_inmutable()` | Disparador de inmutabilidad (§2.8) |
| `app.verificar_cuadre(p_mes date default null)` | Devuelve las diferencias del libro; vacía = bien (§2.7) |

**`operaciones`**: `clave uuid pk`, `tipo text not null`, `registrado_por uuid
not null default auth.uid()`, `resultado jsonb`, `created_at`. Sin grants:
solo la escribe el motor.

**`periodos`**: `mes date pk check (extract(day from mes) = 1)`, `estado`
(`abierto`, `cerrado`), `cerrado_por`, `cerrado_en`, `resumen jsonb`
(fotografía del resumen al cerrar), `reabierto_por`, `reabierto_en`,
`reabierto_motivo`. Un mes sin fila está abierto.

**`auditoria`**: `id bigint identity pk`, `tabla text`, `registro_id text`,
`accion text check (accion in ('crear','editar','cambiar_rol','cerrar_mes','reabrir_mes'))`,
`actor_id uuid`, `en timestamptz default now()`, `antes jsonb`, `despues
jsonb`, `motivo text`. Inmutable. La escriben `app.auditar()` (en
`estudiantes`, `cohortes`, `planes_de_pago`, `conceptos`, `articulos`,
`variantes`, `perfiles`) y el cierre de mes.

### 2.2 Cambios en tablas y scripts existentes

| Elemento | Cambio |
|---|---|
| `permisos_de_rol` | Filas nuevas de §4 |
| `perfiles` | Sin cambio de esquema. Para el personal, `sede_id` es la **sede de trabajo** |
| `programas` | Sin cambios: sigue siendo referencia; el contenido vive en `oferta-academica.ts` |
| `app.validar_cambio_de_solicitud()` | Dos reglas más: pasar a `aprobada` exige que exista una inscripción con `solicitud_id = new.id` (código `aprobar_inscribiendo`), salvo `app.en_mantenimiento()`; pasar a `rechazada` exige `respuesta` (código `respuesta_requerida`) |
| `supabase/seed/datos-demo.sql` | Antes de aprobar las solicitudes históricas: `perform set_config('app.mantenimiento', 'si', true);`. Así se puede seguir borrando y recargando la demo |
| `supabase/seed/borrar-datos-demo.sql` | Vacía también las tablas del panel (§9.7) |

### 2.3 Alumnos y grupos

**`estudiantes`**: la persona, tenga o no cuenta del portal.

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `codigo` | `text unique`, lo pone un disparador: `BG-2026-0007` (serie por año) |
| `perfil_id` | `uuid unique null references perfiles(id) on delete set null` |
| `nombres`, `apellidos` | `text not null`, 1 a 80 caracteres sin espacios sobrantes |
| `documento` | `text null check (~ '^[0-9A-Za-z-]{4,20}$')`; índice único `upper(documento) where documento is not null and archivado_en is null` (lo carga el personal, no un registro abierto) |
| `telefono` | `text null check (~ '^[67][0-9]{7}$')` |
| `correo` | `text null`, en minúsculas |
| `fecha_de_nacimiento` | `date null` |
| `sede_id` | `uuid not null references sedes` (sede habitual) |
| `observaciones` | `text null`, ≤ 500 |
| `nombre_busqueda` | `generated always as (lower(translate(nombres || ' ' || apellidos, 'ÁÉÍÓÚáéíóúÑñÜü', 'AEIOUaeiouNnUu'))) stored`, con índice trigram (`pg_trgm` en `extensions`) |
| `archivado_en`, `archivado_por`, `archivado_motivo` | Regla E3: no se borra, se archiva. Solo con `estudiantes.archivar` y sin inscripción `inscrito` ni préstamo abierto (disparador) |
| `registrado_por`, `created_at`, `updated_at` | |

**`cohortes`** (en pantalla, **grupos**)

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `programa_codigo` | `references programas(codigo)` |
| `sede_id` | `references sedes` |
| `gestion` | `smallint not null check (between 2020 and 2100)` |
| `anio_de_carrera` | `smallint null check (between 1 and 3)`; obligatorio si el programa es `carrera`, nulo si no (disparador) |
| `turno`, `dias`, `duracion`, `modalidad` | Mismos `check` que `solicitudes`; las opciones concretas las valida el dominio (`validarCohorte`) contra el catálogo |
| `fecha_inicio`, `fecha_fin` | `date not null` / `date null check (fecha_fin >= fecha_inicio)` |
| `capacidad` | `integer null check (> 0)`; nulo = sin límite; no puede bajar del número de inscritos (disparador) |
| `estado` | `estado_de_grupo`: `planificado`, `abierto`, `en_curso`, `cerrado` |
| `created_at`, `updated_at` | |

El nombre visible («Gastronomía · 1.er año · Noche · 2026 · La Paz»,
«Tortas · Sábados · oct 2026 · La Paz») no se guarda: lo arma
`app.nombre_de_grupo()` en `v_grupos` y `nombreDeGrupo()` en el dominio.

**`planes_de_pago`**: cuánto y cuándo se cobra en un grupo. **Lo carga
administración**; sin plan, el grupo no tiene precio.

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `cohorte_id` | `not null references cohortes` |
| `paquete` | `paquete_de_pago null`; solo en la carrera (disparador) |
| `concepto_id` | `not null references conceptos` (de naturaleza `ingreso`) |
| `monto_cuota` | `bigint not null check (> 0)` |
| `cuotas` | `smallint not null check (between 1 and 24)` |
| `primer_vencimiento` | `date not null` |
| `cada_meses` | `smallint not null default 1 check (between 1 and 12)` |
| `nota` | `text null` («Periodicidad por confirmar») |
| Único | `(cohorte_id, coalesce(paquete::text, ''))` |

Regla A2 (precio congelado): un disparador impide cambiar `monto_cuota`,
`cuotas`, `primer_vencimiento` y `cada_meses` en cuanto el plan tiene un cargo
no anulado. Antes de eso se puede crear, editar o borrar.

**`inscripciones`**

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `numero` | identity |
| `operacion_id` | `references operaciones` |
| `estudiante_id`, `cohorte_id` | `not null`, fk |
| `fecha` | `date not null` |
| `estado` | `estado_de_inscripcion`: `inscrito`, `retirado`, `concluido` |
| `paquete` | `paquete_de_pago null`; obligatorio en la carrera y nulo en los cursos (regla E5, disparador) |
| `documentos_entregados` | `text[] not null default '{}'` (regla E4: se anota, no bloquea) |
| `solicitud_id` | `uuid unique null references solicitudes` |
| `renueva_a` | `uuid unique null references inscripciones` (el 2.º año viene del 1.º) |
| `motivo_de_retiro` | `text null`; obligatorio si `retirado` |
| `observaciones` | `text null`, ≤ 500 |
| `registrado_por`, `created_at`, `updated_at` | |
| Único parcial | `(estudiante_id, cohorte_id) where estado = 'inscrito'` (regla E1) |

### 2.4 Dinero: conceptos, cargos, cobros, gastos y arqueos

En simple: un **cargo** es lo que el alumno debe; un **cobro** es dinero que
entró; un **gasto** es dinero que salió para que el instituto funcione; una
**compra** es dinero que salió y se volvió inventario (§2.5).

**`conceptos`**: `id`, `codigo text unique`, `nombre`, `naturaleza`
(`ingreso`, `gasto`), `grupo text` (para el resumen), `icono text` (lista
cerrada de `Icono.tsx`), `del_sistema boolean` (no se desactiva), `activo`.
**Sin precio**: los precios viven en el plan del grupo y en el artículo.

Semilla (nombres genéricos, sin importes):
- Ingreso: `colegiatura-carrera` (Paquete de la carrera), `curso-capacitacion`,
  `venta-uniforme`, `reposicion-utensilio`, `otro-ingreso`.
- Gasto: `alquiler`, `servicios-basicos`, `sueldos-y-honorarios`,
  `mantenimiento`, `limpieza`, `material-de-oficina`, `publicidad`,
  `transporte`, `tramites`, `otro-gasto`.

**`cargos`** (cuentas por cobrar)

| Columna | Tipo y restricción |
|---|---|
| `id`, `operacion_id` | |
| `estudiante_id` | `uuid null`; `cliente text null` para una venta a alguien de fuera; `check` exige uno de los dos |
| `inscripcion_id` | `uuid null` |
| `concepto_id` | `not null` (de naturaleza `ingreso`) |
| `descripcion` | `text not null` («Paquete Económico · Gastronomía 1.er año 2026», «Cuota 2 de 3 · Tortas oct 2026») |
| `monto` | `bigint check (> 0)` |
| `fecha` | `date not null`: **mes en que cuenta como ingreso** (§5.6) |
| `vence_el` | `date not null`: desde cuándo está vencido |
| `sede_id` | `not null` |
| `origen` | `plan`, `entrega`, `venta_directa`, `manual` |
| `plan_id`, `numero_de_cuota` | null salvo `origen = 'plan'`; único `(inscripcion_id, plan_id, numero_de_cuota) where anulado_en is null` |
| `entrega_id`, `prestamo_id` | Origen del cargo, si lo hay |
| Sello de anulación | `anulado_en`, `anulado_el`, `anulado_por`, `anulacion_motivo` |
| `registrado_por`, `registrado_en` | |

**`pagos`** (en pantalla, **cobros**; cada uno es un recibo)

| Columna | Tipo y restricción |
|---|---|
| `id`, `operacion_id` | |
| `sede_id`, `fecha` | `fecha date not null default app.hoy()` |
| `anio`, `numero` | Recibo sin huecos por sede y año: único `(sede_id, anio, numero)`. Se muestra **«LP-2026-000123»** |
| `estudiante_id` | `uuid null` (null solo en venta directa a alguien de fuera) |
| `monto` | `bigint check (> 0)` |
| `medio` | `medio_de_pago`: `efectivo`, `qr`, `transferencia` |
| `referencia` | `text null`; **obligatoria** en `qr` y `transferencia` (número de operación del comprobante). Único `(medio, upper(referencia)) where referencia is not null and anulado_en is null` |
| `nota` | `text null` |
| `cierre_id` | `uuid null references cierres_de_caja`: el arqueo que lo contó |
| `verificado_en`, `verificado_por` | Solo `qr` y `transferencia` |
| Sello de anulación | `anulado_en`, `anulado_el`, `anulado_por`, `anulacion_motivo`, `anulacion_cierre_id` |
| `registrado_por`, `registrado_en` | |

**`pago_aplicaciones`**: `pago_id`, `cargo_id`, `monto bigint check (> 0)`, pk
`(pago_id, cargo_id)`. Invariantes que verifica el motor y la batería:
`Σ aplicado por pago = pagos.monto`; `Σ aplicado de pagos no anulados por
cargo ≤ cargos.monto`.

**`gastos`**: `id`, `numero`, `operacion_id`, `sede_id`, `fecha date` (hoy;
hasta 30 días atrás solo en `qr` o `transferencia` y con el mes abierto),
`concepto_id` (de naturaleza `gasto`), `descripcion text not null`, `monto >
0`, `medio`, `referencia` (como en cobros), `comprobante` (`factura`,
`recibo`, `nota_de_venta`, `sin_comprobante`), `numero_comprobante`,
`proveedor text null`, `cierre_id`, sello de anulación con
`anulacion_cierre_id`, `registrado_por`, `registrado_en`.

**`cierres_de_caja`** (arqueo)

| Columna | Tipo y restricción |
|---|---|
| `id`, `numero`, `operacion_id` | |
| `sede_id`, `fecha` | `fecha = app.hoy()`; puede haber varios en un día |
| `saldo_inicial` | `bigint >= 0`: el `queda` del arqueo anterior de la sede; en el primer arqueo de la sede lo escribe quien cierra |
| `entradas_efectivo` | Cobros en efectivo + anulaciones de gastos y compras en efectivo, no arqueados |
| `salidas_efectivo` | Gastos y compras en efectivo + anulaciones de cobros en efectivo, no arqueados |
| `esperado` | `saldo_inicial + entradas_efectivo − salidas_efectivo` |
| `contado` | `bigint >= 0`: lo que contó la persona |
| `diferencia` | `generated always as (contado − esperado) stored` |
| `retiro` | `bigint >= 0 check (retiro <= contado)`: lo que se retira o deposita |
| `queda` | `generated always as (contado − retiro) stored`: saldo inicial del arqueo siguiente |
| `cobros_qr`, `cobros_transferencia`, `registros` | Informativos (para conciliar con el banco) |
| `observacion` | Obligatoria si `diferencia <> 0` |
| `cerrado_por`, `cerrado_en` | |
| `revisado_por`, `revisado_en`, `nota_de_revision` | Administración revisa los arqueos con diferencia |

### 2.5 Inventario

En simple: **las cantidades las ve todo el personal; lo que costaron, solo
administración** (tablas `*_costo`).

**`articulos`**

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `codigo` | `text unique`, por tipo: `INS-0001`, `UNI-0001`, `UTE-0001`, `OTR-0001` (disparador) |
| `nombre` | `text not null`, 1 a 80; único por `lower(nombre)` entre los activos |
| `tipo` | `tipo_de_articulo not null`; **inmutable** en cuanto hay movimientos (disparador) |
| `valuacion` | `generated always as (case when tipo = 'insumo' then 'peps' else 'promedio' end) stored` |
| `categoria` | `text null`, ≤ 40, libre (sugerencias en pantalla) |
| `icono` | `text not null` de una lista cerrada de `Icono.tsx` (`trigo`, `huevo`, `lacteo`, `torta`, `copa`, `plato`, `chaqueta`, `gorro`, `cubiertos`, `bol`, `batidor`, `almacen`) |
| `unidad` | `unidad_de_medida`: `unidad`, `kg`, `g`, `l`, `ml`, `paquete`; `kg/g/l/ml` solo en `insumo` y `otro`; inmutable con movimientos |
| `controla_vencimiento` | `boolean not null default false`; solo puede ser verdadero en `insumo` |
| `stock_minimo` | `numeric(12,3) not null default 0 check (>= 0)`; vale para cada sede |
| `precio_venta` | `bigint null check (> 0)`; solo en `uniforme`; nulo = «Precio por definir» (no se puede cobrar) |
| `activo` | boolean; un inactivo no admite operaciones nuevas |
| `registrado_por`, `created_at`, `updated_at` | |

**`variantes`**: `id`, `articulo_id`, `etiqueta` («Única», «S», «M», «L»,
«XL»), `orden smallint`, `activa`. Único `(articulo_id, lower(etiqueta))`. Un
insumo tiene **exactamente una** variante «Única» y se mide en su unidad
base; la presentación de compra («saco de 50 kg») es una nota.

**`existencias`** (saldo vivo; una fila por variante y sede; solo la escribe
el motor)

| Columna | Tipo y restricción |
|---|---|
| `variante_id`, `sede_id` | pk |
| `disponible` | `numeric(12,3) not null default 0 check (>= 0)` |
| `prestado` | `numeric(12,3) not null default 0 check (>= 0)`; solo utensilios |
| `total` | `generated always as (disponible + prestado) stored` |
| `actualizado_en` | |

**`existencias_costo`**: `variante_id`, `sede_id` (pk) y `valor bigint not null
default 0 check (>= 0)`. En promedio es **la capa de costo**; en PEPS es la
suma de los lotes. `total = 0 ⇒ valor = 0` (lo verifica el cuadre).

**`lotes`** (solo insumos; un disparador lo exige)

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `secuencia` | `bigint generated always as identity`: desempata el orden PEPS |
| `variante_id`, `sede_id` | not null |
| `origen` | `compra`, `saldo_inicial`, `sobrante` |
| `fecha_ingreso` | `date not null` |
| `vence_el` | `date null`; obligatoria si el artículo controla vencimiento |
| `cantidad_inicial` | `numeric(12,3) check (> 0)` |
| `cantidad_restante` | `numeric(12,3) check (between 0 and cantidad_inicial)` |
| `movimiento_entrada_id` | `unique`: el movimiento que lo creó |

Solo cambia `cantidad_restante` (disparador `app.proteger_lote`).

**`lotes_costo`**: `lote_id pk`, `valor_inicial bigint check (>= 0)`,
`valor_restante bigint check (between 0 and valor_inicial)`.

**`movimientos`** (el libro, o kárdex; inmutable)

| Columna | Tipo y restricción |
|---|---|
| `id` | uuid pk |
| `numero` | `bigint generated always as identity`: orden de escritura |
| `operacion_id` | not null: agrupa las líneas de un mismo documento (un uso en clase son los movimientos de su operación) |
| `variante_id`, `sede_id` | not null |
| `tipo` | `tipo_de_movimiento` (tabla siguiente) |
| `fecha` | `date not null` (= `app.hoy()`, D10) |
| `cantidad` | `numeric(12,3) check (> 0)`, siempre positiva |
| `delta_disponible`, `delta_prestado` | `numeric(12,3)` con signo; un `check` por tipo fija los signos |
| `disponible_resultante`, `prestado_resultante` | `check (>= 0)`: saldo justo después (columna «Queda» del kárdex) |
| `destino` | `destino_de_uso null`: `clase`, `practica`, `evento`, `degustacion`, `uso_interno`, `otro` (solo `consumo`) |
| `cohorte_id` | `uuid null`: grupo de la clase |
| `detalle` | `text null`, ≤ 300: tema de la clase, motivo de la baja o del ajuste, nota |
| `motivo_baja` | `motivo_de_baja null`: `vencimiento`, `dano`, `rotura`, `perdida`, `merma`, `otro`; obligatorio en `baja` |
| `compra_id`, `entrega_id`, `prestamo_id`, `conteo_id` | fk null; un `check` exige la que corresponde al tipo |
| `lote_id` | null: lote creado (entrada PEPS) o elegido (baja de un lote vencido) |
| `anula_a` | `uuid unique null references movimientos`; obligatorio si y solo si `tipo = 'anulacion'` |
| `registrado_por`, `registrado_en` | |

| `tipo` | Δ disponible | Δ prestado | Valor | Artículos |
|---|---|---|---|---|
| `saldo_inicial` | + | 0 | Costo declarado | Todos |
| `compra` | + | 0 | Lo pagado por la línea | Todos |
| `consumo` (uso en clase) | − | 0 | PEPS (insumo) o promedio (otro) | Insumo, otro |
| `entrega` | − | 0 | Promedio | Uniforme |
| `devolucion_entrega` | + | 0 | Al costo con que salió | Uniforme |
| `prestamo` | − | + | **Sin cambio de valor** | Utensilio |
| `devolucion_prestamo` | + | − | Sin cambio de valor | Utensilio |
| `baja` | − (o 0 si era prestado) | 0 (o − si se perdió en préstamo) | PEPS o promedio | Todos |
| `ajuste_faltante` | − | 0 | PEPS o promedio | Todos (conteo) |
| `ajuste_sobrante` | + | 0 | Último costo por unidad, o el que escribe administración | Todos (conteo) |
| `anulacion` | Inverso del original | Inverso | Inverso exacto (mismos lotes, mismo valor) | Compra, consumo, baja |

**`movimientos_costo`**: `movimiento_id pk`, `delta_valor bigint` con signo,
`valor_resultante bigint check (>= 0)`.

**`movimiento_lotes`**: `movimiento_id`, `lote_id`, `cantidad > 0`, `valor >=
0`, pk `(movimiento_id, lote_id)`. Dice de qué lote salió (o a cuál entró)
cada parte; con él una anulación devuelve exactamente a los mismos lotes y la
ficha responde «¿de qué compra salió esta harina?». Solo lo lee
administración (lleva valor).

**`compras`**: `id`, `numero`, `operacion_id unique`, `sede_id`, `fecha`
(hoy), `fecha_documento date null` (la de la nota del proveedor), `proveedor
text null`, `comprobante`, `numero_comprobante`, `medio`, `referencia`
(obligatoria en QR y transferencia), `total bigint check (> 0)` (= suma de
`movimientos_costo` de sus líneas, lo verifica el motor), `cierre_id`, sello
de anulación con `anulacion_cierre_id`, `registrado_por`, `registrado_en`.
Sus líneas son los movimientos `compra` con `compra_id`; el vencimiento vive
en el lote y la presentación en `detalle`.

**`entregas`** (uniformes): `id`, `numero`, `operacion_id`, `inscripcion_id
not null`, `sede_id`, `variante_id`, `cantidad integer check (> 0)`,
`devuelta integer not null default 0 check (between 0 and cantidad)`,
`contexto` (`inscripcion`, `reposicion`, `cambio_de_talla`, `otro`),
`detalle` (obligatorio en `otro`), `fecha`, `registrado_por`. El cargo que
la cobra apunta a ella (`cargos.entrega_id`); «entrega sin cargo» se deduce.
`devuelta` solo la sube el motor, siempre con su movimiento.

**`prestamos`** (utensilios; una fila por utensilio): `id`, `numero`,
`operacion_id`, `sede_id`, `variante_id`, `cantidad integer > 0`, `devuelta`
y `perdida` (`>= 0`, suma `<= cantidad`), **exactamente uno** de
`estudiante_id`, `cohorte_id` o `persona text` (un docente), `fecha`,
`devolver_el date check (>= fecha)`, `cerrado_en` (cuando ya no queda nada
fuera), `registrado_por`.

**`conteos`**: `id`, `numero`, `operacion_id`, `sede_id`, `fecha`, `clase`
(`conteo`, `saldo_inicial`), `lineas jsonb not null` (por línea: variante, lo
que mostraba la pantalla, lo contado, la diferencia y el motivo; también las
que coincidieron, como constancia), `registrado_por`. Las diferencias son
movimientos con `conteo_id`.

### 2.6 Vistas (todas `security_invoker = true`)

| Vista | Qué devuelve | Quién |
|---|---|---|
| `v_existencias` | Artículo, código, tipo, icono, categoría, variante, sede, unidad, `disponible`, `vencido` (cantidad en lotes vencidos, que no se usa), `prestado`, `total`, `stock_minimo`, `proximo_vencimiento`, `estado` (`agotado`, `bajo`, `bien`) | Personal |
| `v_existencias_valorizadas` | Lo anterior + `valor` y `costo_promedio` | Administración |
| `v_kardex` | Movimientos con rótulo legible («Usado en clase · Cocina Sábados»), entra, sale, queda, responsable. No une `compras` ni `conteos`: esas filas dicen «Compra» o «Ajuste por conteo» | Personal |
| `v_kardex_valorizado` | Lo anterior + costo de la fila y valor resultante | Administración |
| `v_lotes_vigentes` | Lote, artículo, sede, compra del, queda, vence, `dias_para_vencer`, `estado` (`vencido`, `por_vencer`, `bien`, `sin_vencimiento`); sin costo | Personal |
| `v_prestamos_abiertos` | Préstamo, a quién, utensilio, pendiente, desde, devolver el, `dias_de_atraso` | Personal |
| `v_sin_uniforme` | Alumnos con inscripción `inscrito` en la carrera que **nunca** recibieron el juego de la carrera (entregas netas de devoluciones = 0) | Personal |
| `v_saldos_de_cargo` | Cargo, alumno, concepto, monto, aplicado (de cobros no anulados), `pendiente`, `estado` (`pendiente`, `parcial`, `pagado`, `anulado`), `vencido`, días de atraso | `caja.leer` |
| `v_saldos_de_alumno` | Alumno, `total_pendiente`, `total_vencido`, cargo más antiguo, celular | `caja.leer` |
| `v_grupos` | Grupo, nombre armado, programa y tipo, sede, inicio, turno, días, `inscritos`, `capacidad`, `libres`, `tiene_precio`, cuota y número de cuotas (o nulo = «Consultar») | Personal |
| `v_resumen_mensual` | Por mes y sede: ingresos por grupo de concepto, anulaciones, costo de lo usado, gastos por grupo, diferencias de caja, resultado | Administración |
| `v_flujo_mensual` | Por mes, sede y medio: entró, salió (gastos + compras), anulaciones | Administración |

**Regla para las vistas que suman.** Una vista `invoker` solo suma las filas
que la sesión ve. Lo que recepción suma (saldos, cupos) se apoya en tablas que
lee **completas**. Lo que necesita filas que no ve (las salidas de efectivo
del arqueo) lo calcula una función DEFINER que devuelve **solo totales**
(`caja_por_cerrar`, §3.8).

### 2.7 Cómo se calculan existencia y costo, y cómo se verifica

- **Existencia**: `existencias.disponible` (+ `prestado` en utensilios). Solo
  la escribe el motor, en la misma transacción que el movimiento y con la
  fila bloqueada `for update`.
- **Costo**: PEPS en lotes (`lotes_costo.valor_restante`); promedio en la capa
  (`existencias_costo.valor`). Detalle en §5.
- **Valor del inventario** = `Σ existencias_costo.valor`. Lo prestado sigue
  siendo del instituto y sigue valiendo.
- **`app.verificar_cuadre(p_mes)`** devuelve una fila por diferencia y debe
  salir vacía. Comprueba:
  1. `existencias.disponible = Σ delta_disponible` y `prestado = Σ delta_prestado` por variante y sede;
  2. `existencias_costo.valor = Σ delta_valor`;
  3. en insumos, `total = Σ lotes.cantidad_restante` y `valor = Σ lotes_costo.valor_restante`;
  4. por lote, `cantidad_inicial = Σ salidas − Σ reingresos + cantidad_restante` y lo mismo en valor (según `movimiento_lotes`);
  5. `total = 0 ⇒ valor = 0`; ningún lote con cantidad 0 y valor > 0;
  6. por compra, `total = Σ valor de sus movimientos`;
  7. por cobro, `Σ aplicaciones = monto`; por cargo, `Σ aplicado vigente ≤ monto`;
  8. con `p_mes`: ningún efectivo del mes sin arqueo.

  La corre la batería después de cada escenario, y `cerrar_mes` la exige.

### 2.8 Inmutabilidad y modo mantenimiento

1. **Sin grants de escritura** para `authenticated` en `operaciones`,
   `periodos`, `auditoria`, `cargos`, `pagos`,
   `pago_aplicaciones`, `gastos`, `cierres_de_caja`, `existencias`,
   `existencias_costo`, `lotes`, `lotes_costo`, `movimientos`,
   `movimientos_costo`, `movimiento_lotes`, `compras`, `entregas`,
   `prestamos` y `conteos`. Solo escribe el motor. En `inscripciones`, el
   personal solo puede actualizar `documentos_entregados` y `observaciones`
   (§3.9); el alta y el estado van por RPC.
2. **`app.libro_inmutable()`** (`before update or delete`) en `movimientos`,
   `movimientos_costo`, `movimiento_lotes`, `pago_aplicaciones`, `conteos`,
   `auditoria` y `operaciones` (salvo `resultado`, que se escribe una vez):
   rechaza siempre con `libro_inmutable`, también al motor.
3. **Disparadores de columnas** en `cargos`, `pagos`, `gastos`, `compras`,
   `cierres_de_caja`, `entregas`, `prestamos`, `lotes`, `inscripciones`: solo
   dejan cambiar el sello de anulación (una vez, de nulo a valor, con motivo),
   `cierre_id`/`anulacion_cierre_id` (de nulo a valor), la verificación y la
   revisión, `devuelta`/`perdida`/`cerrado_en` (solo crecen),
   `cantidad_restante` y el estado de la inscripción.
4. **`app.exigir_periodo_abierto()`** como disparador en toda tabla con
   `fecha`: no entra nada con fecha de un mes cerrado.
5. **Modo mantenimiento** (`app.en_mantenimiento()`): los disparadores de los
   puntos 2–4, la regla «inventario y cobros con fecha de hoy» (D10) y la de
   «aprobar = inscribir» (D24) lo dejan pasar. Lo usan solo
   `datos-demo.sql`, `datos-panel-demo.sql` y `borrar-datos-demo.sql` desde el
   editor SQL. Por la API la sesión es `authenticator`: nunca lo cumple, y
   ninguna función expuesta fija esa variable.

### 2.9 Índices importantes

- `movimientos (variante_id, sede_id, numero)` (kárdex); `movimientos (sede_id, fecha)`; `movimientos (operacion_id)`; `movimientos (tipo, fecha)`.
- `lotes (variante_id, sede_id, fecha_ingreso, secuencia) where cantidad_restante > 0` (orden PEPS).
- `lotes (sede_id, vence_el) where cantidad_restante > 0 and vence_el is not null` (avisos).
- `pagos (sede_id, fecha)`, `pagos (sede_id) where cierre_id is null`, `pagos (medio) where verificado_en is null and anulado_en is null`, único de referencia.
- `gastos (sede_id, fecha)`, `compras (sede_id, fecha)`, y sus parciales `where cierre_id is null`.
- `cargos (inscripcion_id)`, `cargos (estudiante_id, vence_el) where anulado_en is null`, `pago_aplicaciones (cargo_id)`.
- `inscripciones (cohorte_id) where estado = 'inscrito'` y el único parcial.
- `estudiantes using gin (nombre_busqueda extensions.gin_trgm_ops)` y el único de documento.
- `prestamos (sede_id, devolver_el) where cerrado_en is null`.
- Toda fk con su índice (lo piden los asesores de rendimiento).

Cada migración se mide con volumen dentro de una transacción revertida
(50 000 movimientos, 5 000 cobros): el tablero debe responder en menos de un
segundo.

### 2.10 Migraciones nuevas (en orden de construcción)

| Archivo | Contenido | Rebanada |
|---|---|---|
| `20261002120000_panel_nucleo.sql` | Permisos, funciones `app.*` de §2.1, `operaciones`, `periodos`, `auditoria`, `mi_contexto()`, reglas nuevas de `solicitudes` | R1 |
| `20261002120100_alumnos_grupos_y_cargos.sql` | `estudiantes`, `cohortes`, `conceptos`, `planes_de_pago`, `inscripciones`, `cargos`, RPC de alumnos | R2 |
| `20261002120200_caja.sql` | `pagos`, `pago_aplicaciones`, `gastos`, `cierres_de_caja`, RPC de caja | R3 |
| `20261002120300_inventario.sql` | Las 13 tablas de §2.5, motor PEPS y promedio, RPC de inventario | R4–R5 |
| `20261002120400_contabilidad_y_tableros.sql` | Vistas de resumen, `verificar_cuadre`, `cerrar_mes`, `reabrir_mes`, tableros | R6–R7 |

Tras cada una: regenerar `tipos-de-base.generados.ts`, actualizar
`supabase/migrations/README.md`, correr su batería en
`docs/runbooks/pruebas-rls-panel-v1.sql` y `get_advisors` de seguridad y de
rendimiento.

### 2.11 Cambios en el dominio TypeScript (`core/domain`)

| Archivo | Cambio |
|---|---|
| `inventario/articulo.ts` | `COMPORTAMIENTO_POR_TIPO` gana `valuacion` (`peps`/`promedio`), `admiteUso`, `admiteEntrega`, `admitePrestamo`, `controlaVencimiento`. **El utensilio deja de «entregarse y devolverse» y pasa a prestarse**; el uniforme se entrega; `precioVenta` opcional en uniformes |
| `inventario/movimiento.ts` | Tipos de §2.5. **Desaparece `SIGNO_POR_TIPO.ajuste = 0`**. `aplicarMovimiento` trabaja con deltas de disponible y prestado. El conteo (`existenciaVista`, `contado`) produce `ajuste_faltante` o `ajuste_sobrante` |
| `inventario/valuacion.ts` (nuevo) | `salidaPeps(lotes, cantidad, hoy)` y `salidaPromedio(saldo, cantidad)` con la **misma fórmula que la base**: `Math.round` con la mitad hacia arriba sobre enteros de centavos, y la salida que agota se lleva el resto exacto. Los ejemplos de §5.8 son casos de prueba compartidos con la batería SQL |
| `inventario/entrega.ts` | Sin el contexto `sesion` (P10); `devolucion` y `cambio_de_talla` |
| `inventario/prestamo.ts` (nuevo) | Préstamo, devolución y pérdida |
| `estudiantes/estudiante.ts` | `EstadoDeInscripcion = 'inscrito' \| 'retirado' \| 'concluido'`; `ESTADOS_VIGENTES = ['inscrito']`; `Inscripcion` gana `solicitudId` y `renuevaA` |
| `academico/programa.ts` | `nombreDeGrupo(cohorte, programa, sede)`; `validarCohorte`; `PlanDePago` y `generarCuotas(plan, fechaDeInscripcion)` |
| `caja/` (nuevo) | `cargo.ts`; `cobro.ts` (aplicar del más antiguo al más nuevo, referencia obligatoria en QR); `arqueo.ts` (esperado y diferencia); `montoEnLetras()` para el recibo |
| `contabilidad/resumen.ts` (nuevo) | Resultado del mes y flujo de dinero a partir de totales |
| `shared/` | `cantidad.ts` (3 decimales, coma decimal, unidad) |

---

## 3. Funciones RPC y políticas RLS

### 3.1 Patrón: fachada `INVOKER` en `public`, motor `DEFINER` en `app` (D1)

```text
Server Action ──► public.usar_insumos(...)        SECURITY INVOKER, language sql, una línea:
                                                  select app.usar_insumos(...)
                     └─► app.usar_insumos(...)    SECURITY DEFINER, set search_path = '', plpgsql
                            ├─ app.exigir_permiso('inventario.operar')   → sin_permiso
                            ├─ app.exigir_sede(p_sede)                   → sede_no_operable
                            ├─ app.iniciar_operacion(p_clave, 'uso')     → resultado previo o null
                            ├─ validaciones, bloqueos, motor PEPS / promedio
                            └─ escribe movimientos, costos, saldos; app.terminar_operacion(...)
```

- El esquema `app` **no está expuesto** por PostgREST: solo se llega por la
  fachada. Aun así, cada función de `app` **comprueba el permiso en su
  primera línea**, porque DEFINER salta la RLS.
- `auth.uid()` dentro de la DEFINER sigue siendo el de quien llama: el autor
  y los disparadores existentes de `solicitudes` funcionan igual.
- Grants: `revoke all … from public, anon` en las dos funciones; `grant
  execute … to authenticated` en las dos (la fachada corre como
  `authenticated`). La batería comprueba que `anon` recibe `permission denied`.
- Todas se escriben como `create or replace function` (la prueba del
  repositorio vigila esa forma).
- Una RPC **nunca nombra columnas que rellena un disparador** (lección de
  GoldGym).
- Todas devuelven `jsonb` con lo necesario para la confirmación: ids, número
  de documento o de recibo y, por línea de inventario, `antes` y `ahora`. Los
  **valores en Bs solo se incluyen** si quien llama tiene `contabilidad.leer`.

### 3.2 Plantilla de una función del motor

1. `perform app.exigir_permiso(...)`; `perform app.exigir_sede(p_sede)` si opera en una sede.
2. `v_previo := app.iniciar_operacion(p_clave, '<tipo>')`; si no es nulo, `return v_previo`.
3. Validar **todo** antes de escribir; los errores de forma salen juntos en `datos_invalidos` (el detalle lista los campos).
4. Bloquear en el orden fijo de §3.12.
5. Escribir; exigir el período abierto de la fecha que se usa.
6. `perform app.terminar_operacion(p_clave, v_resultado)` y `return v_resultado`.

### 3.3 Idempotencia (D20)

Cada formulario lleva una clave `uuid` que se genera al dibujarlo.
`app.iniciar_operacion` hace `insert into operaciones (clave, tipo) values (…)
on conflict (clave) do nothing returning clave`:

- si inserta, la operación sigue;
- si choca, **espera** a que termine la transacción que tiene la clave (es lo
  que hace el índice único) y lee su `resultado`: si es del mismo usuario y del
  mismo tipo, lo devuelve sin repetir nada; si no, lanza `clave_reutilizada`;
- si la primera transacción falló, su fila no existe y esta sigue normalmente.

Así un doble clic, una red lenta o recargar la página **nunca cobra dos veces**.

### 3.4 Errores tipados

```sql
raise exception using errcode = 'P0001', message = 'stock_insuficiente',
  detail = jsonb_build_object('articulo', 'Harina de trigo', 'disponible', 2.5,
                              'pedido', 3, 'vencido', 1, 'unidad', 'kg')::text;
```

- El **mensaje es el código** (`^[a-z_]+$`) y el **detalle** trae los datos de
  la frase. La falta de permiso usa `errcode = '42501'` y `message = 'sin_permiso'`.
- `infrastructure/supabase/errores.ts` gana `traducirErrorDePanel(error)`: si
  el código está en `MENSAJES_DE_PANEL`, arma la frase de §8.5 con el detalle;
  si no, delega en `traducirErrorDeBase` y muestra el genérico. El código
  queda siempre en el registro del servidor; ningún texto de PostgreSQL llega
  a la pantalla.
- **Prueba nueva** `tests/errores-de-panel.test.ts`: extrae cada
  `message = '<codigo>'` de `supabase/migrations/*.sql` y exige su traducción,
  y que cada traducción corresponda a un código que existe.

Códigos comunes a casi todas: `sin_permiso`, `sede_no_operable`,
`sede_no_asignada`, `periodo_cerrado`, `datos_invalidos`, `clave_reutilizada`.

### 3.5 Piezas internas del motor (`app`, DEFINER)

| Función | Qué hace |
|---|---|
| `app.bloquear_saldo(variante, sede)` | Crea la fila de `existencias` y `existencias_costo` si falta y la bloquea `for update` |
| `app.entrar(variante, sede, cantidad, valor, vence_el, mov)` | PEPS: crea `lotes`, `lotes_costo` y `movimiento_lotes`. Promedio: suma a la capa |
| `app.sacar(variante, sede, cantidad, mov, lote_elegido) returns bigint` | Salida PEPS o promedio según `articulos.valuacion` (§5); devuelve el valor que salió |
| `app.registrar_movimiento(...) returns uuid` | Inserta `movimientos` y `movimientos_costo` con los saldos resultantes |
| `app.revertir(mov, motivo) returns uuid` | Asiento `anulacion` que deshace exactamente el original: mismos lotes, mismo valor (aunque el lote ya esté agotado) |
| `app.siguiente_recibo(sede, anio) returns bigint` | `pg_advisory_xact_lock(hashtext('recibo:' ‖ sede ‖ anio))` y `coalesce(max(numero), 0) + 1`: sin huecos, porque una transacción revertida no deja número |
| `app.generar_cuotas(inscripcion, plan)` | Un cargo por cuota: `vence_el = primer_vencimiento + (k − 1) × cada_meses meses`; `fecha` según §5.7 |
| `app.totales_de_caja(sede) returns record` | Totales de lo no arqueado de la sede (columnas fijas, sin detalle). Exige `caja.leer` y `app.puede_operar_sede(sede)` en su primera línea, porque la llaman los tableros `INVOKER` |
| `app.nombre_de_grupo(cohorte) returns text` | Nombre visible del grupo |

### 3.6 RPC de inventario

| Función | Qué hace en una sola transacción | Permiso | Errores propios |
|---|---|---|---|
| `guardar_articulo(p_clave, p_datos jsonb, p_variantes text[])` | **Solo el alta**: crea el artículo con su código y sus variantes («Única» si no se indican; tallas en uniformes). Editar es escritura directa (§3.9), donde el disparador lanza `tipo_bloqueado` si ya hay movimientos. Auditoría | `inventario.catalogo` | `nombre_repetido`, `unidad_no_admitida`, `insumo_una_variante`, `variantes_invalidas`, `precio_solo_uniforme` |
| `registrar_saldo_inicial(p_clave, p_sede, p_lineas)`; líneas `{variante, cantidad, valor, vence_el?}` | Puesta en marcha: un `conteo` de clase `saldo_inicial` y un movimiento `saldo_inicial` por línea (lote o capa). **No** es salida de dinero | `inventario.ajustar` | `ya_tiene_movimientos`, `cantidad_invalida`, `cantidad_no_entera`, `vencimiento_requerido` |
| `registrar_compra(p_clave, p_sede, p_fecha_documento, p_proveedor, p_comprobante, p_numero_comprobante, p_medio, p_referencia, p_lineas)`; líneas `{variante, cantidad, costo_total, vence_el?, presentacion?}` | Crea la compra; por línea: bloqueo, movimiento `compra`, lote (PEPS) o suma a la capa (promedio) y su costo. Verifica `total = Σ costo_total`. En efectivo, la salida entra en el próximo arqueo | `inventario.comprar` | `sin_lineas`, `linea_repetida`, `demasiadas_lineas` (> 30), `articulo_inactivo`, `cantidad_invalida`, `cantidad_no_entera`, `monto_invalido`, `vencimiento_requerido`, `vencimiento_pasado`, `referencia_requerida` |
| `usar_insumos(p_clave, p_sede, p_destino, p_cohorte uuid null, p_detalle, p_lineas)`; líneas `{variante, cantidad}` | Un movimiento `consumo` por línea con salida PEPS (insumo) o promedio (otro), sin lotes vencidos. Devuelve de qué compras salió | `inventario.operar` | `uso_no_admitido`, `stock_insuficiente` (detalle con lo vencido), `grupo_no_corresponde`, `detalle_requerido` (destino `otro`) |
| `dar_de_baja(p_clave, p_sede, p_variante, p_cantidad, p_motivo_baja, p_detalle, p_lote uuid null)` | Movimiento `baja`. Vencimiento: exige el lote y saca **ese** lote. Otros motivos: PEPS o promedio sobre lo disponible | `inventario.operar` | `detalle_requerido`, `lote_requerido`, `lote_no_corresponde`, `lote_no_vencido` (usa «Dañado»), `stock_insuficiente` |
| `registrar_conteo(p_clave, p_sede, p_lineas)`; líneas `{variante, existencia_vista, contado, motivo?, valor?, vence_el?}` | Bloquea los saldos en orden; si en alguna línea `disponible <> existencia_vista`, falla entero. Por línea: faltante (salida), sobrante (entrada al último costo, o al `valor` indicado) o constancia. Un solo documento | `inventario.ajustar` | `existencia_cambio` (detalle: líneas con su vista y su saldo actual), `motivo_requerido`, `costo_requerido`, `linea_repetida`, `cantidad_no_entera` |
| `entregar_uniforme(p_clave, p_inscripcion, p_sede, p_contexto, p_detalle, p_lineas, p_cargar bool, p_cobro jsonb null)`; cobro `{medio, referencia}` | Por línea: entrega y movimiento `entrega` a costo promedio. Si `p_cargar` y el artículo tiene precio: cargo «Venta de uniforme» (precio × cantidad). Si viene `p_cobro`: cobro aplicado a ese cargo, con recibo | `inventario.operar` (+ `caja.cobrar` si carga o cobra) | `inscripcion_no_vigente`, `entrega_no_admitida`, `talla_requerida`, `stock_insuficiente`, `precio_no_definido`, `detalle_requerido`, errores de cobro |
| `devolver_uniforme(p_clave, p_entrega, p_cantidad, p_motivo, p_cambiar_por uuid null)` | Movimiento `devolucion_entrega` al costo con que salió; sube `devuelta`. Con `p_cambiar_por`: nueva entrega `cambio_de_talla` de otra talla del mismo artículo, **sin cargo** | `inventario.operar` | `devolucion_excede`, `motivo_requerido`, `talla_igual`, `pieza_distinta`, `stock_insuficiente` |
| `prestar_utensilios(p_clave, p_sede, p_estudiante, p_cohorte, p_persona, p_devolver_el, p_lineas)` | Un préstamo y un movimiento `prestamo` por línea (de disponible a prestado; **el valor no cambia**) | `inventario.operar` | `destinatario_requerido`, `prestamo_no_admitido`, `stock_insuficiente`, `fecha_de_devolucion_invalida` |
| `recibir_devolucion(p_clave, p_lineas)`; líneas `{prestamo, devueltos, perdidos, motivo?}` | `devolucion_prestamo` por lo que volvió; `baja` (`perdida` o `rotura`) desde «prestado», a costo promedio, por lo que no volvió; cierra el préstamo si ya no queda nada fuera | `inventario.operar` | `devolucion_excede`, `prestamo_cerrado`, `motivo_requerido` |

Las entregas y los préstamos **no se anulan, se devuelven**: es lo que pasó y
la historia queda completa.

### 3.7 RPC de alumnos

| Función | Qué hace en una sola transacción | Permiso | Errores propios |
|---|---|---|---|
| `inscribir(p_clave, p_estudiante uuid null, p_ficha jsonb null, p_cohorte, p_paquete, p_documentos text[], p_renueva_a uuid null, p_observaciones)` | Crea la ficha si no hay `p_estudiante`. Valida grupo (`abierto` o `en_curso`), cupo (bloquea el grupo), paquete (E5) y duplicado (E1). Crea la inscripción y **sus cuotas** según el plan del grupo y paquete; sin plan, inscribe sin cuotas y lo avisa. En una renovación, la anterior pasa a `concluido` | `inscripciones.gestionar` (+ `estudiantes.gestionar` si crea ficha) | `grupo_no_disponible`, `grupo_lleno` (detalle: capacidad), `paquete_requerido`, `paquete_no_admitido`, `ya_inscrito`, `documento_duplicado` (detalle: código y nombre), `renovacion_no_corresponde` (no es el año siguiente del mismo programa) |
| `aprobar_solicitud(p_clave, p_solicitud, p_cohorte, p_paquete, p_documentos, p_respuesta)` | Pasos debajo de la tabla | `solicitudes.gestionar` + `inscripciones.gestionar` | `solicitud_no_encontrada`, `solicitud_cerrada`, `grupo_no_corresponde`, `documento_de_otro_estudiante` y los de `inscribir` |
| `cambiar_estado_de_inscripcion(p_clave, p_inscripcion, p_estado, p_motivo)` | `inscrito → retirado` (motivo obligatorio) o `→ concluido`. Las cuotas pendientes no se tocan: si corresponde, administración las anula | `inscripciones.gestionar` | `transicion_no_valida`, `motivo_requerido` |
| `generar_cuotas_de_grupo(p_clave, p_cohorte)` | Cuando administración carga el plan de un grupo que ya tiene inscritos, crea las cuotas de cada inscrito que aún no las tiene | `contabilidad.gestionar` | `sin_plan_de_pagos` |

Pasos de `aprobar_solicitud`:
1. Bloquea la solicitud `for update`; exige `pendiente` o `en_revision`.
2. Exige que el grupo sea del **mismo programa** (y avisa si la sede o el turno difieren).
3. Busca la ficha por `perfil_id = solicitud.estudiante_id`; si no, por documento (si hay una sola ficha **sin cuenta** con ese documento, la enlaza); si no, la crea con los datos del perfil.
4. Inscribe con `solicitud_id` (misma lógica que `inscribir`). En una renovación, enlaza `renueva_a` con la inscripción vigente del mismo programa y exige que el grupo sea del año siguiente.
5. Pasa la solicitud a `aprobada` con la respuesta (el disparador anota quién y cuándo, y comprueba que la inscripción existe).

Poner «en revisión» o «rechazar» sigue siendo el `update` directo de hoy
(`estado`, `respuesta`); rechazar exige respuesta.

### 3.8 RPC de caja y contabilidad

| Función | Qué hace en una sola transacción | Permiso | Errores propios |
|---|---|---|---|
| `registrar_cobro(p_clave, p_sede, p_estudiante uuid null, p_medio, p_referencia, p_aplicaciones jsonb, p_venta jsonb null, p_nota)`; aplicaciones `[{cargo, monto}]`; venta `{concepto, descripcion, monto, cliente?}` | Bloquea los cargos (orden de id), exige que sean del alumno y no anulados, y que lo aplicado no supere lo pendiente. Con `p_venta`, primero crea el cargo de venta directa. Crea el cobro con su **recibo sin huecos** y las aplicaciones (suma = monto). Devuelve el recibo y el saldo que queda | `caja.cobrar` | `cargo_de_otro_alumno`, `cargo_anulado`, `aplicacion_excede_saldo` (detalle: pendiente), `cobro_sin_aplicar`, `referencia_requerida`, `referencia_repetida` (detalle: recibo existente), `monto_invalido`, `concepto_no_es_ingreso` |
| `crear_cargo(p_clave, p_estudiante, p_inscripcion, p_concepto, p_descripcion, p_monto, p_vence_el, p_prestamo uuid null)` | Cargo manual (reposición de un utensilio perdido, enlazado a su préstamo; una corrección) | `contabilidad.gestionar` | `concepto_no_es_ingreso`, `monto_invalido`, `inscripcion_de_otro_alumno` |
| `registrar_gasto(p_clave, p_sede, p_fecha, p_concepto, p_descripcion, p_monto, p_medio, p_referencia, p_comprobante, p_numero_comprobante, p_proveedor)` | Registra el gasto. En efectivo, fecha de hoy y salida en el próximo arqueo | `contabilidad.gestionar` | `concepto_no_es_gasto`, `referencia_requerida`, `fecha_invalida`, `monto_invalido`, `detalle_requerido` |
| `caja_por_cerrar(p_sede)` | Solo lectura: saldo inicial, entradas y salidas de efectivo no arqueadas, esperado, QR y transferencias, número de registros, hora del último arqueo. **La misma cuenta que hará el cierre** | `caja.cerrar` y sede operable (administración: cualquiera) | `sede_no_operable` |
| `cerrar_caja(p_clave, p_sede, p_contado, p_retiro, p_observacion, p_saldo_inicial bigint null)` | Toma el candado de la caja de la sede; marca `cierre_id` (y `anulacion_cierre_id`) en todo lo no arqueado con `update … returning` y calcula los totales **de esas mismas filas**; guarda el arqueo. `p_saldo_inicial` solo se acepta en el primer arqueo de la sede | `caja.cerrar` | `nada_que_arquear`, `observacion_requerida`, `retiro_excede`, `saldo_inicial_no_admitido` |
| `revisar_cierre(p_clave, p_cierre, p_nota)` | Marca como revisado un arqueo con diferencia | `caja.supervisar` | `ya_revisado` |
| `verificar_cobros_qr(p_clave, p_pagos uuid[])` | Marca como verificados los cobros cotejados con el banco | `caja.supervisar` | `no_es_qr` (se omite y se informa) |
| `cerrar_mes(p_clave, p_mes date)` | Exige: mes terminado; mes anterior cerrado (salvo el primer mes con datos); ningún efectivo del mes sin arqueo; `verificar_cuadre(mes)` vacía. Guarda la fotografía del resumen y deja auditoría | `contabilidad.cerrar_mes` | `mes_en_curso`, `mes_ya_cerrado`, `mes_anterior_abierto`, `efectivo_sin_arqueo` (detalle: sedes y días), `cuadre_fallido` (detalle: primeras diferencias) |
| `reabrir_mes(p_clave, p_mes, p_motivo)` | Reabre **el último** mes cerrado, con motivo y auditoría | `contabilidad.cerrar_mes` | `mes_no_es_el_ultimo`, `motivo_requerido` |

### 3.9 RPC comunes y escrituras directas

| Función | Qué hace | Permiso | Errores propios |
|---|---|---|---|
| `anular(p_clave, p_tipo, p_id, p_motivo)` | **Una sola forma de anular** (D8, D9). Reglas por tipo en la tabla siguiente | `caja.anular` (cobro, cargo, gasto) · `inventario.anular` (compra, uso, baja) | `documento_no_encontrado`, `ya_anulado`, `motivo_requerido` y los de cada tipo |
| `cambiar_acceso_de_personal(p_clave, p_perfil, p_rol, p_sede, p_activo)` | Cambia rol, sede o estado de una cuenta ya registrada (usa la guarda `app.proteger_perfil`) | `perfiles.gestionar` | `cuenta_no_encontrada`, `cuenta_propia`, `ultimo_administrador`, `sede_requerida` (personal sin sede) |
| `mi_contexto()` (INVOKER) | Perfil, rol, permisos, sede y sedes operables de la sesión | Sesión | — |
| `tablero_recepcion(p_sede)` · `tablero_administracion(p_sede uuid null)` (INVOKER) | Cada tablero en **una** llamada; leen las vistas de §2.6 y `app.totales_de_caja` | `panel.entrar` | — |

| Tipo en `anular` | Regla | Efecto |
|---|---|---|
| `compra` | Solo si **nada de lo comprado se movió después**: lotes intactos (PEPS) o ninguna salida posterior de esa variante y sede (promedio) | Asientos `anulacion` por cada línea; sello en la compra; si fue en efectivo, el dinero vuelve en el próximo arqueo. Error: `compra_con_movimientos_posteriores` |
| `uso` (`p_id` = la operación) | Siempre | Asientos `anulacion` que devuelven cada cantidad y su valor a los mismos lotes |
| `baja` | Siempre | Asiento `anulacion` |
| `cobro` | Siempre | Sello; sus aplicaciones dejan de contar (las vistas ignoran cobros anulados) y los cargos vuelven a quedar pendientes; en efectivo, salida en el próximo arqueo; el recibo muestra «ANULADO» |
| `cargo` | Solo sin cobros vigentes aplicados | Sello. Error: `cargo_con_cobros` |
| `gasto` | Siempre | Sello; en efectivo, el dinero vuelve en el próximo arqueo |

**Escrituras directas** (una fila, sin dinero ni existencias; RLS, grants por
columna, disparadores de validación y auditoría):

| Tabla | Grants a `authenticated` | Política |
|---|---|---|
| `estudiantes` | `insert/update (nombres, apellidos, documento, telefono, correo, fecha_de_nacimiento, sede_id, observaciones)`; `update (archivado_en, archivado_motivo)` | `estudiantes.gestionar`; archivar con `estudiantes.archivar` (disparador) |
| `cohortes` | `insert/update` de sus columnas | `cohortes.gestionar` |
| `planes_de_pago` | `insert/update/delete` (el disparador congela al primer cargo) | `contabilidad.gestionar` |
| `conceptos` | `insert/update (nombre, grupo, icono, activo)` | `contabilidad.gestionar` (los `del_sistema` no se desactivan) |
| `articulos` | `update (nombre, categoria, icono, stock_minimo, controla_vencimiento, precio_venta, activo)`; el alta va por `guardar_articulo` | `inventario.catalogo` |
| `variantes` | `insert/update (etiqueta, orden, activa)` | `inventario.catalogo` (insumo: una sola) |
| `inscripciones` | `update (documentos_entregados, observaciones)` | `inscripciones.gestionar` |
| `solicitudes` | `update (estado, respuesta)` (ya existe) | `solicitudes.gestionar` |

### 3.10 RLS por tabla

Comunes a todas: `enable row level security`; `revoke all … from anon,
authenticated` y luego solo lo necesario; condiciones envueltas en `(select
app.tiene_permiso('…'))` para evaluarse una vez por consulta; **`anon` no lee
nada nuevo**; **el estudiante no ve nada del panel** (no tiene ninguno de estos
permisos).

| Tabla(s) | `select` | Escritura |
|---|---|---|
| `estudiantes` | `estudiantes.leer` | §3.9 y RPC |
| `cohortes`, `planes_de_pago`, `conceptos` | `cohortes.leer` (conceptos: `caja.leer`) | §3.9 |
| `inscripciones` | `estudiantes.leer` | §3.9 y RPC |
| `articulos`, `variantes`, `existencias`, `lotes`, `movimientos`, `entregas`, `prestamos` | `inventario.leer` | RPC (y §3.9) |
| `existencias_costo`, `lotes_costo`, `movimientos_costo`, `movimiento_lotes`, `compras`, `conteos` | `contabilidad.leer` | RPC |
| `cargos`, `pagos`, `pago_aplicaciones`, `cierres_de_caja` | `caja.leer`: recepción las lee **todas**, para que las sumas de saldos sean ciertas | RPC |
| `gastos` | `contabilidad.leer` | RPC |
| `periodos` | `panel.entrar` | RPC |
| `auditoria` | `auditoria.leer` | Motor y disparadores |
| `operaciones` | Nadie | Motor |

### 3.11 Batería RLS (`docs/runbooks/pruebas-rls-panel-v1.sql`)

Sesiones simuladas en una transacción que se revierte, como la de la entrega
2. Comprueba, entre otros:

- recepción **no** lee `compras`, `gastos`, `conteos` ni ninguna `*_costo`, y
  recibe `sin_permiso` en `registrar_compra`, `registrar_conteo`, `anular`,
  `registrar_gasto`, `cerrar_mes`;
- recepción de La Paz recibe `sede_no_operable` al operar en El Alto, pero
  **lee** existencias de El Alto;
- el estudiante ve 0 filas en todas las tablas nuevas y recibe `sin_permiso`
  en todas las RPC; `anon` recibe `permission denied`;
- nadie puede `insert/update/delete` directo en el libro, ni siquiera con un
  permiso (42501 o `libro_inmutable`);
- un doble envío con la misma clave devuelve el mismo resultado;
- `aprobar` directo por `update` falla con `aprobar_inscribiendo`;
- `verificar_cuadre()` vacía tras cada escenario; las 39 pruebas de la
  entrega 2 siguen en verde; `get_advisors(security)` sin avisos.

### 3.12 Concurrencia

- **Orden fijo de bloqueos**: `existencias` (por `variante_id`) → `lotes` (por
  `fecha_ingreso, secuencia`) → grupo (cupos) → `cargos` (por id) → candado
  de recibo (sede y año) → candado de caja (sede). Dos documentos simultáneos
  nunca se esperan en círculo.
- Si dos personas usan la última harina a la vez, la segunda espera
  milisegundos y recibe `stock_insuficiente`.
- Los cobros, gastos y compras **en efectivo** y `cerrar_caja` toman el
  candado de la caja de su sede: nada entra «a medias» en un arqueo.
- El botón se desactiva al enviar; si aun así llegan dos envíos, la clave de
  `operaciones` devuelve el mismo documento.

---

## 4. Matriz de permisos

### 4.1 Permisos (`permisos_de_rol`; todos cumplen `^[a-z_]+\.[a-z_]+$`)

| Permiso | Qué permite | Administración | Recepción |
|---|---|:-:|:-:|
| `panel.entrar` | Entrar a `/panel` | ✓ | ✓ |
| `sedes.todas` | Operar en cualquier sede | ✓ | — |
| `perfiles.leer` (existe) | Ver cuentas | ✓ | ✓ |
| `perfiles.gestionar` (existe) | Rol, sede y estado de las cuentas | ✓ | — |
| `sedes.gestionar`, `programas.gestionar` (existen) | Sedes y programas | ✓ | — |
| `solicitudes.leer`, `solicitudes.gestionar` (existen) | Bandeja del portal | ✓ | ✓ |
| `estudiantes.leer` | Fichas e inscripciones | ✓ | ✓ |
| `estudiantes.gestionar` | Crear y editar fichas | ✓ | ✓ |
| `estudiantes.archivar` | Archivar una ficha | ✓ | — |
| `cohortes.leer` | Grupos, cupos y precios (para informar) | ✓ | ✓ |
| `cohortes.gestionar` | Abrir, editar y cerrar grupos | ✓ | — |
| `inscripciones.gestionar` | Inscribir, renovar, aprobar solicitudes, retirar | ✓ | ✓ |
| `inventario.leer` | Existencias, lotes, vencimientos, kárdex sin costos, préstamos | ✓ | ✓ |
| `inventario.operar` | Usar insumos, entregar uniformes, prestar, recibir, dar de baja | ✓ | ✓ |
| `inventario.catalogo` | Artículos, tallas, mínimos, precio del uniforme | ✓ | — |
| `inventario.comprar` | Registrar compras | ✓ | — |
| `inventario.ajustar` | Conteo físico y saldo inicial | ✓ | — |
| `inventario.anular` | Anular compras, usos y bajas | ✓ | — |
| `caja.leer` | Cargos, cobros, lo que deben, arqueos | ✓ | ✓ |
| `caja.cobrar` | Cobrar, vender, cargar el uniforme al entregarlo | ✓ | ✓ |
| `caja.cerrar` | Arquear la caja de su sede | ✓ | ✓ |
| `caja.anular` | Anular cobros, cargos y gastos | ✓ | — |
| `caja.supervisar` | Verificar QR y revisar arqueos con diferencia | ✓ | — |
| `contabilidad.leer` | Costos, valor del inventario, compras, gastos, resumen del mes | ✓ | — |
| `contabilidad.gestionar` | Gastos, conceptos, planes de pago, cargos manuales | ✓ | — |
| `contabilidad.cerrar_mes` | Cerrar y reabrir meses | ✓ | — |
| `auditoria.leer` | Ver la auditoría | ✓ | — |

Principio de control: **quien cobra no anula**. Recepción registra;
administración anula y revisa. Las bajas que registra recepción aparecen con
su valor en el tablero de administración: se controla revisando, sin frenar
la operación. Cambiar lo que hace recepción es insertar o borrar una fila.

### 4.2 Qué ve cada uno

| | Administración (Carla) | Recepción (Rosa, La Paz) |
|---|---|---|
| Menú | Inicio · Alumnos · Inventario · Caja · Contabilidad · Ajustes | Inicio · Alumnos · Inventario · Caja |
| Sedes | Selector «Ambas · La Paz · El Alto» (cookie HttpOnly; es preferencia, no permiso); opera en la elegida | Solo la suya; **consulta** existencias y grupos de las dos («en El Alto sí hay talla M») |
| Alumnos | Todo, más archivar, abrir grupos y cargar planes | Buscar, fichas, inscribir, renovar, solicitudes; grupos en lectura (cupos y precios para informar) |
| Inventario | Todo, con costo y valor, compras, conteo, anulaciones y catálogo | Existencias y kárdex **sin costos**, lotes y vencimientos, usar, entregar, prestar, recibir, dar de baja |
| Caja | Todo, más anular, verificar QR y revisar arqueos | Cobrar, recibos, lo que deben, arquear su caja |
| Contabilidad y Ajustes | Sí | No aparecen |
| Estudiante | — | — (`/panel` lo devuelve a `/portal`) |

### 4.3 Alcance por sede

La sede de trabajo sale de `perfiles.sede_id`. Recepción opera **solo en su
sede** y la base lo vuelve a exigir en cada RPC (`app.puede_operar_sede`). Un
miembro del personal sin sede no opera (`sede_no_asignada`) hasta que
administración se la asigne.

---

## 5. Valuación y contabilidad básica

### 5.1 Conceptos en una línea (también es la ayuda de la pantalla)

| Concepto | En simple |
|---|---|
| Kárdex (historial) | Cada entrada y salida de un artículo, con lo que queda después |
| Lote | Lo que llegó en una misma compra, con su fecha, su vencimiento y su costo; en pantalla, «la compra del 12/09» |
| PEPS | «Lo primero que entra es lo primero que sale», y sale **a lo que costó** |
| Costo promedio ponderado | Cada pieza vale lo mismo: lo que costaron todas juntas entre cuántas hay |
| Costo de lo usado | Lo que valía el inventario que salió; es costo del mes aunque se haya pagado antes |
| Merma y baja | Lo que se pierde, se rompe o se vence; se saca del inventario explicando por qué |
| Valor del inventario | Cuánto dinero está «guardado» en el almacén ahora |
| Conteo físico | Contar el estante y corregir el sistema por la diferencia |
| Cargo | Lo que el alumno debe |
| Cobro | El dinero que entró, con su recibo |
| Arqueo | Contar el efectivo y compararlo con lo que debería haber |

### 5.2 Dos métodos, un solo motor

Los insumos se vencen; los uniformes van por tallas idénticas; los utensilios
se prestan y vuelven. Un único método forzaría alguno de estos casos; dos
motores duplicarían los errores. Por eso los dos métodos comparten las mismas
piezas: saldo bloqueado, capas de costo y la **fórmula proporcional con
remanente exacto**. PEPS tiene **muchas capas** (los lotes) y el promedio
**una sola** (`existencias_costo`).

PEPS y promedio ponderado son los dos métodos de costeo más usados (la NIC 2
admite ambos). **El contador del instituto debe validar la elección**; el
método va unido al tipo de artículo y no se cambia por mes.

### 5.3 Insumos: PEPS

**Entrada** (compra, saldo inicial, sobrante): se crea un lote con
`cantidad_inicial = cantidad_restante = q` y `valor_inicial = valor_restante =
lo pagado por la línea` (el total, no un unitario redondeado; el costo por
unidad solo se **muestra**). `existencias.disponible += q`;
`existencias_costo.valor += valor`.

**Salida** (uso en clase, baja sin lote elegido, faltante):

```text
sacar_peps(variante, sede, q, hoy, lote_elegido = null):
  bloquear existencias(variante, sede)
  pendiente := q ; total := 0
  para cada lote L con cantidad_restante > 0
        y (lote_elegido es null   → L no vencido: vence_el es null o vence_el >= hoy)
        y (lote_elegido no es null → L.id = lote_elegido)
      en orden (fecha_ingreso, secuencia), bloqueando L:
    toma  := mínimo(pendiente, L.cantidad_restante)
    valor := si toma = L.cantidad_restante
               entonces L.valor_restante                                  -- remanente exacto
               si no round(L.valor_restante × toma / L.cantidad_restante) -- a centavos
    L.cantidad_restante -= toma ; L.valor_restante -= valor
    movimiento_lotes(mov, L, toma, valor)
    pendiente -= toma ; total += valor
    salir si pendiente = 0
  si pendiente > 0 → stock_insuficiente {disponible usable, pedido, vencido}  (se revierte todo)
  existencias.disponible -= q ; existencias_costo.valor -= total
  devolver total
```

`round` sobre `numeric` en PostgreSQL redondea la mitad hacia arriba con
valores positivos; `Math.round` en el dominio hace lo mismo con enteros de
centavos.

**Ejemplo (cifras ficticias): harina de trigo en La Paz.** Cada celda: «queda ·
valor que queda en centavos».

| Paso | Lote A (hace 20 días) | Lote B (hace 5 días) | Costo de la salida |
|---|---|---|---|
| Compra A: 25 kg por Bs 170,00 | 25 · 17 000 | — | — |
| Compra B: 25 kg por Bs 180,00 | 25 · 17 000 | 25 · 18 000 | — |
| Uso de 30 kg (1.er año) | **0 · 0** (todo el resto: 17 000) | 20 · 14 400 (5 kg: round(18 000 × 5 / 25) = 3 600) | **20 600 c = Bs 206,00** |
| Uso de 0,333 kg | — | 19,667 · 14 160 (round(14 400 × 0,333 / 20) = 240) | 240 c |
| Uso de 19,667 kg | — | **0 · 0** (todo el resto: 14 160) | 14 160 c |
| **Suma de salidas** | | | 17 000 + 3 600 + 240 + 14 160 = **35 000 c**, igual a lo pagado ✓ |

**Vencimientos.** Un lote está **por vencer** si vence en 7 días o menos y
**vencido** si `vence_el < hoy`. El uso en clase **salta los vencidos** (D14);
si lo vigente no alcanza, el error dice cuánto hay vencido y ofrece «Dar de
baja». La baja por vencimiento saca **ese** lote (es lo que se tira). Si un
lote más nuevo vence antes que uno más antiguo, la pantalla de uso lo avisa;
el costo sigue el orden PEPS.

**Conteo** (D15, D16): faltante → `ajuste_faltante` por PEPS (merma);
sobrante → lote nuevo `sobrante` con fecha de hoy, valorizado al costo por
unidad del **último lote ingresado** (`round(valor_inicial × q /
cantidad_inicial)`), o al costo que escribe administración si nunca hubo
lote; si el artículo controla vencimiento, se pide la fecha. Sin diferencia,
no hay movimiento: la línea queda como constancia.

**Anulación** de un uso o una baja: por cada fila de `movimiento_lotes`, el
mismo lote recupera esa cantidad y ese valor, aunque estuviera agotado. Una
compra solo se anula con sus lotes intactos.

### 5.4 Uniformes: costo promedio ponderado

```text
entrada(q, valor):  total += q ; valor_capa += valor
salida(q):          valor := si q = total entonces valor_capa
                             si no round(valor_capa × q / total)
                    total -= q ; valor_capa -= valor
devolución:         vuelve AL COSTO CON QUE SALIÓ: round(valor_entrega × q / cantidad_entrega);
                    la última pieza devuelta de esa entrega se lleva el resto exacto
costo promedio (solo se muestra) = valor_capa / total
```

**Por qué promedio:** los juegos de una talla son idénticos e
intercambiables, se compran por tandas y se venden a precio fijo; un solo
número por talla («cada juego M nos cuesta en promedio Bs 320») se explica
en una frase y da el margen frente a los Bs 650. Con PEPS habría que devolver
cada pieza a un lote concreto.

**Ejemplo (costos ficticios), juego talla M:** compra de 10 por Bs 3.000 y
otra de 10 por Bs 3.400 → 20 juegos por Bs 6.400, promedio Bs 320. Entrega a
Diego: costo Bs 320; quedan 19 por Bs 6.080. Se le cobran Bs 650: margen Bs
330. Si lo devuelve por cambio de talla, vuelve a Bs 320 exactos.

### 5.5 Utensilios y otros: costo promedio; prestar es custodia

- Compras, bajas y conteos usan el algoritmo de §5.4. En los utensilios,
  `total = disponible + prestado`: **lo prestado sigue siendo del instituto**.
- **Prestar no es gastar**: `prestamo` mueve de disponible a prestado y no
  toca el valor.
- **Perder o romper sí**: `baja` a costo promedio (desde «prestado» si se
  perdió en un préstamo). Es pérdida del mes. Cobrar la reposición al alumno
  es un cargo manual aparte (un ingreso; no «deshace» la baja).
- **Sin depreciación** en la v1 (a confirmar con el contador).
- **Otros** (limpieza, descartables): promedio; se usan como insumos, sin
  vencimiento.

### 5.6 Equipos mayores: fuera del inventario

Hornos, cocinas, batidoras industriales y refrigeradores son bienes de uso
(activo fijo): se deprecian y no se consumen ni se prestan. La v1 no los
registra; el límite entre «utensilio» y «equipo» lo define el contador.

### 5.7 Cómo se refleja en el dinero

**Cuándo cuenta cada cosa:**

| Hecho | En qué mes cuenta |
|---|---|
| Cuota de un plan | El de `cargos.fecha` = `vence_el` si ese mes está abierto; si ya se cerró (inscripción tardía), el mes en curso |
| Venta directa o uniforme cargado al entregar | El día de la entrega o la venta |
| Cobro | Su fecha (siempre hoy) |
| Gasto | Su fecha |
| Compra | Su fecha (dinero), nunca como gasto |
| Costo de lo usado | La fecha del movimiento |
| Anulación de cualquier cosa | El mes de `anulado_el`, restando; **el mes original no cambia** |

**Resumen del mes** (`v_resumen_mensual`), un estado de resultados simple:

```text
INGRESOS (lo que el mes generó)        cargos del mes por grupo de concepto − cargos anulados en el mes
COSTO DE LO USADO                      usos + entregas − devoluciones + bajas + faltantes − sobrantes (± anulaciones)
GASTOS (lo que costó funcionar)        gastos del mes por concepto − gastos anulados en el mes
DIFERENCIAS DE CAJA                    faltantes − sobrantes de los arqueos del mes
RESULTADO DEL MES                      Ingresos − Costo − Gastos − Diferencias  → «Ganancia» o «Pérdida»
```

Debajo, el **dinero del mes** (`v_flujo_mensual`) por medio: entró (cobros −
anulados) y salió (gastos + compras − anulados), con una línea que explica la
diferencia con el resultado («Compraste inventario por Bs X que todavía no se
usó»; «Los alumnos deben Bs Y del mes»). Y dos cifras de cierre: **lo que
deben los alumnos** (Σ pendiente) y **el valor del inventario**.

**Cuadre del inventario** (se muestra al cerrar el mes): valor al inicio +
compras + saldos iniciales − compras anuladas − costo de lo usado = valor al
final. Si no cuadra, `cerrar_mes` se detiene con `cuadre_fallido`.

**Seguimiento completo (cifras ficticias):**

| Hecho | Dinero | Resultado | Inventario | Lo que deben |
|---|---|---|---|---|
| Compra de harina al contado, Bs 350 | − 350 | — | + 350 | — |
| Uso de 30 kg en clase | — | costo − 206 | − 206 | — |
| Cuota del Paquete Económico de Diego (plan de 1 cuota) | — | ingreso + 650 | — | + 650 |
| Entrega de su juego M con cargo | — | ingreso + 650 · costo − 320 | − 320 | + 650 |
| Cobro por QR del uniforme | + 650 | — | — | − 650 |
| Luz pagada en efectivo, Bs 180 | − 180 | gasto − 180 | — | — |
| Baja de una tabla rota (promedio Bs 45) | — | pérdida − 45 | − 45 | — |
| Préstamo de 10 cuchillos | — | — | — (custodia) | — |
| Arqueo con faltante de Bs 5 | − 5 | − 5 | — | — |

**Una anulación tardía, de punta a punta:** un cobro en efectivo de Bs 650 del
30/09 se contó en el arqueo n.º 41 (`cierre_id = 41`) y septiembre se cerró.
El 02/10 administración lo anula: `anulado_el = 02/10`, `anulacion_cierre_id`
nulo. El arqueo n.º 42 lo cuenta como **salida de efectivo** (el dinero se
devolvió) y le pone `anulacion_cierre_id = 42`. El cargo vuelve a quedar
pendiente. El dinero de **octubre** baja Bs 650; septiembre no cambia. El
ingreso no cambia (el cargo sigue vigente); si además se anula el cargo, el
ingreso de octubre baja Bs 650.

Es una **vista de gestión**, no un estado financiero oficial ni una
declaración tributaria; los recibos dicen «Recibo interno: no es factura».

### 5.8 Ejemplos que son pruebas (dominio y batería SQL, mismos números)

1. **PEPS**: la harina de §5.3 (20 600 c, luego 240 c y 14 160 c; suma 35 000 c).
2. **Fracciones**: lote de 3 kg por Bs 10,00 usado de a 1 kg → 333 + 334 + 333 = 1 000 c.
3. **Vencido saltado**: lote A vencido con 2 kg y lote B vigente con 1 kg; pedir 2 kg → `stock_insuficiente` con `vencido = 2`; pedir 1 kg → sale de B.
4. **Promedio**: juego M de §5.4; y 3 juegos por Bs 100,00 entregados de a uno → 3 333 + 3 334 + 3 333 = 10 000 c.
5. **Devolución**: entrega y devolución se anulan al centavo.
6. **Préstamo**: prestar no cambia `existencias_costo.valor`; perder 1 sí, a promedio.
7. **Conteo**: faltante por PEPS; sobrante al último costo; `existencia_cambio` si el saldo se movió.
8. **Cobro**: aplicación del más antiguo al más nuevo; `aplicacion_excede_saldo`; referencia QR repetida.
9. **Anulación tardía**: el seguimiento de §5.7 (arqueo 42, octubre −650, septiembre intacto).

---

## 6. Flujos de trabajo paso a paso

Todos siguen el mismo patrón: **pocos pasos numerados → resumen en una frase
→ botón con verbo concreto → confirmación visible** (§8.1). Entre paréntesis,
la RPC que lo hace todo de una vez.

### 6.1 Registrar una compra (administración)

1. Inicio → **Registrar compra** (o desde la alerta «Bajo el mínimo», que llega con esos artículos ya cargados).
2. **¿Dónde y a quién?** Sede (la de trabajo), proveedor (opcional, con sugerencias), comprobante (factura, recibo, nota de venta o sin comprobante) y su número, fecha de la nota.
3. **¿Qué compraste?** Por línea: el artículo (buscador con icono), la **cantidad** con su unidad al lado, **cuánto pagaste por esa línea** (copiado tal cual de la nota) y el **vencimiento** si el artículo lo pide. La pantalla muestra «≈ Bs 6,80 por kg» para comprobar.
4. **¿Cómo pagaste?** Efectivo, QR o transferencia; en QR y transferencia, el número de operación.
5. Resumen: «3 productos · Bs 520,00 · efectivo de la caja de La Paz» → **Guardar compra** (`registrar_compra`).
6. Confirmación: «Harina de trigo: 10 kg → 35 kg», con **Registrar otra compra** y **Ver inventario**.

### 6.2 Usar insumos en clase (recepción o administración)

1. Inicio → **Usar insumos en clase**.
2. **¿Para qué?** Clase de un grupo (lista de grupos en curso de la sede: «Cocina · Sábados · La Paz»), práctica, evento, degustación, uso interno u otro (con detalle). Tema de la clase, opcional.
3. **¿Qué se usó?** Insumo y cantidad con botones − / + o teclado (acepta «2,5»). Al lado: «Hay 9,5 kg · se usará primero la compra del 05/09» y, si corresponde, «2 kg vencidos no se usan».
4. Resumen: «Vas a descontar 2 kg de harina y 30 huevos para Cocina · Sábados» → **Registrar uso** (`usar_insumos`).
5. Confirmación con cada saldo «antes → ahora». Si algo quedó bajo el mínimo: «La harina quedó por debajo del mínimo; avisa a administración» (recepción) o **Registrar compra** (administración). Administración ve también el costo de la clase («Bs 206,00»).

### 6.3 Entregar el uniforme y cargarlo o cobrarlo

1. Ficha del alumno → **Entregar uniforme** (o desde «Alumnos de carrera sin uniforme»). Si tiene varias inscripciones, se elige la de la carrera.
2. **Talla**: botones grandes S · M · L · XL con «quedan 4» debajo; la agotada aparece desactivada y avisa si la otra sede la tiene («en El Alto hay 2»).
3. **Cobro**: «¿Cargar Bs 650 a su cuenta?» (marcado si el juego tiene precio y el alumno no tiene ya ese cargo). Si no hay precio: «Precio por definir: se entrega sin cargo» (con motivo). Si se carga: **Cobrar ahora** (medio y número de operación) o **Dejar pendiente**.
4. **Entregar** (`entregar_uniforme`). Confirmación: «Entregado: juego talla M. Se cargó Bs 650», con **Imprimir recibo** si se cobró, o **Cobrar ahora**.

### 6.4 Cambiar la talla o recibir un uniforme devuelto

1. Ficha del alumno → pestaña **Uniforme y préstamos** → en la entrega: **Cambiar talla** (elige la nueva) o **Recibir devolución** (cantidad y motivo).
2. Confirmar (`devolver_uniforme`). En el cambio de talla no se cobra de nuevo.

### 6.5 Prestar utensilios

1. Inicio → **Prestar utensilios** (o desde la ficha del alumno).
2. **¿A quién?** Un alumno (buscador), un grupo (para la clase) u otra persona (un docente, por nombre).
3. **¿Qué?** Utensilios y cantidades, con los disponibles al lado. **¿Hasta cuándo?** Hoy (por defecto), el sábado, o una fecha.
4. **Prestar** (`prestar_utensilios`). Confirmación: «Juego de cuchillos: en el estante 8 → 6 · prestados 0 → 2 · devolver hoy».

### 6.6 Recibir utensilios prestados

1. Inicio → tarjeta **Utensilios atrasados** o Inventario → **Préstamos** (los atrasados primero, en rojo con icono de reloj y la palabra «Atrasado»).
2. En el préstamo: **¿Cuántos volvieron?** y **¿Falta o volvió roto alguno?** (con motivo).
3. **Recibir** (`recibir_devolucion`). Lo que no volvió queda como baja en el mismo acto. Si el instituto cobra la reposición, administración agrega un **cargo manual** en la ficha del alumno; si atendió recepción, la pérdida aparece en el tablero de administración.

### 6.7 Dar de baja (vencido, dañado, roto, perdido, merma)

1. Ficha del artículo → **Dar de baja** (desde la alerta de vencidos llega con el lote elegido).
2. **¿Por qué?** Tarjetas grandes con icono: Se venció · Se dañó · Se rompió · Se perdió · Merma · Otro. Cantidad y una frase de explicación (obligatoria).
3. Diálogo: «Vas a sacar 3 l de leche (compra del 18/09, vencida) del inventario de La Paz. Quedará registrado.» → **Sí, dar de baja** (`dar_de_baja`).

### 6.8 Contar el inventario (administración; recomendado antes de cerrar el mes)

1. Inventario → **Contar**. Lista por sede y tipo: «El sistema dice: 9,5 kg» y una casilla **«Contaste:»**.
2. Las filas con diferencia piden motivo (y costo, si es un sobrante sin compras previas). Las que coinciden quedan como constancia.
3. **Guardar conteo** (`registrar_conteo`): todo o nada. Si alguien movió un artículo mientras contabas, esas filas se marcan para volver a contarlas. El resumen muestra faltantes y sobrantes (con su valor).

### 6.9 Inscribir a un alumno de carrera (y renovar)

1. Inicio → **Inscribir alumno** → «Paso 1 de 3: ¿Quién?» Busca por nombre o carnet. Si no existe, **Nuevo alumno**: nombres y apellidos (carnet, celular y correo opcionales). Si el carnet ya existe: «Ya hay un alumno con ese carnet: Diego Mamani. ¿Es la misma persona?» → **Sí, usar su ficha**.
2. «Paso 2 de 3: ¿A qué grupo?» Pestaña **Carrera**: tarjetas de grupos abiertos con año, turno, sede, inicio, cupos (`<progress>` «18 de 25») y precio («Bs 650» o «Consultar»). **Paquete**: Económico o Ahorrador (con su precio o «Consultar»). **Requisitos entregados**: casillas del programa (no bloquean, regla E4).
3. «Paso 3 de 3: Revisa»: «Gastronomía · 1.er año · Tarde · 2027 · La Paz · Paquete Económico · se cargará 1 cuota de Bs 650» → **Inscribir** (`inscribir`).
4. Confirmación «¡Inscrito!» con **Entregar uniforme** · **Cobrar** · **Inscribir a otra persona**.
5. **Renovación**: en la ficha, **Renovar al siguiente año** propone el grupo del año siguiente del mismo programa, turno y sede; la inscripción anterior pasa a «Concluido».

### 6.10 Inscribir a un alumno de capacitación

Igual que 6.9, con pestaña **Capacitación** (Cocina, Coctelería, Repostería y
Panadería, Tortas, Cursos de temporada) y grupos con días, duración e inicio.
**No hay paquete**; requisitos solo si el programa los tiene (los de
temporada). Si el grupo no tiene plan: «Este grupo aún no tiene precio: no se
cargan cuotas» y el alumno queda inscrito igual. Una persona puede estar en la
carrera y en un curso a la vez (regla E2).

### 6.11 Convertir una solicitud del portal en inscripción

1. Inicio (tarjeta «Solicitudes del portal») → Alumnos → **Solicitudes** (la pestaña muestra cuántas hay).
2. A la izquierda, lo que pidió: tipo, programa, sede, turno, días, paquete, mensaje, celular (botón WhatsApp) y desde cuándo espera; en una renovación, la gestión anterior. A la derecha, el **grupo que coincide** (en renovación, el del año siguiente), con cupos y precio; si el turno o la sede difieren, lo avisa.
3. Tres botones: **Inscribir** (principal), **Pedir más datos** (pone «En revisión» con una respuesta) y **Rechazar** (respuesta obligatoria, la verá el alumno).
4. **Inscribir** abre la confirmación: grupo, paquete, requisitos y **respuesta para el alumno** con texto sugerido y editable («Te damos la bienvenida a Gastronomía, 2.º año, gestión 2027») → **Aprobar e inscribir** (`aprobar_solicitud`).
5. Confirmación; la tarjeta sale de la bandeja y queda **Ver ficha**. El alumno ve «Aprobada» y la respuesta en su portal.
6. Si no hay grupo compatible: administración ve **Abrir grupo**; recepción ve «Pide a administración que abra el grupo».

### 6.12 Cobrar (QR, efectivo o transferencia)

1. Inicio → **Cobrar** → busca al alumno (o desde su ficha o desde «Lo que deben»).
2. Sus cuotas y cargos pendientes, del más antiguo al más nuevo, con los vencidos marcados (icono, palabra y color) y los días de atraso. Están todos marcados; el total se calcula solo. Para cobrar una parte, escribe el monto en el cargo.
3. **¿Cómo pagó?** Botones con icono: Efectivo · QR · Transferencia. En QR y transferencia: «Escribe el número de operación que aparece en el comprobante» (obligatorio).
4. **Cobrar Bs 650,00** (`registrar_cobro`).
5. Confirmación con el sello «¡Cobrado!», **Recibo LP-2026-000123**, «Saldo pendiente: Bs 0,00», y los botones **Imprimir recibo** y **Cobrar a otro alumno**. El recibo imprimible lleva el monto en números y en letras, el medio y el número de operación, quién cobró y «Recibo interno: no es factura».
6. **Venta directa** (sin cuota previa): **Otro cobro** → concepto, descripción y monto → mismo recibo. Mientras no llegue el QR bancario, cobrar por QR es verificar la transferencia en la app del banco y anotar su número.

### 6.13 Registrar un gasto (administración)

1. Inicio → **Registrar gasto**.
2. Concepto en tarjetas con icono (Alquiler, Servicios básicos, Sueldos y honorarios, Mantenimiento, Limpieza, Material de oficina, Publicidad, Transporte, Trámites, Otro); qué fue; cuánto; cómo se pagó (en efectivo sale del cajón de hoy); comprobante.
3. **Guardar gasto** (`registrar_gasto`). La confirmación resalta el gasto en la lista del mes. Las compras de inventario **no** se registran aquí.

### 6.14 Cerrar caja (arqueo; recepción o administración)

1. Inicio → tarjeta **Caja** → **Cerrar caja** (al final del turno o del día; puede hacerse más de una vez).
2. La pantalla usa `caja_por_cerrar` (la misma cuenta que el cierre): «Empezaste con Bs 200 · Cobraste en efectivo Bs 1.300 · Salió en efectivo Bs 150 → **Debería haber Bs 1.350**». Aparte: «QR desde el último cierre: Bs 650 (1 cobro); revísalo en la app del banco», con los números de operación.
3. **¿Cuánto contaste?** y **¿Cuánto dejas para el cambio?** (el resto se retira o deposita). Si cuadra: «¡La caja cuadra!». Si no: la diferencia en grande («Faltan Bs 5,00») y se pide una explicación.
4. **Cerrar caja** (`cerrar_caja`). Lo que se cobre después entra en el arqueo siguiente; nunca se bloquea un cobro. Administración ve en su tablero los arqueos con diferencia y los marca como revisados.

### 6.15 Cerrar el mes (administración)

1. Desde el día 1, el tablero muestra **«Cierra septiembre»**.
2. Contabilidad → **Cierre de mes**: lista de comprobación con iconos — efectivo del mes arqueado ✓/✗ (con enlace a lo que falta) · lotes vencidos dados de baja · conteo de insumos hecho (recomendado) · QR verificados (aviso) · cuadre del inventario ✓ — y el resumen del mes definitivo.
3. **Cerrar septiembre 2026** (`cerrar_mes`): se guarda la fotografía y no entra nada con fecha de septiembre; las correcciones posteriores son anulaciones del mes en curso.
4. Si hubo un error grave: **Reabrir** (solo el último mes, con motivo; queda en la auditoría).

### 6.16 Corregir un error (administración)

Nada se edita. En la ficha del documento (compra, uso, baja, cobro, cargo,
gasto) → **Anular** → diálogo que nombra la consecuencia («El recibo
LP-2026-000123 quedará anulado y Diego volverá a deber Bs 650; se devolverán
Bs 650 del cajón») y pide motivo (`anular`). Luego se registra bien. La
historia muestra los dos. Recepción no anula: su protección es el resumen
previo; si se equivoca, avisa a administración.

### 6.17 Poner precio a un grupo (administración)

1. Alumnos → **Grupos y cupos** → el grupo → **Definir precio**.
2. Concepto, monto por cuota, número de cuotas, primer vencimiento, cada cuántos meses y nota («Periodicidad por confirmar»). Si es de la carrera, uno por paquete.
3. Si el grupo ya tiene inscritos sin cuotas: **Crear cuotas pendientes** (`generar_cuotas_de_grupo`). Desde el primer cargo, el plan queda congelado (regla A2).

### 6.18 Puesta en marcha (una sola vez, administración)

1. **Saldo inicial** de cada artículo por sede (`registrar_saldo_inicial`), con lo que costó.
2. Abrir los grupos vigentes y cargar sus planes con los precios que dé el cliente.
3. Inscribir a los alumnos actuales.
4. Antes: borrar los datos de demostración (§9.7).

---

## 7. Pantallas

### 7.1 Principios

- **Pocas secciones con nombres cotidianos**, siempre **icono y texto**
  (nunca solo icono). Nada se desplaza en horizontal.
- **Una acción principal por pantalla**, amarilla con texto azul marino,
  siempre en el mismo lugar (abajo a la derecha en escritorio, a todo el
  ancho en móvil). Las irreversibles son rojas con icono, nunca amarillas.
- **Asistentes de 2 o 3 pasos** («Paso 1 de 3») con **resumen en una frase**
  antes de guardar; «Volver» en todos los pasos.
- **Tablas de 4 a 6 columnas** con encabezados reales; en móvil, tarjetas.
  Listas paginadas en la base (25 por página).
- **Formularios** de una columna, etiqueta visible encima, error bajo el
  campo, cantidades con − / + grandes o teclado numérico (`inputmode="decimal"`,
  acepta coma o punto).
- Texto base de **17 px**; botones de **48 px** como mínimo y **64 px** en la
  acción principal.

### 7.2 La esencia del instituto en el panel (enmienda a `identidad-visual.md` §9, D30)

| Elemento | Dónde sí | Dónde no |
|---|---|---|
| **Kaushan Script** | Saludo del Inicio («¡Buenos días, Rosa!»), palabra del sello de confirmación («¡Cobrado!», «¡Inscrito!») y frase del estado vacío; una por pantalla | Tablas, formularios, botones |
| **Bebas Neue** | Cifras grandes (indicadores, saldos, existencias destacadas) y el `h1` de cada sección | Textos largos |
| **Montserrat** | Todo lo demás | — |
| **Azul marino** | Barra lateral, banda de bienvenida con onda inferior, insignias circulares de las acciones | Fondos de tablas |
| **Amarillo lima** | Acción principal, foco, brochazo (`.marca-resaltado`) bajo una palabra del título de sección, resalte de confirmación; siempre con azul encima | Más de un botón por pantalla |
| **Rojo vino** (`--t-cursos`) | Chip y borde de **Capacitación** (la **Carrera** usa azul), con texto e icono | Errores (van con el color `peligro`, distinto, más icono y palabra) |
| **Panal** | Inventario → tres **hexágonos** grandes: Insumos (`trigo`), Uniformes (`chaqueta`), Utensilios (`cubiertos`), con su número de alertas | Listas |
| **Polaroid y fotos reales** (`Foto`, `FOTOS-WEB`) | Banda de bienvenida del Inicio en escritorio; estados vacíos (`reposteria-batidora`, `emplatado-con-pinzas`); cabecera de Alumnos e Inventario | Dentro de tablas |
| **Rayas de brillo** | Junto al saludo, al sello y a «¡Todo al día!» | Listas y formularios |
| **Franja tricolor** | Microacento bajo los logotipos | — |
| **Logotipos** | Barra superior blanca (siempre sobre fondo claro) | Sobre la barra azul |

### 7.3 Vocabulario de la pantalla

| En la base | En pantalla |
|---|---|
| `cohortes` | Grupos |
| `cargos` | Lo que debe · cuotas |
| `pagos` | Cobros |
| `consumo` | Usar en clase |
| `baja` | Dar de baja |
| `conteo` | Contar el inventario |
| `existencias` | Hay · En el estante · Prestados |
| `lote` | La compra del 12/09 |
| PEPS | «Lo primero que entra es lo primero que sale» (ayuda) |
| `stock_minimo` | Avísame cuando queden menos de |
| `cierres_de_caja` | Cerrar caja (contar el dinero) |
| Anulación | Anular (queda registrado) |
| Costo promedio ponderado | Costo promedio por pieza |
| Resultado del ejercicio | Resultado del mes (ganancia o pérdida) |
| `carrera` / `curso` | **Carrera** / **Capacitación** |

### 7.4 Navegación y rutas

| Sección | Ruta | Icono | Recepción | Administración | Pestañas |
|---|---|---|:-:|:-:|---|
| **Inicio** | `/panel` | `casa` (nuevo) | ✓ | ✓ | — |
| **Alumnos** | `/panel/alumnos` | `graduacion` | ✓ | ✓ | Alumnos · Solicitudes (con contador) · Grupos y cupos |
| **Inventario** | `/panel/inventario` | `almacen` (nuevo) | ✓ | ✓ | Insumos · Uniformes · Utensilios · Otros · Préstamos · Historial |
| **Caja** | `/panel/caja` | `monedas` | ✓ | ✓ | Por cerrar · Lo que deben · Recibos · Arqueos |
| **Contabilidad** | `/panel/contabilidad` | `libro` (nuevo) | — | ✓ | Resumen del mes · Gastos · Compras · Inventario valorizado · Cierre de mes · Auditoría |
| **Ajustes** | `/panel/ajustes` | `engranaje` (nuevo) | — | ✓ | Personal · Conceptos |

- **Escritorio**: columna lateral azul (240 px) con icono y texto; arriba la
  sede y el nombre; abajo «Salir». **Móvil**: barra superior blanca con los
  logotipos y **barra inferior fija** (recepción 4 secciones; administración
  4 + «Más»). `aria-current="page"` en la sección activa; migas solo desde el
  segundo nivel.
- **Rutas**:

```text
/panel
/panel/alumnos · /nuevo · /[codigo] (pestañas: Resumen · Cuenta · Uniforme y préstamos · Datos)
/panel/alumnos/inscribir?alumno=&grupo=
/panel/alumnos/solicitudes · /solicitudes/[id]
/panel/alumnos/grupos · /grupos/[id] · /grupos/nuevo (adm.) · /grupos/[id]/precio (adm.)
/panel/inventario?tipo=insumo|uniforme|utensilio|otro
/panel/inventario/[codigo]                    ficha: saldo por sede, lotes o tallas, historial
/panel/inventario/usar · /entregar?inscripcion= · /prestar · /prestamos · /baja?articulo=&lote=
/panel/inventario/compra · /contar · /saldo-inicial · /articulos/nuevo   (adm.)
/panel/caja · /caja/cobrar?alumno=&cargo= · /caja/deben · /caja/recibos · /caja/recibos/[serie] · /caja/cerrar · /caja/arqueos
/panel/contabilidad?mes=2026-09 · /gastos (+ /nuevo) · /compras · /inventario · /cierre-de-mes · /auditoria
/panel/ajustes/personal · /ajustes/conceptos
```

- **Guardas y acceso**:
  - `proxy.ts`: la renovación de sesión incluye `/panel` (`ruta === '/panel' || ruta.startsWith('/panel/')`). Sigue sin autorizar.
  - Un solo inicio de sesión (`/portal/acceso`). `destinoSeguro()` admite `/panel/*`; tras entrar, quien tiene `panel.entrar` va a `/panel` y el resto a `/portal`. El aviso «panel en construcción» de `/portal` se cambia por una redirección a `/panel` para el personal.
  - `app/panel/layout.tsx` llama a `exigirPersonal()` (React `cache`, `getUser()` + `mi_contexto()`): sin sesión, 307 a `/portal/acceso?siguiente=/panel`; estudiante, a `/portal`.
  - Cada página llama a `exigirPermiso(...)` y cada Server Action lo vuelve a comprobar. La base decide.
  - **Sin `loading.tsx`** en rutas con guarda (rompe los 307 y 404); la espera se ve en el enlace (`useLinkStatus`) y en el botón.
- **Iconos nuevos** para `Icono.tsx` (retícula 24, trazo 2, `currentColor`, basados en Lucide): `casa`, `almacen`, `libro`, `engranaje`, `buscar`, `imprimir`, `deshacer`, `carrito`, `balanza`, `papelera`, `intercambio`, `recibo`, `billete`, `candado`, `grupo`, `huevo`, `lacteo`, `bol`, `batidor`. Se reutilizan `gorro`, `cubiertos`, `trigo`, `chaqueta`, `monedas`, `documento`, `graduacion`, `calendario`, `reloj`, `lapiz`, `check`, `alerta`, `qr`, `renovar`, `whatsapp`, `usuario`, `salir`, `mas`.

### 7.5 Pantallas: lo que se ve primero y sus botones

| Pantalla | Campos que se ven primero (en orden) | Acción principal | Secundarias |
|---|---|---|---|
| **Alumnos** | Iniciales en círculo + **nombre** · código · **programa actual** (chip azul «Carrera · 2.º año» o vino «Capacitación · Cocina») · sede · **cuenta** («Al día» o «Debe Bs 650», con icono si está vencido) | **Inscribir alumno** | Buscador grande «Busca por nombre, carnet o código» · filtros Todos / Carrera / Capacitación / Con deuda · por fila: **Ver ficha**, **Cobrar** (si debe) |
| **Ficha del alumno** | Nombre grande, carnet, celular (botón WhatsApp), código, sede · tarjeta de **cuenta** (vencido y por vencer) · inscripción vigente (grupo, estado) · uniforme (entregado, talla) · requisitos pendientes | **Cobrar** (si debe) o **Inscribir** | Entregar uniforme · Prestar · Renovar al siguiente año · Editar datos · (adm.) Cargo manual · Retirar · Archivar |
| **Solicitudes** | **Alumno** · Inscripción o Renovación · programa (chip) · sede y turno · **espera desde** («hace 2 días») · estado | **Atender** | Filtros Pendientes · En revisión · Todas |
| **Atender solicitud** | Lo pedido · grupo sugerido (cupos, precio) · ficha encontrada o nueva · respuesta para el alumno | **Aprobar e inscribir** | Pedir más datos · Rechazar |
| **Grupos y cupos** | **Grupo** · inicio · turno y días · **cupos** (`<progress>` + «7 libres») · **precio** (o «Consultar») · estado | (adm.) **Abrir grupo** | **Inscribir aquí** · Ver inscritos · (adm.) Definir precio |
| **Ficha del grupo** | Programa, sede, turno, días, inicio y fin · cupos · plan de pagos · inscritos con su cuenta y uniforme · (adm.) costo de los insumos usados por el grupo | **Inscribir alumno** | Usar insumos para este grupo · Prestar al grupo · (adm.) Editar · Definir precio · Crear cuotas pendientes |
| **Inventario (inicio)** | Tres hexágonos con número de artículos y de alertas · hasta 5 alertas en frase | Según el rol: **Usar en clase** | Entregar uniforme · Prestar · (adm.) Registrar compra · Contar |
| **Insumos** | Icono + **artículo** · **hay** (cantidad y unidad, grande, con `<meter>` contra el mínimo) · **estado** (Agotado · Bajo · Bien, con icono) · próximo vencimiento («usa primero la compra del 05/09») · sede · (adm.) valor | **Usar en clase** | Por fila: Usar · Ver historial · Dar de baja · (adm.) Registrar compra |
| **Uniformes** | Artículo · **tallas** como chips («S 4 · M 0 · L 6», la agotada tachada) · precio o «Precio por definir» · entregados este mes · (adm.) costo promedio | **Entregar uniforme** | (adm.) Registrar compra · Editar precio |
| **Utensilios** | Utensilio · en el estante · prestados · atrasados · (adm.) valor | **Prestar** | Recibir devolución · Dar de baja |
| **Ficha del artículo** | Nombre, tipo, unidad, mínimo · **saldo por sede** (dos tarjetas) · lotes (compra del, queda, vence, estado) o tallas · historial en frases («Se usaron 5 kg en Repostería · Rosa · hoy 17:40») | La acción del tipo | Dar de baja · Ver historial completo · (adm.) Editar · Contar · Anular (en cada documento) |
| **Historial (kárdex)** | **Fecha** · **qué pasó** (icono + «Usado en clase · Cocina Sábados») · **entra** · **sale** · **queda** · quién · (adm.) costo y valor | — | Filtro por sede y fechas · Imprimir |
| **Préstamos** | **A quién** · utensilio y cantidad · **devolver el** (chip rojo «Atrasado 1 día» u «Hoy») · sede | **Recibir devolución** | Prestar · WhatsApp |
| **Caja · Por cerrar** | Tarjetas: **efectivo** · **QR** · **transferencia** · «debería haber en el cajón» · último cierre; debajo: **recibo** · hora · **alumno o concepto** · medio (icono) · **monto** · quién | **Cobrar** | **Cerrar caja** · Imprimir recibo |
| **Lo que deben** | **Alumno** · concepto · **pendiente** · venció (chip «hace 12 días») · celular | **Cobrar** (por fila) | WhatsApp · Solo vencidos · por sede · Carrera / Capacitación |
| **Recibo** | Número, fecha y hora, sede, alumno, conceptos y montos, total en números y en letras, medio y número de operación, quién cobró | **Imprimir** | (adm.) Anular |
| **Arqueos** | Fecha y hora · sede · esperado · contado · **diferencia** · quién · revisado | — | (adm.) Marcar revisado · QR por verificar |
| **Resumen del mes** (adm.) | **Resultado** (Ganancia o Pérdida) · ingresos · costo de lo usado · gastos · **dinero que entró y salió** · lo que deben · valor del inventario · tablas por grupo de concepto | **Cerrar mes** (si corresponde) | Elegir mes y sede · Imprimir |
| **Gastos** (adm.) | **Fecha** · concepto (icono) · qué fue · medio · **monto** · comprobante | **Registrar gasto** | Anular · filtros mes, sede, concepto |
| **Compras** (adm.) | **Fecha** · proveedor · artículos (resumen) · **total** · medio · comprobante | **Registrar compra** | Ver · Anular |
| **Inventario valorizado** (adm.) | **Tipo** · artículos · **valor** por sede · % del total; por artículo, costo promedio | — | Imprimir · Ver historial valorizado |
| **Auditoría** (adm.) | **Cuándo** · **quién** · qué (acción + registro legible) · antes → después · motivo | — | Filtros por persona, tabla y fechas |
| **Personal** (adm.) | **Nombre** · correo · **rol** · sede · activo | **Dar acceso** (busca una cuenta ya registrada; rol y sede) | Cambiar sede · Quitar acceso |
| **Conceptos** (adm.) | **Concepto** (icono) · ingreso o gasto · grupo · activo | **Nuevo concepto** | Editar · Desactivar |

### 7.6 Tablero de recepción (Rosa, La Paz)

De arriba abajo; **las tarjetas en cero no aparecen**; si no queda ninguna,
«¡Todo al día!» con las rayas de brillo y una foto de la marca.

1. **Bienvenida**: «¡Buenos días, Rosa!» (script), la fecha («jueves 2 de octubre») y el chip «La Paz · Miraflores»; banda azul con onda inferior y polaroid en escritorio.
2. **Buscador grande**: «Busca un alumno por nombre o carnet» (la tarea más frecuente; lleva a la ficha).
3. **¿Qué quieres hacer?** Seis botones grandes con insignia circular azul y pictograma blanco: **Cobrar** · **Inscribir alumno** · **Usar insumos en clase** · **Entregar uniforme** · **Prestar utensilios** · **Recibir devolución**.
4. **Pendientes de hoy** (como máximo 6, del más urgente al menos):

| Indicador (cifra exacta) | Fuente | Acción |
|---|---|---|
| **Utensilios atrasados** (préstamos de su sede con `devolver_el < hoy`; «y N vencen hoy») | `v_prestamos_abiertos` | **Recibir devolución** |
| **Solicitudes del portal** (pendientes + en revisión; primero las de su sede; la más antigua) | `solicitudes` | **Atender** |
| **Alumnos de carrera sin uniforme** (su sede) | `v_sin_uniforme` | **Entregar** |
| **Cuotas vencidas** (alumnos de su sede y la suma) | `v_saldos_de_alumno` | **Ver y cobrar** |
| **Insumos vencidos o por vencer** (lotes de su sede, con cantidad) | `v_lotes_vigentes` | **Usar primero** · **Dar de baja** |
| **Agotados o bajo el mínimo** (su sede) | `v_existencias` | **Ver lista** (recepción no compra: avisa) |

5. **Caja** (siempre visible): «Por cerrar: efectivo Bs 1.300 · QR Bs 650 · 3 cobros» y la hora del último cierre → **Cerrar caja**.
6. **Oferta para informar** (si hay grupos abiertos): hasta 4 grupos con días, inicio, cupos libres y precio o «Consultar» → **Inscribir aquí** · **Ver toda la oferta**.

### 7.7 Tablero de administración (Carla)

1. **Bienvenida** con selector de sede «Ambas · La Paz · El Alto».
2. **Acciones rápidas** (5): **Registrar compra** · **Registrar gasto** · **Inscribir alumno** · **Cobrar** · **Ver resumen del mes**.
3. **Requiere tu atención** (hasta 6, del más grave al menos; en cero no aparecen; el resto en «Ver N más»):

| Indicador (cifra exacta) | Regla | Acción |
|---|---|---|
| **Cierra septiembre** | Mes anterior sin fila cerrada en `periodos` (desde el día 1) | **Cerrar mes** |
| **Efectivo sin arqueo** de días anteriores, por sede | Registros en efectivo con `cierre_id` nulo y fecha < hoy | **Ver caja** |
| **Arqueos con diferencia sin revisar** (cuántos y suma absoluta) | `cierres_de_caja.diferencia <> 0 and revisado_en is null` | **Revisar** |
| **QR sin verificar** (cuántos y Bs) | `pagos` QR o transferencia sin `verificado_en` | **Verificar** |
| **Bajas y faltantes de los últimos 7 días** (cantidad y Bs) | Movimientos `baja` y `ajuste_faltante` + costo | **Revisar bajas** |
| **Sin precio definido** (grupos con inscritos y sin plan; entregas sin cargo; pérdidas en préstamos sin cargo, 30 días) | Vistas de grupos, entregas y préstamos | **Definir precio** · **Cargar reposición** |
| **Agotados o bajo el mínimo** | `v_existencias` | **Registrar compra** (ya cargada con esos artículos) |
| **Lotes vencidos o por vencer** (cantidad y Bs) | `v_lotes_vigentes` + costo | **Ver lotes** |
| **Solicitudes del portal** | `solicitudes` | **Atender** |
| **Utensilios atrasados** | `v_prestamos_abiertos` | **Ver préstamos** |

4. **Dinero de este mes** (4 cifras en Bebas Neue, sin adornos): **Entró** y **Salió** (con ▲/▼ y el texto «12 % más que en septiembre a esta fecha», comparando del día 1 a hoy), **Resultado** («Ganancia» o «Pérdida») y **Lo que deben los alumnos** (y cuánto está vencido); cada una con su enlace.
5. **Alumnos e inventario** (dos tarjetas compactas): Carrera por año (1.º · 2.º · 3.º) y Capacitación por curso, por sede, con «Nuevas inscripciones este mes» y «Grupos que empiezan en 30 días con N cupos libres»; valor del inventario por tipo.
6. **Un solo gráfico**: «Entró y salió · últimos 6 meses», barras agrupadas en SVG dibujado en el servidor, con «Ver como tabla». Sin tortas, sin velocímetros, sin gráficos decorativos.

---

## 8. Interacción, animaciones y estados

### 8.1 Cómo se confirma un cambio (sin JavaScript propio)

1. **Redirección (PRG).** La Server Action llama a la RPC y, si sale bien,
   redirige con `?hecho=<codigo>&ref=<uuid>#fila-<id>`. La URL lleva solo un
   código de una lista cerrada y un id: **nunca datos personales ni cifras**.
2. **Relectura.** La página valida `hecho` y `ref`, y **vuelve a leer el
   documento de la base** bajo RLS: el bloque muestra lo que dice la base
   («Harina: 9,5 kg → 7,5 kg»), no lo que trae la URL. Recargar no repite nada.
3. **Bloque de confirmación** (`role="status"`, el foco va a su título):
   sello animado, «¡Listo!» (o la palabra del caso), qué cambió, número de
   recibo si lo hay y 2 o 3 **siguientes pasos**. **No se esconde solo**;
   tiene **Cerrar** (componente cliente mínimo).
4. **Fila nueva resaltada** con `:target` y la insignia fija «Nuevo».
5. **Acciones de un clic** en una lista (poner en revisión, verificar QR,
   marcar revisado): componente cliente con `useActionState` (adaptado de
   `AccionConEstado`, con `<dialog>` en lugar de `window.confirm`) que pone
   `data-hecho="si"` en la fila; el CSS la anima. Los errores no se cierran solos.
6. **Mientras guarda**: el botón se desactiva, dice «Guardando…» y lleva
   `aria-busy` (`useFormStatus`).

### 8.2 Catálogo de animaciones (CSS en `@layer components`, clases estáticas)

| Clase | Cuándo | Qué hace | Duración | Con `prefers-reduced-motion` |
|---|---|---|---|---|
| `anim-sello` | Tras guardar algo importante (cobro, inscripción, compra, entrega, cierre de caja y de mes) | Insignia circular azul con check blanco que «se estampa»: escala 1,25 → 0,95 → 1 y giro −8° → 0° | 420 ms | Insignia quieta |
| `anim-check` | Dentro del sello y al completar un paso del asistente | El trazo del check se dibuja (`pathLength="1"` + `stroke-dashoffset`) | 300 ms | Check completo |
| `anim-rayas` | Junto al sello y en «¡Todo al día!» | Las tres rayas de brillo amarillas se dibujan en secuencia | 500 ms | Visibles y quietas |
| `anim-cambio` | Saldos y existencias del bloque de confirmación | El valor anterior se tacha y atenúa, entra la flecha, el nuevo aparece con un pequeño rebote: «9,5 kg → **7,5 kg**» | 600 ms | Texto final directo |
| `anim-destello` | Fila o tarjeta recién creada o cambiada (`:target`, `[data-hecho='si']`) | Fondo amarillo suave (`color-mix` con `--t-accion`) que se desvanece | 1,6 s | **Borde izquierdo amarillo de 4 px fijo** + «Nuevo» |
| `anim-entrar` | Bloques de confirmación, avisos, paso nuevo del asistente | Opacidad 0 → 1 y 6 px hacia arriba | 220 ms | Aparece sin moverse |
| `anim-sale` | Solicitud aprobada que deja la bandeja | Se desliza a la derecha y la lista se cierra | 300 ms | Desaparece |
| `anim-cuadra` / `anim-diferencia` | Cierre de caja | Check verde que se dibuja / la diferencia late 2 veces en color de alerta | 700 ms / 2 × 300 ms | Check completo / solo el color |
| `anim-latido` | Chips críticos (Agotado, Vencido, Atrasado) al cargar | Escala 1 → 1,06 → 1, **2 veces** | 2 × 300 ms | Quieto |
| `anim-sacudir` | Resumen de errores al enviar | ±4 px, 3 vaivenes; el foco va al resumen | 300 ms | Sin sacudida; el foco va igual |
| `anim-girar` | Icono del botón que espera | Giro continuo, **la única animación en bucle** y solo mientras envía | — | Reloj fijo y «Guardando…» |
| `.mosaico` | Botones de «¿Qué quieres hacer?» | −2 px al pasar el puntero (solo `@media (hover: hover)`), `scale(.98)` al pulsar | 150 ms | Sin desplazamiento |

Ninguna animación decorativa se repite. El estado **nunca** se comunica solo
con movimiento ni solo con color: siempre hay texto e icono.

### 8.3 Reglas de la CSP estricta

- **Ningún atributo `style`** (la prueba de seguridad existente lo vigila);
  sin `next/image`; sin librerías que inyecten estilos.
- Proporciones: `<meter min max low high optimum value>` para la existencia
  contra el mínimo, `<progress>` para cupos y pasos, estilados con sus
  pseudoelementos y tokens; gráfico en **SVG** con `width`, `height`, `x`, `y`
  calculados en el servidor y color por clase (`fill: var(--t-estructural)`),
  con `role="img"`, `aria-label` y tabla equivalente. Si hiciera falta una
  barra en HTML: escalones `data-nivel="7"` → `[data-nivel='7'] { inline-size: 70% }`.
- Clases propias dentro de `@layer components`; `styles/panel.css` importado
  por el layout del panel (servido desde `'self'`).
- Componentes cliente nuevos, solo: navegación (sección activa y «Más»),
  asistentes (pasos y líneas), contador − / +, `<dialog>` de confirmación,
  cierre del bloque de confirmación, acción de un clic, selector de sede y
  buscador con sugerencias. Todo lo demás, Server Components.
- El navegador nunca habla con Supabase: lecturas en Server Components,
  escrituras en Server Actions que llaman a las RPC.

### 8.4 Antes de lo que no se deshace

**Dar de baja, anular, cerrar caja con diferencia, cerrar el mes y retirar a
un alumno** abren un `<dialog>` nativo que dice la consecuencia con números
(«Vas a anular el cobro LP-2026-000123 de Bs 650,00 de Diego Mamani. Se
devolverá el dinero del cajón y volverá a deber Bs 650.»), pide el motivo
cuando corresponde y tiene dos botones: «Sí, anular» (rojo, con icono) y
«Volver» (con el foco por defecto).

### 8.5 Errores en lenguaje simple (código → mensaje)

Regla: decir **qué pasó y qué hacer**, sin culpar, sin códigos y **sin perder
lo que la persona escribió**. Errores de forma bajo cada campo
(`aria-describedby`) y en un resumen enfocable arriba (`ResumenDeErrores`).

| Código | Mensaje |
|---|---|
| `sin_permiso` | «Esta acción la hace administración. Si la necesitas, pídesela.» |
| `sede_no_operable` | «Solo puedes registrar operaciones en tu sede (La Paz).» |
| `sede_no_asignada` | «Tu cuenta aún no tiene sede. Pide a administración que te la asigne.» |
| `stock_insuficiente` | «No alcanza: hay 2,5 kg de harina en La Paz y quieres usar 3 kg.» (+ «Además hay 1 kg vencido que no se puede usar: dalo de baja.») |
| `existencia_cambio` | «Alguien movió este artículo mientras contabas: el sistema decía 9,5 kg y ahora dice 7,5 kg. Vuelve a contarlo.» |
| `vencimiento_requerido` | «Este producto vence. Escribe la fecha de vencimiento que dice el paquete.» |
| `referencia_requerida` | «Escribe el número de operación que aparece en el comprobante del QR o de la transferencia.» |
| `referencia_repetida` | «Ese número de operación ya se registró en el recibo LP-2026-000118. Revisa que no sea el mismo pago.» |
| `aplicacion_excede_saldo` | «Diego debe Bs 650 por este concepto; no puedes cobrar más.» |
| `precio_no_definido` | «Este uniforme todavía no tiene precio. Se puede entregar sin cargo; administración lo definirá.» |
| `grupo_lleno` | «El grupo ya tiene sus 25 cupos ocupados. Elige otro grupo o pide a administración que amplíe los cupos.» |
| `ya_inscrito` | «Valeria ya está inscrita en este grupo.» |
| `documento_duplicado` | «Ya hay un alumno con ese carnet: Diego Mamani (BG-2026-0007). ¿Es la misma persona?» (botón «Sí, usar su ficha») |
| `paquete_requerido` | «En la carrera hay que elegir el paquete (Económico o Ahorrador).» |
| `solicitud_cerrada` | «Otra persona ya atendió esta solicitud, o el estudiante la canceló. Actualiza la bandeja.» |
| `grupo_no_corresponde` | «Ese grupo es de otro programa que el que pidió el estudiante.» |
| `aprobar_inscribiendo` | «Para aprobar, elige el grupo y pulsa "Aprobar e inscribir".» |
| `respuesta_requerida` | «Escribe la respuesta que verá el alumno.» |
| `compra_con_movimientos_posteriores` | «Ya se usó parte de esta compra. En vez de anularla, corrígela con una baja o un conteo.» |
| `cargo_con_cobros` | «Este cargo ya tiene cobros. Anula primero el cobro.» |
| `observacion_requerida` | «La caja no cuadra por Bs 5,00. Escribe qué pasó antes de cerrar.» |
| `nada_que_arquear` | «No hay movimientos de dinero desde el último cierre.» |
| `periodo_cerrado` | «Septiembre ya está cerrado. Registra la corrección con fecha de este mes.» |
| `efectivo_sin_arqueo` | «Antes de cerrar el mes hay que cerrar la caja de El Alto del 30 de septiembre.» |
| `cuadre_fallido` | «El inventario no cuadra en 2 artículos (ver lista). No se cerró el mes; avisa a soporte.» |
| `ultimo_administrador` | «El instituto no puede quedarse sin un administrador activo.» |
| Operación repetida | «Esto ya se había guardado. No se registró dos veces.» |
| Cualquier otro | «No pudimos guardar. Revisa tu conexión e inténtalo otra vez. Si se repite, avisa a administración.» |

Cantidades con coma decimal y su unidad («12,5 kg»); importes con
`formatearMonto` («Bs 1.250,50»); fechas legibles («jueves 2 de octubre») y
relativas cuando ayudan («hace 2 días»).

### 8.6 Estados vacíos (una frase en script, una línea, una acción, una imagen de la marca)

| Pantalla | Frase | Acción |
|---|---|---|
| Inicio sin pendientes | «¡Todo al día!» · «No hay nada pendiente en La Paz.» | — (siguen las acciones) |
| Alumnos (sin resultados) | «No encontramos a "Mamni"» · «Revisa cómo se escribe o búscalo por su carnet.» | **Nuevo alumno** |
| Solicitudes | «Bandeja al día» · «No hay solicitudes por atender.» | — |
| Grupos | «Aún no hay grupos abiertos» | (adm.) **Abrir grupo** · (rec.) «Pide a administración que abra uno» |
| Insumos / Uniformes / Utensilios | «Todavía no hay insumos» | (adm.) **Registrar compra** · **Cargar saldo inicial** |
| Préstamos | «Todo en su lugar» · «No hay utensilios prestados.» | **Prestar utensilios** |
| Lo que deben | «Todos al día» | — |
| Caja · Por cerrar | «Aún no hay cobros» · «desde el último cierre.» | **Cobrar** |
| Gastos del mes | «Sin gastos en octubre» | **Registrar gasto** |
| Historial | «Sin movimientos todavía» | La acción del tipo |

### 8.7 Pensado para adultos de todas las edades

- Nunca un icono sin texto; nunca acciones escondidas en menús de tres puntos
  o que solo aparecen al pasar el puntero.
- Verbos concretos («Cobrar», «Entregar uniforme»), nunca «Procesar» ni «Ejecutar».
- Sin abreviaturas («Cantidad», no «Cant.»); unidad junto al número.
- Sin límites de tiempo; «Volver» en cada paso; los avisos no desaparecen solos.
- Contraste AA o mejor; foco visible amarillo y azul; navegación completa con
  teclado; «Saltar al contenido»; un `h1` por página; `aria-current`.
- Recibos, resumen del mes, kárdex y listas imprimibles (`@media print`, sin
  barra lateral).
- Antes de cerrar la v1, prueba de uso con 2 o 3 personas adultas reales
  (tareas: cobrar, usar insumos, entregar uniforme, cerrar caja).

---

## 9. Datos de demostración

### 9.1 Mecanismo

- **Script nuevo** `supabase/seed/datos-panel-demo.sql` (versionado, **sin
  contraseñas**; no es una migración). Se ejecuta **después** de
  `datos-demo.sql`, en el editor SQL, y se detiene si faltan las 5 cuentas.
- Igual que el script actual: `c_simular := true` por defecto (ejecuta,
  comprueba y revierte con «OK · simulación…») e idempotente.
- **Pasa por las reglas reales**: cada escritura llama a **las mismas RPC**
  del panel con la sesión simulada de Carla o de Rosa (`set local role
  authenticated` + `request.jwt.claims`). Así la demo pone a prueba permisos,
  PEPS, promedio, cuotas y arqueos.
- **Fechas relativas** a `app.hoy()` (D = día de carga), para que el tablero
  no envejezca. Para llevar al pasado lo que el motor fecha hoy, el script
  activa el **modo mantenimiento** (§2.8) y ajusta fechas en orden
  cronológico; al final cierra los meses pasados con `cerrar_mes` (salvo el
  anterior al actual).
- **No se crean cuentas**: se usan las 5 existentes. Carla **opera El Alto**
  (no hay recepción allí).
- **Historial ya aprobado**: las solicitudes de Camila (3) y de Diego (1)
  ya están `aprobada` y `aprobar_solicitud` solo acepta pendientes. Sus
  inscripciones se crean con `inscribir` y luego el script fija
  `inscripciones.solicitud_id` (y `renueva_a`) **directamente, en modo
  mantenimiento**; ninguna RPC del panel admite enlazar una solicitud ya
  cerrada.
- **Personas ficticias sin carnet ni celular** (un número inventado podría
  ser de alguien real), con `observaciones = 'Persona ficticia de
  demostración'`.
- **Importes**: los únicos reales son **Bs 650** (Paquete Económico y juego de
  uniforme de la carrera). Costos de inventario y gastos son ficticios y
  llevan «(demo)» en su descripción o nota; los números de operación QR son
  `DEMO-QR-0001`…. **Ningún curso recibe precio**: alimentan «Sin precio
  definido».
- La cinta **«DEMOSTRACIÓN · datos ficticios»** se muestra con
  `PANEL_MODO_DEMO=si` en `.env.local` (y en Vercel mientras sea demo).

### 9.2 Cuentas y su papel

| Cuenta | En la demostración |
|---|---|
| Carla Gutiérrez (administración, La Paz) | Abre grupos y planes, compra, registra gastos, opera El Alto, verifica QR, cierra los meses pasados |
| Rosa Condori (recepción, La Paz) | Inscribe, cobra, usa insumos, entrega, presta, recibe y arquea La Paz |
| Valeria Choque (estudiante) | Su solicitud real del portal **no se toca**: si sigue `pendiente` o `en_revision`, es el ejemplo vivo de conversión; si fue cancelada o no existe, la semilla crea una con su sesión (mismas reglas del portal). Si el programa y la sede que pidió no tienen grupo abierto, la semilla abre uno `planificado` de ese programa en esa sede |
| Diego Mamani (estudiante) | Ficha enlazada; 1.er año 2026 noche La Paz (enlazado a su solicitud aprobada); uniforme entregado y cobrado; **su cuota del paquete venció hace 12 días**; si no tiene una renovación abierta, la semilla la crea con su sesión para convertirla **en vivo** al 2.º año 2027 |
| Camila Quispe (estudiante) | Ficha enlazada; 1.er año 2024 y 2.º año 2025 `concluido`, 3.er año 2026 `inscrito` (El Alto, mañana), cada uno enlazado a su solicitud aprobada; al día |

### 9.3 Grupos e inscripciones

| Grupo (estado) | Plan de pagos | Alumnos |
|---|---|---|
| Gastronomía · 1.er año · Mañana · 2024 · El Alto (cerrado) | Económico: 1 cuota de Bs 650, nota «periodicidad por confirmar» | Camila (concluido) |
| Gastronomía · 2.º año · Mañana · 2025 · El Alto (cerrado) | Igual | Camila (concluido) |
| Gastronomía · 3.er año · Mañana · 2026 · El Alto (en curso) | Igual | Camila, Nayeli Condo |
| Gastronomía · 1.er año · Noche · 2026 · La Paz (en curso, 25 cupos) | Económico igual; Ahorrador sin plan («Consultar») | Diego, Marco Callisaya, Andrea Huanca, Luis Ticona |
| Gastronomía · 2.º año · Noche · 2027 · La Paz (planificado) | Igual | — (destino de la renovación de Diego) |
| Gastronomía · 1.er año · Tarde · 2027 · La Paz (abierto, 30 cupos) | Igual | — (destino posible de Valeria) |
| Cocina · Sábados · 2 meses · La Paz (en curso, 15 cupos) | **Sin plan** | Lucía Apaza, Paola Quisbert, Ximena Rojas, Fernando Vargas |
| Repostería y Panadería · Lun–Mié · 4 meses · El Alto (en curso, 12 cupos) | **Sin plan** | Jhonny Mendoza, Sonia Pari |
| Tortas · Sábados · 2 meses · La Paz (abierto, empieza en D+10, 12 cupos) | **Sin plan** | Paola (también en Cocina: regla E2) |
| Coctelería · Jue–Vie · 1 mes · La Paz (planificado) | **Sin plan** | — |

Fechas de inicio y capacidades de los grupos son de demostración. Las
inscripciones históricas de Camila se crean **antes** de concluirse, y su
entrega de uniforme de 2024 **antes** de pasar esa inscripción a
`concluido` (la RPC exige inscripción vigente).

### 9.4 Dinero

- **Cuotas**: el Paquete Económico de cada inscripción de la carrera (Bs 650,
  1 cuota). Camila: todas pagadas (2026 por QR). Diego: **vencida hace 12
  días**. Marco y Luis: pagadas en efectivo. Andrea: **pago parcial de Bs
  300**. Nayeli: pagada por QR **sin verificar**.
- **Uniforme**: Bs 650 cargados a quien recibió el juego (Diego cobrado en
  efectivo; Andrea pendiente, con un cambio de talla S → M; Camila en 2024;
  Nayeli este año). Marco y Luis **sin uniforme** (aparecen en la alerta).
- **Cursos**: inscripciones sin cuotas → «Sin precio definido».
- **Un cobro anulado** con motivo (el sello y el «ANULADO» del recibo se ven).
- **Gastos (demo)** de los últimos 6 meses por sede: alquiler, servicios
  básicos, internet, limpieza, publicidad; para que el gráfico tenga forma.
- **Arqueos**: La Paz, uno por día hábil de las 2 últimas semanas; uno de los
  últimos 7 días con **diferencia de −Bs 5,00** («(demo) vuelto mal dado»),
  sin revisar. El Alto: **efectivo de ayer sin arqueo** (alerta para Carla).
  Hoy en La Paz: 3 cobros sin arquear.
- **Meses**: los anteriores con datos, cerrados en orden; **septiembre
  abierto** («Cierra septiembre»).

### 9.5 Inventario (costos ficticios)

| Sede | Artículo | Escenario |
|---|---|---|
| La Paz | Harina de trigo (kg, mínimo 25) | Lotes de 25 kg a Bs 170 y 25 kg a Bs 180 y un uso de 30 kg por el 1.er año: **el ejemplo de §5.3**; quedan 20 kg → «Bajo» |
| La Paz | Mantequilla (kg) | Lote que **vence en 4 días** → «Por vencer» |
| La Paz | Leche entera (l) | Lote **vencido ayer** con 3 l y nada más → «Vencido»; usarla muestra el error con lo vencido |
| La Paz | Huevos (unidad, mínimo 60) | **Bajo el mínimo** → «Registrar compra» |
| La Paz | Azúcar y chocolate de cobertura (kg) | Usos en Cocina Sábados (costo de insumos por grupo); un **conteo** de la semana pasada con faltante de 0,5 kg de azúcar («(demo) derrame») |
| La Paz | Sal (kg, sin vencimiento) | Saldo inicial |
| La Paz | Juego de uniforme de la carrera (S, M, L, XL; Bs 650) | Dos compras a distinto costo (**promedio**); XL **agotado**; M bajo el mínimo |
| La Paz | Juego de uniforme de capacitación (S, M, L) | **«Precio por definir»** |
| La Paz | Juego de cuchillos, tabla de picar, batidor de globo, manga pastelera, bol de acero | Saldo inicial; préstamo **atrasado** (Luis, cuchillos, venció ayer); préstamo que **vence hoy** (grupo Cocina Sábados); **baja por rotura** de una tabla |
| La Paz | Detergente (otro) | Uso interno |
| El Alto | Harina, azúcar (bajo el mínimo), juego de uniforme | Existencias pequeñas, operadas por Carla |

### 9.6 Lo que deben mostrar los tableros

| Indicador | Valor esperado |
|---|---|
| Solicitudes del portal | 1 o 2: la renovación de Diego y la de Valeria si sigue abierta |
| Utensilios atrasados | 1 (Luis) y «1 vence hoy» |
| Alumnos de carrera sin uniforme | 2 en La Paz (Marco, Luis) |
| Cuotas vencidas | 2 alumnos: Diego (Bs 650 del paquete) y Andrea (Bs 350 del paquete y Bs 650 del uniforme) |
| Insumos vencidos o por vencer | Leche (vencida) y mantequilla (por vencer) |
| Agotados o bajo el mínimo | Harina, huevos, juego M y XL (La Paz); azúcar (El Alto) |
| Caja por cerrar (Rosa) | 3 cobros de hoy |
| Requiere tu atención (Carla) | Cierra septiembre · efectivo sin arqueo en El Alto · 1 arqueo con diferencia · 1 QR sin verificar · bajas de 7 días · sin precio definido (Cocina, Repostería, Tortas) |
| Dinero del mes | Entró, salió, resultado y lo que deben, coherentes con §9.4 |

Antes de terminar, el script comprueba estos valores y que
`app.verificar_cuadre()` salga vacía.

### 9.7 Borrado

`borrar-datos-demo.sql` crece: en modo mantenimiento **vacía todas las tablas
del panel** (hasta la puesta en marcha, todo lo del panel es de
demostración), en orden de dependencias, y después borra las cuentas como
hoy. **Antes de producción se ejecuta entero** y se quita `PANEL_MODO_DEMO`.

---

## 10. Riesgos, decisiones por confirmar y orden de construcción

### 10.1 Riesgos

| Riesgo | Mitigación |
|---|---|
| Una función DEFINER sin su comprobación de permiso o de sede abre un hueco | Plantilla única (§3.2); batería por función con recepción de otra sede, estudiante, `anon` y administración |
| Errores de redondeo o de orden PEPS | Fórmula gemela en el dominio (`valuacion.ts`) y en SQL con los mismos ejemplos (§5.8); `verificar_cuadre` tras cada escenario y en el cierre de mes |
| Interbloqueos con documentos de varias líneas | Orden fijo de bloqueos (§3.12); prueba con dos sesiones en el editor SQL |
| Demasiada complejidad para el personal | PEPS y promedio invisibles; vocabulario de §7.3; asistentes cortos; prueba de uso con adultos reales |
| Datos del cliente que faltan (precios de cursos y Ahorrador, periodicidad, piezas del uniforme, QR) | «Consultar» y «Sin precio» visibles; planes y precios son datos que carga administración; nada en el código |
| Confundir los insumos del instituto con los que compran los estudiantes | Ayuda en «Registrar compra»: «Solo lo que compra el instituto» |
| No es contabilidad formal ni tributaria | Se dice en pantalla y en el recibo; el contador revisa métodos y conceptos antes de producción |
| Disciplina de caja | Alerta «efectivo sin arqueo» y el cierre de mes lo exige |
| `session_user` del editor SQL distinto de `postgres` | Se comprueba en R1; la condición vive en una sola función |
| Rendimiento de RLS y del plan gratuito | `(select …)` en políticas, índices de §2.9, una RPC por tablero, medición con volumen en transacción revertida |
| Memoria del equipo (el 2026-10-01 quedaron 417 procesos de Edge) | Comprobaciones en serie; un solo servidor de vista previa; solo `capturar-pagina.mjs` y `auditar-espacios.mjs` (cierran Edge por CDP); **agentes de uno en uno y sin navegadores en paralelo**; detener el servidor al terminar |
| La rama lleva la web y el portal sin aprobar | Rutas y layout separados (`/panel`); no se toca `(publico)` ni el portal salvo la redirección del personal |
| El cliente cambia piezas, precios o permisos | Todo es dato: `planes_de_pago`, `articulos.precio_venta`, `variantes`, `permisos_de_rol` |

### 10.2 Decisiones que debe confirmar el usuario (o el cliente)

1. **Valuación** PEPS en insumos y promedio en uniformes, utensilios y otros; sin depreciación; equipos mayores fuera (D18; validar con el contador).
2. **Fin del «ajuste que fija»**, sustituido por el conteo con faltante y sobrante (D15); cambia el ADR 0003 con un **ADR 0007**.
3. **Prestar no es sacar** (custodia sin valor).
4. **Solo los insumos que compra el instituto** entran al inventario.
5. **Uniforme** como juego por talla a Bs 650, entregado al inscribirse por primera vez (D17, P1, P2); el de capacitación, sin precio.
6. **Bs 650 por gestión** en la demo (plan de 1 cuota) hasta saber la periodicidad (D4).
7. **Ingresos devengados** por cuota en su mes; el dinero cobrado se ve aparte (D3).
8. **Recepción**: qué hace y qué no (D12, D13); compras y gastos menores son una fila si el cliente los quiere en recepción.
9. **Solo administración anula** (D9).
10. **Cierre de caja como arqueo**, sin bloquear cobros, varias veces al día (D7).
11. **Cierre de mes** que bloquea su fecha; reapertura solo del último y con motivo.
12. **Aprobar una solicitud es inscribir** (D24).
13. **Marca en el panel** (D30), que enmienda `identidad-visual.md` §9.
14. **Rótulos** «Carrera», «Capacitación» y «Grupo» (D36).
15. **Recibo interno numerado**, no factura; QR registrado por número de operación y verificado por administración (D21, D32).
16. **Personal**: administración puede dar acceso de administración (D27).
17. **Rama** `sistema-interno-v1` (D35).

### 10.3 Hechos del repositorio que se corrigen al empezar

- `CLAUDE.md` §0 y §16.1 dicen que `feat/sistema-interno` es igual a `main`
  en `25500d8`; **no lo es**: está en `08df150` (igual a `feat/pagina-web`) y
  7 commits por delante de su remota. La v1 llevará también la web y el portal.
- `supabase/migrations/README.md` («Pendientes previstas») se reemplaza por el
  plan de §2.10.
- `docs/domain/modelo-de-dominio.md` (reglas I3, I5 y estados de inscripción)
  y ADR 0003 cambian con el ADR 0007.

### 10.4 Orden de construcción (rebanadas verificables)

Cada rebanada termina con: `npm run typecheck`, `npm test`, `npm run build`,
`npm audit` y los greps de `CLAUDE.md` §8 (**en serie**); si toca la base,
su batería RLS, `verificar_cuadre` vacía, tipos regenerados y
`get_advisors(security)` y `(performance)`; si toca pantallas,
`auditar-espacios.mjs` a 1440 y 375 px, capturas reales y 0 atributos
`style`. Se marca en `TASKS.md` (Entrega 4) con su validación y se hace **un
commit por rebanada** en `feat/sistema-interno`.

| # | Rebanada | Contenido | Se verifica con |
|---|---|---|---|
| R0 | **Decisiones y dominio puro** | Corregir `CLAUDE.md` §0/§16; ADR 0007 (libro valorizado PEPS/promedio y conteo) y ADR 0008 (panel: permisos, sedes, patrón de RPC, caja y contabilidad básica); enmienda de identidad; objetivos en `TASKS.md`. Dominio: `valuacion.ts`, `movimiento.ts`, `articulo.ts`, `estudiante.ts`, `prestamo.ts`, `caja/`, `contabilidad/resumen.ts` | Pruebas con los ejemplos de §5.8 al centavo; Dependency Rule; el usuario revisa §10.2 |
| R1 | **Base del panel y esqueleto** | Migración `panel_nucleo` (comprobar antes `session_user` en el editor); `datos-demo.sql` con modo mantenimiento; `proxy.ts`, `destinoSeguro`, redirección del personal; layout, navegación lateral e inferior, guardas, `mi_contexto`, iconos nuevos, `panel.css` con las animaciones, bloque de confirmación, `traducirErrorDePanel` y su prueba | `curl`: `/panel` sin sesión → 307; estudiante → `/portal`; personal → 200. 39/39 RLS de la entrega 2. CSP sin violaciones. `datos-demo.sql` sigue cargando en simulación |
| R2 | **Alumnos, grupos y cuotas** | Migración de alumnos y cargos; `inscribir`, `aprobar_solicitud`, `cambiar_estado_de_inscripcion`, `generar_cuotas_de_grupo`; pantallas de alumnos, ficha, grupos y cupos, precio del grupo, solicitudes | Batería: recepción inscribe pero no abre grupos; aprobar por `update` falla; inscribir genera las cuotas del plan y ninguna sin plan; conversión de la solicitud de Valeria en transacción revertida. Flujos 6.9–6.11 y 6.17 |
| R3 | **Caja** | Migración de caja; `registrar_cobro`, `crear_cargo`, `registrar_gasto`, `caja_por_cerrar`, `cerrar_caja`, `revisar_cierre`, `verificar_cobros_qr`, `anular` (cobro, cargo, gasto); recibo imprimible; lo que deben; arqueos | Recibos sin huecos; referencia repetida rechazada; doble envío no duplica; el seguimiento de la anulación tardía (§5.7). Flujos 6.12–6.14, 6.16 |
| R4 | **Inventario** | Migración de inventario; motor `app.*`; `guardar_articulo`, `registrar_saldo_inicial`, `registrar_compra`, `usar_insumos`, `dar_de_baja`, `registrar_conteo`, `anular` (compra, uso, baja); existencias, ficha, historial | Paridad PEPS SQL ↔ TypeScript; vencidos saltados; invariantes de §2.7 vacías; recepción no lee ninguna `*_costo`; 50 000 movimientos medidos. Flujos 6.1, 6.2, 6.7, 6.8 |
| R5 | **Uniformes y utensilios** | `entregar_uniforme` (con cargo y cobro), `devolver_uniforme` (cambio de talla), `prestar_utensilios`, `recibir_devolucion` | El préstamo no cambia el valor; la pérdida sí; entrega y devolución se anulan al centavo. Flujos 6.3–6.6 |
| R6 | **Contabilidad** | Vistas de resumen y flujo, inventario valorizado, `verificar_cuadre`, `cerrar_mes`, `reabrir_mes`, auditoría, gastos y compras | El resumen coincide con sumas SQL directas; un mes cerrado rechaza inserciones; anular en octubre no cambia septiembre; `cuadre_fallido` provocado a propósito. Flujo 6.15 |
| R7 | **Tableros** | `tablero_recepcion`, `tablero_administracion`, gráfico SVG, estados vacíos, oferta para informar | Capturas a 1440 y 375 px con y sin movimiento reducido; consola sin violaciones de CSP; 48 px; contraste AA; revisión con la skill `ui-ux-pro-max` (sus scripts, con Docker; si Docker no está en marcha, su guía en Markdown) |
| R8 | **Datos de demostración** | `datos-panel-demo.sql` y `borrar-datos-demo.sql` ampliado | Ensayo «OK · simulación…»; el usuario lo carga; los tableros muestran §9.6 |
| R9 | **Revisión y entrega** | Revisión independiente (pocos revisores, **de uno en uno**); prueba de uso con adultos; documentación (`CLAUDE.md` §0, §3, §4, §9, §13, §16; `TASKS.md`; README de migraciones; `modelo-de-dominio.md`) | Todo en verde y anotado; rama `sistema-interno-v1` creada |

### 10.5 Entrega en la rama `sistema-interno-v1`

1. **Migraciones**: cada una se ensaya en una transacción revertida y se
   aplica a la base de prueba con `apply_migration` (el usuario dio libertad
   para modificarla); luego tipos, README y asesores.
2. **Commits**: uno por rebanada en `feat/sistema-interno`, en español, con el
   porqué y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. **Rama v1**: al cerrar R9, `git branch sistema-interno-v1` desde
   `feat/sistema-interno` (foto de la primera versión; las mejoras siguen en
   `feat/sistema-interno`).
4. **Subida** (el usuario la pidió): `git push -u origin sistema-interno-v1` y
   `git push origin feat/sistema-interno`. Si el gestor de credenciales de
   Windows responde `could not read Username`, **no se insiste**: se le da al
   usuario el comando para su terminal y se confirma después con `git
   ls-remote --heads origin`.
5. **Agentes**: si se usan, de uno en uno o en grupos pequeños y **sin
   navegadores simultáneos**, para no repetir la saturación de memoria y disco.

### 10.6 Cuándo la v1 está terminada

- Los 18 flujos de §6 funcionan en el navegador con Carla y con Rosa, en
  escritorio y en móvil, y cada uno termina en su confirmación.
- Recepción no puede leer ningún costo ni gasto por la API, ni operar en otra
  sede; el estudiante no ve nada del panel.
- `verificar_cuadre()` vacía con la demo cargada; batería RLS completa en
  verde; asesores sin avisos; 0 atributos `style`; sin desbordamiento a 375 px.
- Ningún precio, plazo ni dato institucional que no venga de
  `INFORMACION-INSTITUTO.md` o de las aclaraciones.
