# ADR 0003 — Inventario: tipo con comportamiento, variantes y libro de movimientos inmutable

**Estado:** Aceptada · **Fecha:** 2026-09-30 · **Ámbito:** sistema interno · módulo inventario

## Contexto

El encargo pide controlar utensilios, insumos y uniformes, «y otros elementos
que posteriormente puedan incorporarse», advirtiendo que **no todos los
productos se comportan igual**: los uniformes se entregan a estudiantes y
tienen tallas; los insumos se consumen y pueden medirse en kilos o litros; los
utensilios se controlan por existencia y bajas. Además debe quedar registrado
qué se entregó, a quién, cuándo y en qué contexto, sin procesos
innecesariamente complejos.

GYM PLATFORM V4.3 resolvió su inventario con una tabla plana
(`name, category, quantity, price`) editada directamente. Es simple, pero no
deja historial ni distingue comportamientos: no sirve aquí.

## Decisión

1. **`Articulo.tipo` decide el comportamiento.** Enum `utensilio · insumo ·
   uniforme · otro`, con una tabla de comportamiento en el dominio
   (`COMPORTAMIENTO_POR_TIPO`): si se entrega a estudiantes, si admite
   devolución, si usa tallas, si la cantidad puede ser fraccionaria. Añadir un
   tipo es añadir una fila a esa tabla; añadir una categoría es un insert del
   usuario (las categorías son libres y no cambian el comportamiento).
2. **Todo artículo tiene variantes.** Al menos una («Única»). Los uniformes,
   una por talla. El stock vive en la variante, por sede.
3. **El stock es la suma de un libro de movimientos inmutable.** Tipos:
   `entrada · salida · entrega · devolucion · ajuste · baja`. No hay UPDATE ni
   DELETE de movimientos; un error se corrige con el inverso. `ajuste` fija la
   existencia a un valor y exige motivo; `baja` exige motivo.
4. **El stock nunca queda negativo.** La regla vive en el dominio
   (`aplicarMovimiento`) y se repite en la base (`CHECK` o disparador): la
   pantalla anticipa, la base decide.
5. **La entrega es una entidad propia** (`Entrega`) que apunta a una
   **inscripción** (no al estudiante suelto: así se sabe para qué programa) y
   lleva un **contexto** explícito: `inscripcion`, `sesion` (con id),
   `reposicion` u `otro`. Cada entrega genera exactamente un movimiento
   `entrega`; una devolución, uno `devolucion`.
6. **El sistema registra, no decide, cuándo toca entregar un uniforme.** La
   regla de negocio (al inscribirse, en la primera sesión, tras pagar) está
   pendiente de confirmar con el cliente (P2). El modelo la soporta sin
   cambios cuando se defina: será una comprobación en el caso de uso, no un
   cambio de esquema.

## Motivos

- Un tipo con comportamiento evita el «todos los productos son iguales» y
  también el extremo contrario (una tabla por tipo con lógica duplicada).
- Un libro inmutable da historial, responsables y trazabilidad gratis, y es
  la misma regla que ya rige los pagos: lo registrado no se edita.
- Variantes en vez de «Chaqueta talla M» como artículo independiente:
  permiten preguntar «¿cuántas chaquetas hay?» y «¿cuántas M?» sin trucos.
- Apuntar la entrega a la inscripción resuelve «¿a quién y bajo qué
  contexto?» sin obligar a que exista la sesión, que hoy no está definida.

## Consecuencias

- Consultar el stock es sumar (vista) o leer una columna mantenida por
  disparador. Se elige al escribir la migración midiendo con volumen; la
  interfaz no cambia.
- La pantalla de «editar cantidad» no existe: existe «registrar ajuste con
  motivo». Es un cambio de hábito para quien venga de una hoja de cálculo, y
  es deliberado.
- Los insumos comprados en grupo por los estudiantes quedan fuera del
  inventario del instituto (así lo dice el documento); si el cliente quiere
  registrarlos, entran como `insumo` sin cambiar nada.

## Alternativas descartadas

| Opción | Motivo |
|---|---|
| Tabla plana con `quantity` editable (GYM V4.3) | Sin historial ni responsables; no cumple «quién, cuándo, en qué contexto» |
| Una tabla por tipo (`uniformes`, `insumos`, `utensilios`) | Triplica consultas, políticas y pantallas para lo que es una diferencia de comportamiento |
| Entregas como simples salidas con nota | Pierde la relación con la inscripción y el contexto; imposible listar «inscritos sin uniforme» |
| Entrega obligatoriamente ligada a una sesión | Asume la regla que el encargo pide no asumir |
