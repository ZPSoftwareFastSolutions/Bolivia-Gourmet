**Correcciones a la especificación del sistema interno v1, por prioridad.** Cada punto lleva su tipo: (a) requisito débil, (b) contradicción interna, (c) choque con CLAUDE.md, (d) exceso de alcance.

PRIORIDAD ALTA (antes de R0)

1. (c) Falta la capa de aplicación, y la arquitectura CLEAN es obligatoria.
   - La sección §2.11 solo toca `core/domain`. No hay puertos, casos de uso, adaptadores ni composition root.
   - En el repositorio ya existen piezas que no pueden seguir así:
     - `core/application/inventario/registrar-movimiento.usecase.ts` y `ports/inventario-repository.port.ts` insertan movimientos directamente con `guardarMovimiento`. Eso es imposible sin grants (§2.8).
     - `inventarioRepository()` en `infrastructure/config/composition-root.ts` lanza un error.
     - `tests/casos-de-uso.test.ts:108` prueba `ajuste`.
   - Corrección: añadir una §2.12 con:
     - puertos por módulo (Alumnos, Caja, Inventario, Contabilidad, Tableros) que envuelven las RPC y las lecturas;
     - casos de uso que validan con el dominio antes de llamar a la RPC;
     - adaptadores `infrastructure/supabase/panel-*.supabase.ts` creados por petición en el composition root.
   - Decir qué se hace con el caso de uso, el puerto y las pruebas actuales (se reemplazan en R0 y R4).
   - Añadir a los greps de §8: `app/panel` no importa `@infra/supabase`.

2. (b) La demo no puede convertir solicitudes.
   - En §3.7, `inscribir` exige que el grupo esté `abierto` o `en_curso`.
   - Pero §9.3 deja «2.º año · Noche · 2027 · La Paz» (destino de Diego) en `planificado`, y §9.2 abre para Valeria un grupo `planificado`.
   - Corrección: definir en §2.3 qué admite cada estado (abierto = admite inscripciones) y poner en `abierto` los grupos 2027 de la demo.

3. (b) Renovar concluye antes de tiempo.
   - §3.7 y §6.9.5 pasan la inscripción anterior a `concluido` al renovar.
   - En octubre Diego sigue en 1.er año 2026, con el grupo `en_curso`. Saldría de `v_grupos.inscritos`, de `v_sin_uniforme`, de «Carrera por año» y del índice parcial E1.
   - Además, no hay forma de concluir en bloque: cerrar un grupo deja a todos en `inscrito`.
   - Corrección: renovar solo enlaza `renueva_a`. Añadir una RPC `cerrar_grupo(p_clave, p_cohorte)` que pase los inscritos a `concluido` y avise de las cuotas pendientes.

4. (b)(a) Los cursos de temporada no se pueden operar.
   - `validarCohorte` (programa.ts:268-287) rechaza la duración pendiente y `diasDeClase` vacío.
   - `cursos-de-temporada` tiene las dos cosas (oferta-academica.ts:306-321).
   - Sin embargo, §6.10 los ofrece en Capacitación, y por D24 sus solicitudes no podrían aprobarse nunca.
   - Corrección, una de dos:
     - admitir grupos de temporada con fechas y modalidad, sin días ni duración (ajustar `validarCohorte` y los `check` de `cohortes`);
     - o excluirlos de la v1 y dejar en la bandeja solo «Pedir más datos» y «Rechazar».

5. (b) Con lotes PEPS, el faltante y las bajas que no son por vencimiento fallan si hay lotes vencidos.
   - En §5.3, `sacar_peps` con `lote_elegido = null` salta los vencidos. El conteo saca el faltante «por PEPS» y `dar_de_baja` por daño o merma usa lo mismo (§3.6).
   - Ejemplo: con la leche de §9.5 (su único lote está vencido), cualquier faltante da `stock_insuficiente`.
   - Además, `existencia_vista` se compara con `disponible`, que incluye lo vencido.
   - Corrección: añadir el parámetro `incluir_vencidos` en `app.sacar`.
     - El uso en clase salta los vencidos.
     - El faltante y las bajas que no son por vencimiento consumen primero lo vencido y después siguen el orden PEPS.
   - Añadir el caso a §5.8.

6. (b) La paridad entre el dominio y SQL no se cumple con coma flotante.
   - §2.11 promete «la misma fórmula» con `Math.round`.
   - Comprobado en Node: `3*0.35/2.1` da `0.4999999999999999` y `Math.round` da 0. En PostgreSQL, `round(3*0.350/2.100)` da 1.
   - Corrección: el dominio trabaja las cantidades en milésimas enteras (`BigInt`) con redondeo de la mitad hacia arriba, `(2·v·t + c) div (2·c)`. La base usa la misma expresión.
   - Añadir este caso a §5.8.

7. (b)(d) Historia financiera de la demo y puesta en marcha.
   - Lo que pide la demo:
     - §9.4 crea cuotas y cobros de Camila en 2024 y 2025, y una entrega de uniforme en 2024 (con inventario de 2024).
     - §9.1 cierra los meses pasados con `cerrar_mes`, que exige el mes anterior cerrado y todo el efectivo arqueado.
     - Eso suma unos 30 cierres en orden, arqueos retroactivos, recibos por año y lotes con fecha atrasada.
   - En producción, §6.18.3 («Inscribir a los alumnos actuales») genera cuotas que ya se pagaron antes del sistema, y no hay saldo inicial de cuentas por cobrar.
   - Corrección:
     - fijar una fecha de puesta en marcha (en la demo, el día 1 del mes anterior);
     - lo anterior es solo historia académica, con inscripciones concluidas y sin dinero;
     - añadir a `inscribir` la opción «sin cuotas anteriores a la puesta en marcha», o un cargo de origen `saldo_inicial`;
     - la demo cierra como mucho un mes.

8. (c) Seguridad: el enlace automático por documento.
   - En §3.7, el paso 3 de `aprobar_solicitud` enlaza una ficha «sin cuenta» usando `perfiles.documento`.
   - Ese dato lo declara el propio usuario y a propósito no es único (identidad.sql:33-34: «alguien podría ocupar el carnet de otra persona»).
   - El riesgo es que alguien se apropie de la ficha de otra persona: deudas, historial y, más adelante, datos en el portal.
   - Corrección: nunca enlazar solo. Mostrar la coincidencia y pedir confirmación explícita del personal.

9. (b) Interbloqueo en caja.
   - En §3.12 el candado de caja va al final y `anular` no aparece en la lista.
   - `anular` bloquea la fila de `pagos`. Mientras tanto, `cerrar_caja`, que ya tiene el candado, hace `update pagos … where cierre_id is null`. Esperan en círculo.
   - Corrección: toda operación que mueva efectivo toma primero el candado de caja de la sede, `anular` incluido. Reescribir el orden de §3.12.

10. (c) La prueba que vigila las funciones DEFINER es débil, y D1 se apoya en ella.
    - `tests/base-de-datos.test.ts:72-74` solo mira los primeros 400 caracteres.
    - Un motor con muchos parámetros (`registrar_compra`, `inscribir`, `entregar_uniforme`) deja `security definer` fuera de esa ventana y la prueba lo salta en silencio. Si lo que queda fuera es `set search_path`, la prueba falla sin motivo.
    - Corrección:
      - leer la cabecera hasta `as $$`;
      - comprobar que las vistas `v_*` usan `security_invoker` y que se les retira `anon`;
      - comprobar que las fachadas de `public` no son DEFINER ni ejecutables por `anon`.

11. (b) El modo mantenimiento anula el ensayo de la demo.
    - Con `set_config('app.mantenimiento','si',true)` la variable dura toda la transacción del script.
    - Además, `session_user` sigue siendo `postgres` después de `set local role authenticated`.
    - Resultado: las RPC llamadas por la demo saltan D10 y la regla de período cerrado, y la promesa de §9.1 («pasa por las reglas reales») se pierde.
    - Corrección: activar el modo y volver a `'no'` solo alrededor de cada ajuste de fechas.

PRIORIDAD MEDIA

12. (b) Anular una baja que nació en `recibir_devolucion` descuadra el préstamo.
    - §3.9 dice que una baja se anula «siempre». Al anularla vuelve `prestado`, pero `prestamos.perdida` y `cerrado_en` quedan igual.
    - Corrección: prohibir anular bajas con `prestamo_id`, o revertir también el préstamo.
    - Añadir a §2.7: `existencias.prestado = Σ(cantidad − devuelta − perdida)` de los préstamos abiertos.

13. (b) La alerta «entregas sin cargo» de §7.7 no se puede resolver.
    - `crear_cargo` (§3.8) tiene `p_prestamo` pero no `p_entrega`.
    - Tampoco admite `cliente`, que hace falta para pérdidas de préstamos a un grupo o a un docente.
    - Corrección: añadir `p_entrega` y `p_cliente`.

14. (b) Devolver un uniforme sin cambio de talla no dice qué pasa con el dinero.
    - §3.6 y §6.4 no dicen nada del cargo de Bs 650 ni de su cobro. El costo se revierte pero el ingreso queda.
    - Corrección: escribir el camino en §6.4. Si no hay cobros, se anula el cargo; si está cobrado, se anula el cobro. Las dos cosas las hace administración.

15. (b) Retiro.
    - En §3.7 «las cuotas pendientes no se tocan». Con D3, las cuotas futuras de un retirado siguen contando como ingreso y siguen en «Lo que deben».
    - Corrección: al retirar, anular las cuotas sin cobros con `vence_el > hoy`, o mostrar a administración la alerta «Cuotas de retirados».
    - Además, §7.5 dice «(adm.) Retirar» y §4.1 da `inscripciones.gestionar` (que incluye retirar) a recepción. Unificar.

16. (b) Orden de salida: PEPS frente a «primero lo que vence antes».
    - Si un lote nuevo vence antes que uno antiguo, la pantalla avisa pero el sistema saca del antiguo (§5.3).
    - Si el personal usa físicamente el que vence antes, los lotes del sistema dejan de coincidir con el estante. Entonces D14 bloquea existencias sanas o pide dar de baja lo que no está vencido.
    - Corrección: la salida física sigue siempre el orden que indica el sistema. Cuando haya inversión, `usar_insumos` admite elegir el lote.

17. (a) «Todo lo referido a PEPS» exige la tarjeta de kárdex PEPS clásica.
    - `v_kardex_valorizado` no muestra entradas, salidas y saldo con cantidad, costo unitario y total por cada lote.
    - Corrección: añadir para administración una vista imprimible «Tarjeta PEPS» por insumo y sede, construida desde `movimiento_lotes`.

18. (a) No hay camino para devolver insumos sobrantes de una clase.
    - Hoy solo se puede anular el uso completo, y recepción no anula.
    - Corrección: añadir `devolver_sobrante(p_clave, p_operacion, líneas)`, que reingresa a los mismos lotes y al mismo costo. O fijar la práctica «registra lo usado al terminar la clase».

19. (b) El disparador de período de §2.8.4 se aplica en exceso.
    - Si actúa en toda tabla con `fecha`, bloquea cambios legítimos sobre filas de meses cerrados: el sello de anulación, `cierre_id`, `devuelta`, `cerrado_en`, `cantidad_restante`.
    - Corrección: aplicarlo solo en INSERT, y en UPDATE solo si cambia la columna `fecha`.

20. (b) Las migraciones hacen referencias adelantadas.
    - `cargos.entrega_id` y `prestamo_id`, en 120100, apuntan a tablas que se crean en 120300.
    - `cerrar_caja`, `caja_por_cerrar`, `app.totales_de_caja` y `anular`, que son de R3, tocan `compras`, que es de R4.
    - Corrección: añadir las claves foráneas con `alter table` y recrear esas funciones con `create or replace` en 120300. Anotarlo en §2.10.

21. (b) D5 y `registrar_cobro` dicen cosas distintas.
    - D5: los cobros se aplican «del más antiguo al más nuevo».
    - `registrar_cobro` (§3.8) acepta `[{cargo, monto}]` libres, y §6.12.2 deja escribir el monto de cada cargo.
    - Corrección: decidir si la base exige ese orden o si es solo una sugerencia de la pantalla, y dejar una sola regla.

22. (b) Recepción arquea salidas que no puede ver.
    - Los gastos y compras en efectivo de administración restan del «esperado», pero recepción no lee `gastos` ni `compras` (§3.10).
    - Corrección: `caja_por_cerrar` muestra esas salidas línea a línea, sin datos sensibles («Salida registrada por Carla · 10:20 · Bs 150»).
    - Añadir un aviso: lo que se pague en efectivo se registra el mismo día, antes del arqueo (es lo que exige D10).

23. (b) `linea_repetida` y `ya_tiene_movimientos` bloquean casos reales.
    - En `registrar_compra`, `linea_repetida` impide comprar un insumo con dos vencimientos distintos en la misma nota.
    - En `registrar_saldo_inicial`, `ya_tiene_movimientos` impide cargar dos lotes de la misma variante.
    - Corrección: permitir líneas repetidas cuando `vence_el` difiere, con una `fecha_ingreso` por línea para el orden PEPS.

24. (b) El sobrante en costo promedio no está definido.
    - La tabla de tipos de movimiento (§2.5) dice «último costo», pero en promedio no hay «último lote».
    - Corrección: si total > 0, al promedio vigente. Si total = 0, al último costo unitario de compra. Si nunca hubo compras, lo escribe administración.

25. (b) No hay forma de corregir un costo mal escrito.
    - Una compra ya usada en parte no se anula. §8.5 sugiere «baja o conteo», pero eso solo corrige la cantidad, no el valor.
    - El saldo inicial tampoco se puede anular.
    - Corrección: documentar el camino (anular los usos posteriores y después la compra) o añadir `ajuste_de_valor`, solo para administración. Permitir anular un saldo inicial que no tenga movimientos posteriores.

26. (b) Hay códigos de error que la base no produce.
    - §3.9 espera `ultimo_administrador`, pero `app.proteger_perfil` (identidad.sql:178-190) lanza frases con 42501 y 23514. Lo mismo ocurre en los disparadores de `solicitudes`.
    - La prueba `errores-de-panel.test.ts` no los verá.
    - Corrección: que la RPC lo compruebe antes y lance el código, o reescribir esos `raise` con `message = '<codigo>'`.

27. (c) Datos institucionales que se presentan como hechos.
    - D13 cita aclaraciones §3 para «solo en su sede», pero aclaraciones:38 no lo dice.
    - «Recepción cobra y arquea» tampoco está en aclaraciones §3 ni en CLAUDE.md §15.2. Las dos cosas son supuestos y van a §10.2.
    - El «uso de 30 kg por el 1.er año» de la demo choca con `NOTA_INSUMOS_CARRERA` (oferta-academica.ts:83-84) y con la regla I8: en la carrera, los insumos los compran los estudiantes.
      - Reencuadrarlo como demostraciones del docente, eventos o degustaciones.
      - Preguntar al cliente (P3).
    - D4 fija una periodicidad que la web evita (CLAUDE.md §16.3.2). Poner la nota «periodicidad por confirmar» también en el recibo y en «Lo que deben».

28. (c) El precio vive en dos sitios.
    - El catálogo publica el Paquete Económico y el uniforme a Bs 650 (oferta-academica.ts:148-152).
    - El panel cobra lo que diga `planes_de_pago` o `articulos.precio_venta`.
    - Corrección: avisar o validar cuando el plan de un grupo de la carrera o el precio del juego de uniforme no coincidan con el catálogo.

29. (a) Los tableros están cargados para lo que pidió el usuario («no tan saturados»).
    - Recepción (§7.6) tiene 6 bloques.
    - Administración (§7.7) tiene 5 acciones, hasta 6 alertas, 4 cifras, 2 tarjetas y un gráfico.
    - Corrección:
      - recepción: 4 acciones (Cobrar, Inscribir, Usar insumos, Entregar uniforme); los préstamos se atienden desde su alerta y la «Oferta» pasa a Alumnos › Grupos;
      - administración: sin la tarjeta «Alumnos e inventario» y con 4 alertas visibles.

30. (c) Reglas del dominio que cambian sin decirlo.
    - A2 (modelo-de-dominio.md:81) dice que el costo se congela al abrir el grupo; la especificación lo congela con el primer cargo.
    - `EstadoDeCohorte` es `'planificada' | 'abierta' | …` (programa.ts:215) y la base usa el masculino.
    - `Cohorte.nombre` y `costoVigente` (programa.ts:222 y 234) deben eliminarse, y `validarCohorte` deja de exigir nombre (l. 258).
    - Corrección: listarlo en §2.11 y en los ADR 0007 y 0008, y quedarse con una sola forma de los nombres.

PRIORIDAD BAJA

31. (b) La misma cuenta de caja tiene dos permisos.
    - `caja_por_cerrar` exige `caja.cerrar`; `app.totales_de_caja`, que hace la misma cuenta, exige `caja.leer`.
    - Corrección: que `caja_por_cerrar` sea la fachada de `app.totales_de_caja`, con un solo permiso.

32. (b) La lista blanca de columnas de `inscripciones` (§2.8.3) es demasiado corta.
    - Solo permite cambiar el estado.
    - Hay que añadir `documentos_entregados` y `observaciones`, que §3.9 concede, y `motivo_de_retiro`.

33. (b) Detalles incoherentes en §9.4 y §9.6.
    - «Internet» aparece como gasto de la demo pero no está en la semilla de conceptos (§2.4).
    - Falta definir el `vence_el` del cargo de uniforme.
    - Falta definir si el uniforme de Nayeli y el de Camila en 2024 están pagados. De eso depende «Cuotas vencidas: 2 alumnos».

34. (b) El faltante de caja no aparece en el flujo.
    - El seguimiento de §5.7 pone «Arqueo con faltante: −5» en dinero.
    - `v_flujo_mensual` no incluye las diferencias de caja. Alinear las dos.

35. (b) Borrar una cuenta de estudiante fallaría.
    - Las solicitudes se borran en cascada desde `perfiles` (solicitudes.sql:25).
    - `inscripciones.solicitud_id` las referencia, así que necesita `on delete set null`.

36. (c) El nombre del grupo está duplicado.
    - `nombreDeGrupo()` en TypeScript y `app.nombre_de_grupo()` en SQL arman el mismo rótulo y pueden divergir. Una prueba debe compararlos con los mismos casos.
    - `validarCohorte` recibe el `Programa` por parámetro: el dominio no importa el catálogo.

37. (c) Dos ajustes de Next y Tailwind.
    - No depender de `:target` tras el `redirect` de una Server Action. La página ya relee `ref` y puede marcar la fila desde el servidor con `data-nuevo`.
    - `styles/panel.css`, en Tailwind v4, necesita `@reference` a `globals.css` para usar los tokens.

38. (c) Correcciones de repositorio que §10.3 no recoge.
    - `feat/pagina-web` ya está en `origin` en `08df150` (según `git branch -vv`), así que «entrega 3 solo en local» de CLAUDE.md §16.1 está obsoleto.
    - La prueba `destinoSeguro` (seguridad.test.ts:79-86) hoy exige `/portal`: hay que ampliarla a `/panel`.

39. (a) Faltan filtros en la lista de alumnos.
    - Por estado (inscrito, retirado, concluido, archivado), por año de carrera, por grupo y por sede.
    - Una vista de egresados (3.er año concluido).

40. (a) «Lo que deben» mezcla lo vencido con lo que aún no vence.
    - `total_pendiente` incluye cuotas que todavía no vencen.
    - En el tablero, la cifra principal debe ser lo vencido, con lo «por vencer» aparte.

41. (a) Con el selector en «Ambas», no está dicho en qué sede opera administración. El primer paso de cada formulario debe pedir la sede, sin suponerla.

42. (b) Códigos de serie con riesgo de duplicado.
    - El código de alumno (`BG-2026-0007`) y el de artículo (`INS-0001`) salen de un disparador.
    - Con dos altas simultáneas, ambas pueden tomar el mismo número y una falla con un error sin traducir.
    - Corrección: candado consultivo, como en los recibos.

43. (c) El vino de Capacitación junto al rojo de las acciones irreversibles se puede confundir. Usar chip de contorno o un icono propio.

VEREDICTO DE LOS CASOS BORDE DE PEPS

- **Consumo que abarca varios lotes:** cubierto (§5.3, ejemplo al centavo con `movimiento_lotes`).
- **Lote vencido:**
  - cubierto en el uso en clase (D14) y en la baja por vencimiento;
  - roto en el faltante de conteo y en las bajas por otros motivos (punto 5);
  - falta decidir el orden de salida cuando un lote nuevo vence antes que uno antiguo (punto 16).
- **Devolución:**
  - uniformes cubierto (al costo con que salió);
  - insumos sin camino (punto 18);
  - anular un uso devuelve a los mismos lotes, pero si ese lote ya venció la cantidad reaparece vencida. El diálogo debe decirlo.
- **Ajuste positivo (sobrante):**
  - cubierto en PEPS (lote nuevo al último costo, al final de la cola);
  - sin definir en promedio (punto 24);
  - un conteo erróneo no se puede anular (punto 25).
- **Ajuste negativo (faltante):** definido, pero falla cuando hay lotes vencidos (punto 5).
- **Costo de lo consumido:** cubierto (remanente exacto, `movimientos_costo`, resumen y cuadre), salvo la paridad entre TypeScript y SQL (punto 6).

(d) EXCESOS DE ALCANCE: DIFERIR A v1.1

- **Cierre y reapertura de mes** (`periodos`, `cerrar_mes`, `reabrir_mes`, fotografía y disparadores de período).
  - En la v1 se queda `verificar_cuadre` y el aviso «Cierra septiembre», sin bloquear nada.
  - Esto elimina la mayor parte del costo de la demo (punto 7).
- **Auditoría:** D31, tabla `auditoria`, `app.auditar` en 7 tablas y su pantalla.
- **Verificación de QR y revisión de arqueos:** `caja.supervisar`, 2 RPC y 2 alertas.
- **Ajustes › Conceptos:** en la v1 basta la semilla fija.
- **Gráfico de 6 meses**, los 6 meses de gastos de demostración y la comparación «12 % más que en septiembre».
- **Préstamos a un grupo o a una persona externa:** en la v1, solo a alumnos.
- **Catálogo de 12 animaciones:** dejar sello con check, cambio de valor, destello de fila, sacudida de errores y giro del botón.
- **Medición con volumen:** una sola medición de 50 000 movimientos, en R4.
- **Prueba de uso con adultos reales** (§8.7 y §10.6): el asistente no puede hacerla. Va a pendientes del usuario y no es condición para crear la rama `sistema-interno-v1`.
- **Nombre de la rama:** el usuario pidió «una rama v1». D35 usa `sistema-interno-v1`, que es válido porque `feat/sistema-interno/v1` choca con la rama existente.
  - Hay que confirmarlo con él.
  - Hay que avisarle de que esa rama lleva también la web y el portal, que todavía no aprobó.

Especificación revisada: C:/Users/LENOVO/AppData/Local/Temp/claude/F--Proyectos-INST-GASTRO/86744f0f-2282-41e2-be1c-559c8c2cc407/scratchpad/especificacion-sistema-interno-v1.md
