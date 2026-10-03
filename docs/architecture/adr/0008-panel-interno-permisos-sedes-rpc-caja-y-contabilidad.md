# ADR 0008 — Panel interno: permisos por rol, alcance por sede, RPC en dos capas, caja y contabilidad básica

**Estado:** Aceptada · **Fecha:** 2026-10-02 · **Ámbito:** sistema interno (panel del personal) · Modifica los ADR 0002 y 0005 y la regla A2 de `docs/domain/modelo-de-dominio.md`

## Contexto

El ADR 0005 dejó tres roles fijos y anunció que el personal entraría «por el
panel del sistema interno con la misma autenticación». La v1 del sistema
interno (`docs/sistema-interno/especificacion-v1.md`, corregida por
`enmiendas-v1.md`, que manda sobre ella) lleva a ese panel operaciones que
mueven dinero e inventario en dos sedes (La Paz y El Alto). Las hacen personas
con poca experiencia en informática y las revisa administración. Hacía falta
decidir:

- cómo entra el personal y quién decide lo que puede hacer;
- cómo se limita a recepción a su sede;
- cómo escribe el panel en tablas que nadie debe tocar por la API (el libro
  de caja y de inventario) sin exponer funciones `SECURITY DEFINER`;
- cómo evitar que un doble clic o una red lenta cobren dos veces;
- qué fecha es «hoy»: el servidor trabaja en UTC y el instituto, en Bolivia;
- cómo funcionan la caja (deudas, cobros, recibos, arqueos y anulaciones) y
  una contabilidad básica sin cierre de mes, que pasó a la v1.1.

El ADR 0002 había previsto `user_sedes`, `app.has_permission` y
`app.current_app_user_id`. Nada de eso existe: este ADR describe lo que hay
hoy en las migraciones `20261002*.sql`. La valuación del inventario (PEPS,
costo promedio y conteo) se trata en el ADR 0007.

## Decisión

### 1. Un solo inicio de sesión; la base decide

- El panel vive en `/panel`, dentro de la misma aplicación. Usa la misma
  cuenta de Supabase Auth y la misma cookie que el portal. El proxy renueva la
  sesión también en `/panel`, y `destinoSeguro()` admite `/panel` como destino
  después del acceso.
- `src/app/panel/_sesion.ts` tiene dos guardas:
  - `exigirPersonal()` lee el contexto de `public.mi_contexto()` **una vez por
    petición** (`cache` de React; el layout y la página lo comparten). Sin
    sesión, lleva a `/portal/acceso?siguiente=…`. Un estudiante o una cuenta
    del personal desactivada vuelve a `/portal?panel=no`; el parámetro evita
    un bucle de redirecciones entre `/portal` y `/panel`.
  - `exigirPermiso(contexto, permiso)`: sin el permiso de la sección, vuelve
    a `/panel?aviso=sin_permiso`.
- Cada Server Action vuelve a exigir sesión y permiso. Aun así, las guardas
  solo deciden lo que se **muestra**. La base vuelve a decidir en la RLS de
  cada tabla y en la primera línea de cada motor (ADR 0002: esconder un botón
  no es seguridad).
- `public.mi_contexto()` (INVOKER, bajo RLS) devuelve quién es, su rol, si
  está activo, su sede, la fecha de negocio, sus permisos y las sedes en las
  que puede operar. Entra al panel quien tiene `panel.entrar` y una cuenta
  activa (`puedeEntrarAlPanel`, `core/domain/identidad/contexto-de-panel.ts`).
  El menú se arma con los mismos permisos (`seccionesVisibles`).

Evidencia: `20261002120000_panel_nucleo.sql` (`mi_contexto`),
`apps/web/src/app/panel/_sesion.ts`, `apps/web/src/proxy.ts`,
`apps/web/src/lib/redirecciones.ts`.

### 2. Permisos por rol en `permisos_de_rol`

Sigue el ADR 0005: el rol es un `enum` y lo que hace cada rol es una fila. Las
políticas y los motores preguntan por permisos, nunca por el nombre del rol.
`panel_nucleo` añade estos permisos:

| Permiso | Para qué | Administración | Recepción |
|---|---|:-:|:-:|
| `panel.entrar` | Entrar a `/panel` | ✓ | ✓ |
| `sedes.todas` | Operar en cualquier sede | ✓ | — |
| `estudiantes.leer` | Fichas e inscripciones | ✓ | ✓ |
| `estudiantes.gestionar` | Crear y editar fichas | ✓ | ✓ |
| `estudiantes.archivar` | Archivar una ficha | ✓ | — |
| `cohortes.leer` | Grupos, cupos y precios (para informar) | ✓ | ✓ |
| `cohortes.gestionar` | Abrir, editar y cerrar grupos | ✓ | — |
| `inscripciones.gestionar` | Inscribir, renovar, aprobar solicitudes, retirar | ✓ | ✓ |
| `inventario.leer` | Existencias, lotes, kárdex sin costos, préstamos | ✓ | ✓ |
| `inventario.operar` | Usar insumos, entregar uniformes, prestar, recibir, dar de baja | ✓ | ✓ |
| `inventario.catalogo` | Artículos y tallas | ✓ | — |
| `inventario.comprar` | Registrar compras | ✓ | — |
| `inventario.ajustar` | Saldo inicial y conteo físico | ✓ | — |
| `inventario.anular` | Anular compra, uso, baja y saldo inicial | ✓ | — |
| `caja.leer` | Cargos, cobros, lo que deben, arqueos | ✓ | ✓ |
| `caja.cobrar` | Cobrar, vender, cargar el uniforme al entregarlo | ✓ | ✓ |
| `caja.cerrar` | Arquear la caja de su sede | ✓ | ✓ |
| `caja.anular` | Anular cobros, cargos y gastos | ✓ | — |
| `contabilidad.leer` | Costos, valores, compras, gastos, resumen del mes, tablero de administración | ✓ | — |
| `contabilidad.gestionar` | Gastos, planes de pago, cargos manuales, cuotas de un grupo | ✓ | — |

Siguen vigentes los de la entrega 2 (`20261001120100_identidad_perfiles_y_permisos.sql`):
`perfiles.leer` y `solicitudes.leer`/`solicitudes.gestionar` para los dos
roles; `perfiles.gestionar`, `sedes.gestionar` y `programas.gestionar` solo
para administración.

- **No se crearon** `caja.supervisar`, `contabilidad.cerrar_mes` ni
  `auditoria.leer`: sus funciones pasaron a la v1.1 (enmiendas A.2).
- **Quien cobra no anula.** `caja.anular` e `inventario.anular` son solo de
  administración. `anular(clave, tipo, id, motivo)` elige el permiso por el
  tipo de documento: cobro, cargo y gasto exigen `caja.anular`; compra, uso,
  baja y saldo inicial, `inventario.anular`.
- **El estudiante no tiene ninguno.** Ve 0 filas en las tablas del panel y
  recibe `sin_permiso` en todas sus RPC.
- Qué permiso exige cada RPC:

| RPC | Permiso |
|---|---|
| `crear_estudiante` | `estudiantes.gestionar` |
| `inscribir` | `inscripciones.gestionar` (y `estudiantes.gestionar` si crea la ficha) |
| `aprobar_solicitud` | `solicitudes.gestionar` + `inscripciones.gestionar` |
| `cambiar_estado_de_inscripcion` | `inscripciones.gestionar` |
| `cerrar_grupo` | `cohortes.gestionar` |
| `registrar_cobro` | `caja.cobrar` |
| `caja_por_cerrar`, `cerrar_caja` | `caja.cerrar` |
| `crear_cargo`, `registrar_gasto`, `generar_cuotas_de_grupo` | `contabilidad.gestionar` |
| `anular` | `caja.anular` o `inventario.anular`, según el tipo |
| `guardar_articulo` | `inventario.catalogo` |
| `registrar_saldo_inicial`, `registrar_conteo` | `inventario.ajustar` |
| `registrar_compra` | `inventario.comprar` |
| `usar_insumos`, `dar_de_baja`, `devolver_uniforme`, `prestar_utensilios`, `recibir_devolucion` | `inventario.operar` |
| `entregar_uniforme` | `inventario.operar` (y `caja.cobrar` si carga o cobra) |
| `resumen_del_mes`, `verificar_cuadre`, `tablero_de_administracion` | `contabilidad.leer` |
| `resumen_de_deudores` | `caja.leer` |
| `variantes_con_movimientos` | `inventario.leer` |

### 3. Alcance por sede

- La sede de trabajo es `perfiles.sede_id`. Con `sedes.todas` (solo
  administración) se opera en cualquiera.
- `app.exigir_sede(p_sede)` es la regla, en este orden: sede inexistente o
  inactiva → `sede_no_operable`; con `sedes.todas`, pasa; cuenta sin sede →
  `sede_no_asignada`; otra sede → `sede_no_operable`. Lee la sede con
  `app.sede_de_sesion()` (DEFINER, sin pasar por la RLS de `perfiles`).
- La llaman los motores que **registran algo en una sede**: crear la ficha,
  inscribir (en la sede del grupo), cambiar el estado de una inscripción,
  cargo manual, cobro, gasto, caja por cerrar y cierre de caja, saldo inicial,
  compra, uso, baja, conteo, entrega y devolución de uniforme, préstamo y su
  devolución.
- Lo que la sede **no** limita:
  - **las lecturas**: ninguna política filtra por sede. Recepción consulta
    las dos («en El Alto sí hay talla M») y lee todos los cargos y cobros para
    que los saldos sumen bien (especificación §3.10);
  - **las escrituras directas de datos maestros** (editar una ficha o un
    artículo, abrir y editar un grupo, el plan de pagos y las tallas): solo
    las rige el permiso;
  - lo que solo hace administración (anular, cerrar un grupo, crear las
    cuotas de un grupo, dar de alta un artículo), que ya opera en todas.
- `app.puede_operar_sede` existe en `panel_nucleo`, pero hoy ninguna política
  ni ningún motor la usa.
- La pantalla solo ofrece las sedes que devuelve `mi_contexto` y propone la de
  trabajo (`sedeDeTrabajo`); la sede elegida viaja en el formulario y la base
  la vuelve a comprobar.
- «Recepción opera solo en su sede» es un **supuesto** (`CLAUDE.md` §16.3).
  Cambiarlo es dar `sedes.todas` a recepción: una fila.

Evidencia: `20261002120000_panel_nucleo.sql` (`app.sede_de_sesion`,
`app.exigir_sede`); los `perform app.exigir_sede(...)` de
`20261002130100_panel_alumnos_motor.sql`, `20261002140100_panel_caja_motor.sql`,
`20261002150100_panel_inventario_motor.sql`,
`20261002150200_panel_inventario_caja.sql` y
`20261002160000_panel_uniformes_prestamos.sql`.

### 4. Patrón de RPC: fachada INVOKER en `public`, motor DEFINER en `app`

- **Escrituras de varios pasos.** `public.<nombre>` es `security invoker`,
  `language sql` y tiene una sola línea: `select app.<nombre>(...)`.
  `app.<nombre>` es `security definer` con `set search_path = ''`. El esquema
  `app` no está expuesto por PostgREST: solo se llega por la fachada.
- **Grants.** La fachada lleva `revoke all … from public, anon`; el motor,
  `revoke all … from public`; las dos, `grant execute … to authenticated`.
  `anon` no ejecuta nada del panel.
- **Orden dentro del motor:** `app.exigir_permiso` primero (DEFINER salta
  la RLS, así que el permiso va antes de leer nada; `anular` compara antes
  el tipo con una lista fija para saber qué permiso pedir). `app.exigir_sede`
  va antes de `app.iniciar_operacion` cuando la sede llega como parámetro;
  cuando sale de una fila (cargo manual, cambio de estado de una inscripción,
  inscripción y alta de ficha, recepción de un préstamo), va después de
  leerla, y si falla la transacción revierte también la operación. Después:
  validaciones, candados, escritura y `app.terminar_operacion`. Dentro del
  motor, `auth.uid()` sigue siendo el de quien llama: el autor de cada fila
  (`registrado_por`, `anulado_por`, `cerrado_por`) es la persona, no la
  función.
- **El libro solo lo escribe el motor.** `cargos`, `pagos`,
  `pago_aplicaciones`, `gastos`, `cierres_de_caja`, `operaciones` y las tablas
  del libro de inventario no conceden escritura a `authenticated`. Los datos
  maestros de una fila se escriben directo, con grants por columna y políticas
  por permiso: editar una ficha o un artículo, abrir y editar un grupo, el plan
  de pagos y las tallas. El alta de una ficha (`crear_estudiante`) y la de un
  artículo (`guardar_articulo`) van por RPC.
- **Las lecturas agregadas tienen otra forma.** `mi_contexto`,
  `resumen_del_mes`, `verificar_cuadre`, `tablero_de_administracion`,
  `resumen_de_deudores` y `variantes_con_movimientos` son INVOKER
  directamente en `public`. Corren bajo la RLS de quien pregunta y también
  llevan `revoke … from public, anon`. Las tres de contabilidad exigen
  `contabilidad.leer` en su primera línea, `resumen_de_deudores`
  `caja.leer` y `variantes_con_movimientos` `inventario.leer`; `mi_contexto` no exige ninguno: un
  estudiante recibe sus permisos vacíos y el panel lo devuelve al portal. La
  excepción es `caja_por_cerrar`: fachada y
  motor DEFINER, porque recepción no lee `gastos` ni `compras` pero su arqueo
  las cuenta. Devuelve solo totales y lista las salidas en efectivo sin
  concepto ni proveedor («Salida registrada por Carla · 10:20 · Bs 150»,
  crítica 22).
- **Errores tipados.**
  `raise exception using errcode = 'P0001', message = '<codigo>', detail = <jsonb>::text`.
  El mensaje es el código (`^[a-z_]+$`) y el detalle trae los datos de la
  frase (por ejemplo `{"pendiente": 65000}`). La falta de permiso usa
  `errcode = '42501'` y `message = 'sin_permiso'`.
- **Traducción a frases.** `apps/web/src/infrastructure/supabase/errores-del-panel.ts`
  tiene en `MENSAJES_DE_PANEL` una frase por código que dice qué pasó y qué
  hacer, sin culpar y sin vocabulario técnico. Lo que no está en el catálogo
  cae en `traducirErrorDeBase` y, si tampoco, en un mensaje genérico. Ningún
  texto de PostgreSQL llega a la pantalla.
- **La prueba que los une.** `apps/web/tests/errores-de-panel.test.ts` extrae
  cada `message = '<codigo>'` de `supabase/migrations/*.sql` y exige su frase.
  También exige que no sobren frases sin código, que ninguna frase lleve
  palabras técnicas (`null`, `uuid`, `sql`, `error`…) y que un detalle mal
  formado no rompa la traducción.

Evidencia: `20261002120000_panel_nucleo.sql` (cabecera, «Patrón de las RPC del
panel»), las secciones «fachadas (API)» de cada motor,
`20261002170000_panel_contabilidad.sql`, `20261002180000_panel_tablero.sql`,
`supabase/migrations/README.md` (reglas 4, 5 y 8).

### 5. Idempotencia con la clave del formulario

- Cada formulario lleva una clave `uuid` que el servidor genera al dibujarlo
  (`randomUUID()` en un campo oculto).
- La tabla `operaciones (clave, tipo, registrado_por, resultado)` tiene RLS
  activa, todos los permisos retirados y **ninguna política**: solo la tocan
  funciones DEFINER. Cada documento guarda su `operacion_id`, que apunta a
  `operaciones(clave)`.
- `app.iniciar_operacion(clave, tipo)` inserta con `on conflict do nothing`:
  - si la clave es nueva, devuelve `null` y el motor sigue;
  - si ya existe, el índice único hace esperar a la otra transacción y
    devuelve su resultado con `repetida: true`, sin repetir nada;
  - si es de otra persona o de otro tipo de operación, lanza
    `clave_reutilizada`;
  - si la primera transacción falló, su fila no existe y la segunda sigue
    normalmente.
- `app.terminar_operacion(clave, resultado)` guarda el resultado una sola vez.
- **Clave derivada para el cobro anidado.** `entregar_uniforme` cobra en el
  acto llamando a `app.registrar_cobro` con `md5(clave || ':cobro')::uuid`. El
  cobro tiene su propia operación, y un reenvío de la entrega vuelve con el
  resultado guardado antes de llegar a él.

Evidencia: `20261002120000_panel_nucleo.sql` («idempotencia»),
`20261002160000_panel_uniformes_prestamos.sql` (`app.entregar_uniforme`).

### 6. La fecha de negocio es la de Bolivia

- `app.hoy()` es `(now() at time zone 'America/La_Paz')::date`. De ahí salen
  las fechas de los documentos: cobros, cargos de entrega y de venta,
  movimientos de inventario, arqueos y anulaciones (`anulado_el`) llevan
  siempre la fecha de hoy. Un gasto en efectivo es de hoy; uno por QR o
  transferencia admite hasta 30 días atrás (`fecha_invalida`). El año del
  recibo también sale de `app.hoy()`.
- **Fecha simulada.** `app.hoy()` devuelve `app.hoy_simulada` solo si
  `app.en_mantenimiento()`, es decir, si `session_user = 'postgres'` y
  `app.mantenimiento = 'si'`. Solo el editor SQL de Supabase y el conector
  corren como `postgres`. Por la API la sesión es `authenticator` y nunca lo
  cumple; `session_user` no cambia con `set role`. Ninguna función expuesta
  fija esas variables.
- La semilla de demostración (`supabase/seed/datos-panel-demo.sql`) «viaja en
  el tiempo» así: fija el día y llama a las **mismas RPC** con la sesión
  simulada de Carla o de Rosa. Todo pasa por las reglas reales.
- El modo mantenimiento **también deja pasar los disparadores del libro**
  (`app.solo_sellos`, `app.solo_crece`, `app.proteger_lote`), para los scripts
  de demostración que se ejecutan desde el editor SQL. No salta permisos,
  sedes ni validaciones de los motores: ninguno de ellos lo consulta.

Evidencia: `20261002120000_panel_nucleo.sql` (`app.en_mantenimiento`,
`app.hoy`), `20261002140000_panel_caja.sql` y
`20261002140200_panel_caja_libro.sql` (`app.solo_sellos`),
`20261002150000_panel_inventario.sql` (`app.solo_crece`, `app.proteger_lote`).

### 7. Caja

En simple: un **cargo** es lo que alguien debe; un **cobro** es dinero que
entró, con su recibo; un **gasto** es dinero que salió para que el instituto
funcione; un **arqueo** (cierre de caja) cuenta el efectivo.

- **Cargos** (`cargos`). Nacen de las cuotas del plan del grupo
  (`app.generar_cuotas` al inscribir; `generar_cuotas_de_grupo` para un grupo
  que ya tenía alumnos), del uniforme entregado con cargo, de una venta directa
  o a mano (`crear_cargo`, administración). Su `fecha` dice en qué mes cuenta
  como ingreso; su `vence_el`, desde cuándo está vencido. Al retirar a un
  alumno se anulan sus cuotas sin cobros que aún no vencen (`app.al_retirar`);
  las vencidas se siguen debiendo.
- **Cobros** (`pagos` y `pago_aplicaciones`).
  - Un cobro se aplica **entero** a cargos del alumno: la suma de sus
    aplicaciones es su monto, sin anticipos (D5).
  - Si no se indican los cargos, la base reparte del más antiguo al más nuevo
    (`vence_el`, `registrado_en`, id). Si se indican, respeta lo indicado y
    solo exige que ninguna aplicación supere lo pendiente
    (`aplicacion_excede_saldo`).
  - Una venta directa crea su cargo y el mismo cobro lo paga entero, también
    a alguien de fuera (`cliente`).
  - En QR y transferencia, el número de operación es obligatorio y no se
    repite entre cobros vigentes del mismo medio, sin distinguir mayúsculas
    (índice único y `referencia_repetida`).
- **Recibo sin huecos por sede y año.** `unique (sede_id, anio, numero)`.
  `app.siguiente_recibo` toma el candado consultivo `recibo:<sede>:<año>` y
  usa `max + 1`, así que una transacción revertida no deja un número tomado.
  Se muestra como `LP-2026-000123` (`app.numero_de_recibo`, gemela de
  `formatearRecibo` del dominio). Es un recibo interno, no una factura.
- **Orden de candados (enmiendas B.10).** Lo que mueve efectivo (cobro,
  gasto, compra en efectivo, su anulación y el cierre) toma **primero** el
  candado de la caja de su sede (`app.candado_de_caja`: el cierre siempre; los
  demás, solo si el medio es efectivo); después, existencias por variante,
  lotes, grupo, cargos por id y el recibo. Corrige el orden de la especificación §3.12, que ponía la caja al
  final.
- **Un documento no se edita ni se borra: se anula.** El disparador
  `app.solo_sellos` solo deja cambiar, una vez y de nulo a valor, el sello de
  anulación (`anulado_en`, `anulado_el`, `anulado_por`, `anulacion_motivo`) y
  las marcas del arqueo (`cierre_id`, `anulacion_cierre_id`).
  `pago_aplicaciones` y `cierres_de_caja` no admiten ningún cambio
  (`panel_caja_libro`).
- **Anular** (`anular`, solo administración) pone el sello con motivo
  (`motivo_requerido`). Un cargo con cobros vigentes no se anula
  (`cargo_con_cobros`). Al anular un cobro, sus cargos vuelven a quedar
  pendientes: lo aplicado de cobros anulados no cuenta.
- **Cierre de caja en dos fases** (`cerrar_caja`, con `caja.cerrar`, en su
  sede):
  1. Con el candado de la caja tomado, bloquea (`for update`) las filas por
     arquear de la sede y suma **esas** filas: cobros, gastos y compras sin
     `cierre_id`, y los anulados sin `anulacion_cierre_id`.
  2. Inserta el arqueo y marca `cierre_id` o `anulacion_cierre_id` en
     **exactamente esas filas**, por id.

  Un cobro que llega mientras tanto espera el candado y cae en el arqueo
  siguiente: nada queda contado sin marcar ni marcado sin contar.
  - `esperado = saldo inicial + entradas − salidas` (en efectivo);
    `diferencia = contado − esperado`; `queda = contado − retiro`, que es el
    saldo inicial del arqueo siguiente. El saldo inicial se escribe solo en el
    primer arqueo de la sede (`saldo_inicial_no_admitido` después).
  - Si no cuadra, exige una observación (`observacion_requerida`). Sin nada
    que contar, `nada_que_arquear`. QR y transferencia se informan aparte y no
    tocan el efectivo esperado.
  - `caja_por_cerrar` hace la misma cuenta sin escribir, para mostrarla en
    vivo.
  - No hay caja diaria que se abra y se cierre: se arquea todo lo no arqueado,
    las veces que haga falta, y un cobro nunca se bloquea (D7).
- **La anulación cuenta en el arqueo siguiente.** Un cobro en efectivo ya
  arqueado que se anula sale como salida en el próximo arqueo (el dinero se
  devolvió); un gasto o una compra en efectivo anulados vuelven como entrada.
  Si algo se registra y se anula antes del mismo arqueo, aparece como entrada y
  como salida, y se compensa.

Evidencia: `20261002140000_panel_caja.sql` (tablas, `app.solo_sellos`,
vistas `v_saldos_de_cargo` y `v_saldos_de_alumno`),
`20261002140100_panel_caja_motor.sql`, `20261002140200_panel_caja_libro.sql`,
`20261002150200_panel_inventario_caja.sql` (compras en el arqueo y `anular`
ampliado).

### 8. El precio del grupo se congela con el primer cargo

- El precio de un grupo vive en `planes_de_pago` (uno por paquete en la
  carrera). Lo carga administración (`contabilidad.gestionar`) con escritura
  directa.
- `app.congelar_plan` (disparador en `planes_de_pago`): en cuanto el plan
  tiene un cargo no anulado, ya no cambian `monto_cuota`, `cuotas`,
  `primer_vencimiento`, `cada_meses` ni `paquete`, y el plan no se borra
  (`plan_congelado`). Antes de eso se edita libremente; la nota siempre se
  puede cambiar.
- Esto **cambia la regla A2** de `docs/domain/modelo-de-dominio.md` («el costo
  se congela en la cohorte al abrirla»). Ahora lo cobrado y lo por cobrar no se
  mueven por debajo, y un grupo abierto sin cuotas todavía admite corregir su
  precio. Si hace falta cambiarlo después, se anulan las cuotas, se cambia el
  precio y se usa «Crear cuotas pendientes» (la frase de `plan_congelado` lo
  dice).
- `generar_cuotas_de_grupo` (revisión final, migración `20261003120000`):
  quien no tiene ningún cargo de su plan recibe todas sus cuotas; quien tiene
  alguna vigente se salta (una cuota anulada como beca o descuento no
  vuelve); quien tiene todas anuladas solo las recibe de nuevo si el plan
  cambió respecto de su última tanda (monto, calendario o número de cuotas),
  desde su primer vencimiento anulado. Con el plan igual, es una beca y no
  vuelve (N90, N91, N102–N105, N108).
- **Límite conocido:** la base no distingue una beca de unas cuotas anuladas
  para cambiar el precio. Si el precio del grupo cambia, las becas del grupo
  (las de quien tenía todas sus cuotas anuladas, y las cuotas sueltas de quien
  pasó por el cambio) vuelven a cargarse y hay que anularlas de nuevo. La
  pantalla del grupo lo avisa. Para la v1.1: una operación «cambiar el precio
  del grupo» que anule y vuelva a crear solo lo que ella misma anuló.

Evidencia: `20261002140000_panel_caja.sql` («precio congelado (regla A2)»),
`20261003120000_panel_revision_final.sql`; enmiendas B.12, crítica 30.

### 9. Contabilidad básica: una vista de gestión

- No hay partida doble ni plan de cuentas. Los totales salen de los mismos
  documentos: cargos, cobros, gastos, compras, arqueos y el libro de inventario
  valorizado.
- `resumen_del_mes(p_mes, p_sede)` (INVOKER, `contabilidad.leer`; con
  `p_sede` nulo suma todas las sedes):
  - **ingresos**: cargos con fecha en el mes, por grupo de concepto, menos los
    anulados en el mes (ingreso devengado, D3). Un cargo anulado antes de su
    propia fecha (una cuota futura que anula un retiro) nunca se devengó: no
    cuenta en su mes ni resta en el de la anulación (migración
    `20261003120000`, N93);
  - **costo de lo usado**: el valor que salió del inventario, por tipo de
    movimiento; una anulación cuenta como su original, al revés (`anula_a`);
  - **gastos**: los del mes por concepto, menos los anulados en el mes;
  - **dinero** por medio: cobros, gastos y compras, cada uno con sus
    anulaciones del mes. La compra es dinero e inventario, nunca gasto;
  - las diferencias de los arqueos del mes, el valor del inventario al inicio
    y al final del mes, lo que deben hoy y el valor del inventario hoy.

  El dominio (`core/domain/contabilidad/resumen.ts`) combina esos totales:
  `resultado = ingresos − costo de lo usado − gastos − diferencias de caja`
  («Ganancia» o «Pérdida»).
- **La anulación cuenta en el mes de `anulado_el`**, restando. El mes
  original no cambia.
- `verificar_cuadre(p_sede)`: el libro de inventario contra los saldos
  (cantidad y valor), los lotes contra el saldo en PEPS, cada compra contra la
  suma de sus líneas y cada cobro contra sus aplicaciones. Cada diferencia sale
  con el artículo o el documento que la causa.
- `tablero_de_administracion(p_sede)` (INVOKER, `contabilidad.leer`) da lo que
  ningún otro puerto da: efectivo de días anteriores sin arquear, arqueos del
  mes con diferencia, bajas y faltantes de los últimos 7 días, lo que quedó sin
  precio, el dinero del mes frente al mes anterior a la misma fecha y el de las
  últimas 8 semanas. El dinero sigue la misma regla: el alta cuenta en su fecha
  y la anulación en `anulado_el`. Con todas las sedes devuelve además la
  sede del efectivo sin arqueo más antiguo y la del arqueo con diferencia más
  reciente, para que el aviso lleve a esa caja.
- `resumen_de_deudores(p_sede)` (INVOKER, `caja.leer`) cuenta en la base
  cuántos alumnos deben, cuánto y lo vencido; lo usan los dos tableros y «Lo
  que deben», porque sumar una lista recortada daría una cifra falsa. El
  tablero de recepción no tiene otra RPC propia: lo demás sale de los puertos
  que ya existen.
- Es una **vista de gestión**, no un estado financiero oficial ni una
  declaración tributaria. El recibo dice «Recibo interno: no es factura».

Evidencia: `20261002170000_panel_contabilidad.sql`,
`20261002180000_panel_tablero.sql` y `20261002180100_panel_tablero_sedes.sql`
(rebanada R7),
`apps/web/src/core/domain/contabilidad/resumen.ts`,
`apps/web/src/infrastructure/supabase/contabilidad-desde-base.ts`.

### 10. Lo que pasa a la v1.1 (enmiendas A.2)

| Qué | Cómo queda en la v1 |
|---|---|
| Cierre y reapertura de mes (`periodos`, `cerrar_mes`, `reabrir_mes`, disparadores de período) | No existe. `verificar_cuadre()` sí existe |
| Auditoría (`auditoria`, `app.auditar`, pantalla) | No existe. Cada documento ya lleva autor, fecha y sello de anulación |
| `caja.supervisar`: verificar QR y revisar arqueos | No existe. Los arqueos con diferencia se ven en la lista de arqueos y en el tablero de administración |
| Ajustes › Conceptos (pantalla) | Conceptos de la semilla fija (la tabla `conceptos` existe) |
| Ajustes › Personal (pantalla; pasada a la v1.1 el 2026-10-03, ninguna rebanada la incluía) | La base ya lo permite (§2: `perfiles.gestionar` y la guarda del último administrador). El acceso del personal se da por SQL desde el editor de Supabase (`CLAUDE.md` §4); `/panel/ajustes` muestra un aviso |
| Devolver un sobrante de insumos a los mismos lotes | Práctica: registrar lo usado al terminar la clase; administración puede anular el uso y registrarlo bien |
| Ajuste de valor sin cantidad | Anular los usos posteriores y la compra, y registrarla bien |
| Prueba de uso con adultos reales | Pendiente del usuario; no condiciona la rama |

## Consecuencias

**A favor**
- Una sola autenticación y una sola fuente de permisos para el portal y el
  panel. Cambiar lo que hace recepción es insertar o borrar una fila.
- Ninguna función DEFINER se alcanza por la API sin pasar por una fachada que
  `anon` no ejecuta, y una prueba del repositorio lo vigila.
- Un doble envío nunca registra dos veces, el recibo no tiene huecos y el
  arqueo marca exactamente lo que contó.
- La fecha no salta al día siguiente a las 20:00 de Bolivia (medianoche UTC).
- Corregir es anular con motivo: queda quién, cuándo y por qué, y los montos
  siguen siendo positivos.
- El personal lee frases que dicen qué hacer, nunca un error de PostgreSQL.
- La demostración pasa por las mismas reglas que el uso real.

**En contra**
- La autorización queda repartida entre `permisos_de_rol`, las políticas RLS,
  la primera línea de cada motor y los disparadores. Para saber quién puede
  qué en un módulo hay que leer su migración.
- Cada RPC nueva son dos funciones con sus grants, su lugar en la prueba de
  cabeceras y sus frases en `errores-del-panel.ts`.
- Recepción puede leer por la API las fichas, cargos y cobros de la otra
  sede, aunque no opere en ella. Y como las escrituras directas de datos
  maestros no miran la sede, puede editar la ficha de un alumno de la otra
  sede (tiene `estudiantes.gestionar`).
- El modo mantenimiento salta los disparadores del libro para `postgres`:
  quien entra al editor SQL puede editar o borrar documentos. Es la misma
  persona que ya puede todo en la base; los scripts de demostración no se
  ejecutan en producción.
- Sin cierre de mes, un mes pasado todavía puede cambiar: una cuota que vence
  en ese mes cuenta allí aunque se cargue después (inscripción tardía o cuotas
  de un grupo creadas más tarde), y un gasto por banco admite hasta 30 días
  atrás. La anulación, en cambio, nunca toca el mes original.
- Ajustes › Personal todavía no tiene pantalla: el rol y la sede del personal
  se asignan por SQL (`CLAUDE.md` §4).

## Verificación

- `apps/web/tests/base-de-datos.test.ts`: toda función DEFINER vive en `app`
  y fija `search_path` (lee la cabecera completa, enmiendas B.11); las
  fachadas de `public` no son DEFINER y llevan `revoke … from public, anon`;
  las vistas `v_*` tienen `security_invoker`; cada tabla activa RLS y retira
  los permisos por defecto.
- `apps/web/tests/errores-de-panel.test.ts`: códigos de las migraciones y
  frases van juntos en los dos sentidos.
- `docs/runbooks/pruebas-rls-panel-v1.sql` (sesiones simuladas en una
  transacción que se revierte):
  - N01–N10, núcleo: `anon` sin acceso, estudiante sin permisos, recepción en
    su sede (N04), `operaciones` cerrada (N05), misma clave, mismo resultado
    (N06), clave ajena (N07), fecha simulada solo en modo mantenimiento
    (N09–N10);
  - N19: recepción de La Paz no inscribe en El Alto, pero ve el grupo;
  - N30–N47, caja: precio congelado (N31), reparto del más antiguo al más
    nuevo y recibo (N33), doble envío (N34), referencia y correlativo sin
    huecos (N35), recepción no escribe ni anula (N36), caja por cerrar igual
    al cierre (N38), diferencia con observación (N39), anulación tardía en el
    arqueo siguiente (N40), cargo con cobros (N41), libro inmutable (N45),
    cada cobro reparte su monto (N46);
  - N57: compra en efectivo, que sale de la caja y vuelve si se anula; N63:
    entrega con cobro anidado y reenvío que no entrega dos veces;
  - N73–N78, contabilidad: anulaciones en su mes (N76), recepción no la ve
    (N77);
  - N79–N83, tablero de administración; N87–N89, el aviso lleva a la sede
    del problema, lo que deben se cuenta en la base y la estudiante no lo
    lee.

## Pendiente

- Lo de la v1.1 (§10 de este ADR, enmiendas A.2).
- Confirmar con el usuario los supuestos anotados en `CLAUDE.md` §16.3:
  recepción opera solo en su sede; recepción cobra y arquea.
