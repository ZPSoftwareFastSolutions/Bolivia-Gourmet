# Estrategia de pruebas

> Principio: **no se declara una funcionalidad terminada hasta verificarla.**
> «La aplicación levanta» no es una verificación. Fecha: 2026-09-30.

---

## 1. Niveles

| Nivel | Qué cubre | Herramienta | Cuándo |
|---|---|---|---|
| **Dominio** | Reglas puras: movimientos y stock, validación de cohortes e inscripciones, validadores, períodos, cálculo de indicadores | `node --test` sobre `apps/web/tests/*.test.ts` (Node 24 ejecuta TypeScript sin transpilar; alias resueltos por `tests/alias-hooks.mjs`) | En cada cambio del dominio; antes de cada commit |
| **Contenido y catálogo** | Que el contenido institucional y el catálogo académico sean válidos (códigos únicos, opciones no vacías, teléfonos con formato, ningún `[Consultar]` convertido en número) | Mismo arnés; además el **build falla** si el validador rechaza | Antes de cada commit; en cada build |
| **Casos de uso** | Orquestación con puertos falsos en memoria (`FakeInventarioRepository`): que un caso de uso llame al dominio, respete `Resultado` y no escriba cuando la regla falla | `node --test` | Con cada caso de uso nuevo |
| **Tipos y reglas de capas** | `tsc --noEmit`; greps de la Dependency Rule; grep de colores literales; grep de voseo en textos | scripts de `package.json` + comandos de §3 | Antes de cada commit |
| **Base de datos (RLS)** | Que cada rol vea y escriba solo lo suyo; que un movimiento no deje stock negativo; que un pago no se edite; que una cuenta sin sede no opere en ella | Scripts SQL con sesión simulada (`set local role authenticated` + `request.jwt.claims`) en transacción revertida, en `docs/runbooks/pruebas-rls-*.sql` | Al aplicar cada migración |
| **Rendimiento de consultas** | Que las vistas y políticas escalen (medir con 50 000 filas insertadas en una transacción revertida) | SQL `explain analyze` | Con cada vista o política nueva |
| **Flujos manuales** | Recorridos completos con sesión real: inscribir, entregar uniforme, registrar pago, ver tablero; responsive en móvil, tablet y escritorio; estados vacíos; errores | Persona con el navegador, lista de comprobación en `TASKS.md` | Antes de cerrar cada fase |
| **Sitio público** | Códigos HTTP de cada ruta, 404 reales, cabeceras de seguridad, `sitemap.xml`, Lighthouse | `curl -I` sobre el despliegue; Lighthouse en Chrome | Tras cada despliegue |
| **Seguridad** | `npm audit` = 0; escaneo DAST cuando exista superficie HTTP y credenciales del escáner | `npm audit`; HawkScan (pendiente de `HAWK_API_KEY`) | Antes de desplegar |

**No se usa framework de pruebas ni navegador automatizado en esta fase.** Si
el panel crece, se evalúa Playwright para los tres flujos críticos
(inscripción, entrega, pago).

## 2. Qué prueba cada archivo (hoy)

| Archivo | Cubre |
|---|---|
| `tests/inventario.test.ts` | Comportamiento por tipo; `aplicarMovimiento` (entradas suman, salidas restan, nunca negativo, ajuste fija con motivo, baja exige motivo, entrega solo para tipos entregables, devolución solo para tipos que la admiten, cantidad entera salvo fraccionarios); `calcularStock` |
| `tests/academico.test.ts` | Catálogo académico válido; `validarCohorte` (duración, turno, días y modalidad dentro de las opciones del programa; programa inactivo); descripciones legibles de duración |
| `tests/estudiantes.test.ts` | `validarEstudiante` (nombres obligatorios, teléfono boliviano, correo); reglas de inscripción (no duplicar cohorte) |
| `tests/casos-de-uso.test.ts` | `registrarMovimiento` con repositorio falso: guarda cuando la regla pasa, no guarda cuando falla, devuelve `Resultado` |

## 3. Antes de cada commit relevante

```bash
cd apps/web
npm run typecheck
npm test
npm run build
npm audit
```

```bash
# Dependency Rule (salida vacía)
grep -rnE "from '(@infra|@/presentation|@/app|next|react|@supabase)" apps/web/src/core/domain
grep -rn "from '@infra" apps/web/src/core/application
# Colores literales en componentes (salida vacía)
grep -rnE "#[0-9a-fA-F]{6}\b" apps/web/src/presentation apps/web/src/app --include=*.tsx
# Voseo en textos visibles (salida vacía)
grep -rnE "(pagás|tenés|querés|podés|hacés|necesitás|preferís|contanos|\bsos\b)" apps/web/src apps/web/contenido --include=*.ts --include=*.tsx
```

## 4. Criterio para marcar una tarea como completada

Una tarea pasa a `[x]` solo cuando:

1. está implementada;
2. `typecheck`, `test`, `build` y `audit` pasan;
3. las pruebas de su nivel existen y pasan (dominio, RLS o manual, según toque);
4. no hay errores críticos conocidos;
5. `CLAUDE.md` y `TASKS.md` están actualizados;
6. el comportamiento esperado se validó (y se anota cómo, en la tarea).

## 5. Lecciones heredadas que estas pruebas deben atrapar

- Políticas evaluadas por fila (medir con volumen antes de aceptar).
- Vistas sin `security_invoker` (una consulta con dos roles lo detecta).
- RPC que nombran columnas sin grant (la batería RLS lo encuentra; leer, no).
- `loading.tsx` sobre rutas con guardas (medir códigos HTTP con `curl`).
- Resets de CSS fuera de `@layer base` (revisión visual + grep).
- Fechas en UTC («hoy» es en `America/La_Paz`; probar entradas nocturnas).
