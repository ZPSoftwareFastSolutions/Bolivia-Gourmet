# Archivo digital de documentos de estudiantes: análisis de factibilidad

**Fecha:** 2026-10-06 · **Pedido del usuario:** 2026-10-05 · **Estado:** análisis,
sin construir · **Recomendación:** consultar primero con la institución (§9).

En las oficinas se vio un mueble lleno de documentos y folders. El usuario
supone que son documentos de alumnos, reportes anuales y facturas. Propuso dos
flujos:

1. el estudiante sube sus fotocopias (fotos o PDF) desde el portal;
2. administración escanea y archiva los documentos para buscarlos fácil.

Pidió además analizar las fallas posibles, las pruebas negativas, qué pasa si
se pierde la base con las copias, los aspectos legales y si conviene seguir
conservando el papel.

---

## 0. En una página

| Pregunta | Respuesta corta |
|---|---|
| ¿Es factible con lo que ya tenemos? | **Sí, técnicamente.** Supabase Storage privado, permisos en la base (RLS), subida por el servidor y búsqueda por alumno, tipo y gestión. |
| ¿Es necesario ya? | **No está claro.** No sabemos qué hay en el mueble ni qué consultan de verdad. Construirlo a ciegas puede digitalizar papeles que nadie busca. |
| ¿Hay que consultar antes? | **Sí, y es lo recomendado.** Hay decisiones que no son técnicas: qué se guarda, quién lo ve, cuánto tiempo, menores de edad, presupuesto y quién escanea lo que ya existe. |
| ¿Reemplaza al papel? | **No.** Un escaneo sin firma digital es una copia simple: sirve para consultar, no reemplaza al original (§7). |
| ¿Qué pasa si se pierde la base? | Con el plan gratuito **no hay copias automáticas**, y las copias de la base **no incluyen los archivos** (§6). Sin respaldo externo, se perderían los escaneos; el papel seguiría valiendo. |
| ¿Cabe en el plan gratuito? | Solo para una prueba: 1 GB de archivos. Con varios cientos de alumnos al año se llena en meses (§3.4). |

---

## 1. Lo que hay hoy en el sistema

- La inscripción guarda **qué requisitos entregó** el alumno: una lista de
  casillas (`inscripciones.documentos_entregados`), sin archivos.
- Los requisitos de la carrera están en el catálogo:
  - fotocopia de carnet;
  - fotocopia del certificado de nacimiento;
  - fotocopia del título de bachiller;
  - 4 fotografías;
  - un folder con fastener.
- No hay ningún archivo guardado ni espacio para subirlos.

**Lo que no sabemos (supuestos del usuario, sin confirmar):**
- qué hay realmente en el mueble;
- de qué años son los folders;
- cuántas hojas son;
- qué documentos se consultan y con qué frecuencia;
- quién los pide (el alumno, el Ministerio, una auditoría).

---

## 2. Qué se construiría (si la institución lo aprueba)

| Flujo | Quién | Cómo |
|---|---|---|
| Subir fotocopias | Estudiante, desde el portal | Foto o PDF de cada requisito → queda «por revisar» → recepción lo compara con el original en ventanilla → «verificado» o «rechazado» con el motivo |
| Escanear y archivar | Recepción o administración, desde el panel | Escaneo → se clasifica por alumno, tipo de documento, gestión y sede → queda en la ficha del alumno |
| Buscar | Personal | Por alumno (nombre, código o carnet), tipo de documento, gestión o sede; vista previa y descarga con enlace temporal |
| Archivo institucional (opcional) | Administración | Reportes anuales, facturas y otros, con permisos solo de administración |

La búsqueda por el **texto dentro** del documento (OCR) queda fuera: es más
costosa y casi siempre basta con buscar por alumno, tipo y gestión.

---

## 3. Factibilidad técnica

### 3.1 Dónde se guardan los archivos

Supabase Storage, en un espacio **privado**:
- los permisos se escriben como en el resto del sistema (RLS): el estudiante
  solo ve sus archivos, recepción los de su sede y administración todo;
- para ver o descargar se genera un enlace que **vence en pocos minutos**;
- los datos del documento (tipo, alumno, gestión, estado, quién lo subió,
  tamaño, huella SHA-256) van en una tabla con su propia batería de pruebas,
  como todo lo demás.

### 3.2 Límites de subida (verificados)

| Límite | Valor | Fuente |
|---|---|---|
| Cuerpo de una acción del servidor de Next.js | **1 MB** por defecto (se puede subir con `serverActions.bodySizeLimit`) | Documentación de Next.js incluida en el paquete instalado (`serverActions.md`) |
| Cuerpo de una petición en Vercel | **4,5 MB**, límite fijo en todos los planes | [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) |

La regla del proyecto es que **el navegador no habla con Supabase**: todo
pasa por el servidor. Por eso:
- las fotos se reducen **en el navegador** antes de enviarlas;
- una foto de celular pesa entre 2 y 5 MB, y a unos 1600 px queda en
  300–500 KB, bien por debajo de 4,5 MB;
- un PDF escaneado a 300 ppp ronda 0,2–1 MB por página.

Subir directo del navegador a Storage con un enlace firmado evitaría ese
límite, pero cambia una regla de seguridad del proyecto (ADR 0006): habría
que decidirlo en un ADR nuevo.

### 3.3 Seguridad de los archivos

- Comprobar el tipo **real** del archivo (sus primeros bytes), no solo la
  extensión: un `.exe` renombrado a `.pdf` se rechaza.
- Aceptar solo JPEG, PNG, WebP y PDF. Nada de SVG ni HTML: pueden llevar
  código.
- El nombre del archivo lo pone el sistema (aleatorio), nunca el que trae.
- Quitar los datos internos de las fotos (EXIF): una foto de celular puede
  llevar la ubicación GPS de la casa del estudiante.
- Descargar siempre «como archivo», con su tipo correcto. Nunca abrirlo
  dentro de la página.

### 3.4 Espacio y costo (plan gratuito, verificado)

| Recurso | Plan gratuito | Fuente |
|---|---|---|
| Archivos (Storage) | 1 GB | [Supabase · billing](https://supabase.com/docs/guides/platform/billing-on-supabase) |
| Base de datos | 500 MB por proyecto | ídem |
| Pausa por inactividad | Tras 7 días con poca actividad; se reactiva hasta 90 días después | [Supabase · project pausing](https://supabase.com/docs/guides/platform/free-project-pausing) |

**Estimación (supuesta, a confirmar con la institución):**
- 300 alumnos al año × 5 documentos × 0,5 MB ≈ **750 MB al año**: el plan
  gratuito se llena en el primer año;
- el escaneo de lo que ya está en el mueble puede ser mucho más.

Para producción hace falta un plan pago: no se pausa, tiene copias diarias e
incluye 100 GB de archivos. El precio vigente está en supabase.com/pricing.

---

## 4. Posibles fallas y cómo se evitan

| Falla | Qué pasaría | Cómo se evita |
|---|---|---|
| Archivo muy grande o de un tipo no permitido | La subida falla | Reducir en el navegador; mensaje claro con el límite |
| Foto borrosa o ilegible | El documento no sirve | Vista previa antes de enviar; recepción lo revisa y puede rechazarlo con el motivo |
| Archivo malicioso (PDF con código, HTML disfrazado) | Riesgo para quien lo abra | Tipo real, lista cerrada de formatos, descarga como archivo, espacio privado |
| Un estudiante ve documentos de otro | Fuga de datos sensibles (carnet, nacimiento) | Permisos en la base, carpeta por alumno, enlaces que vencen y pruebas negativas (§5) |
| El personal ve más de lo necesario | Fuga interna | Recepción solo su sede; registro de quién vio o descargó cada documento |
| Se borra un documento por error | Se pierde | Borrado lógico (papelera); solo administración borra, y con motivo |
| Se llena el espacio | No se puede subir más | Aviso al 80 %; plan pago |
| El proyecto se pausa (plan gratuito) | Nadie puede entrar | Plan pago en producción |
| Doble envío o archivo repetido | Duplicados | Clave de operación, como en el resto del panel, y huella SHA-256 |
| Señal lenta en el celular | La subida se corta | Archivos chicos, reintento y estado visible |
| Se pierde la base o el proyecto | Ver §6 | Respaldo externo y papel |

---

## 5. Pruebas negativas (para cuando se construya)

Cada una iría en la batería de la base o en las pruebas de la aplicación.

1. Un estudiante sube un archivo a la carpeta de otro → rechazado.
2. Un estudiante abre el archivo de otro con un enlace adivinado o copiado → rechazado.
3. Alguien sin sesión → no lee ni sube nada.
4. Un archivo más grande que el límite → rechazado con mensaje.
5. Un `.exe` o un `.html` renombrado a `.pdf` → rechazado por su tipo real.
6. Un SVG o un HTML → rechazado.
7. Un nombre de archivo con `../` o caracteres raros → no importa: el nombre lo pone el sistema.
8. Un enlace de descarga vencido → no abre.
9. Recepción de La Paz y los documentos de El Alto → según lo que decida la institución (lectura sí o no).
10. Borrar un documento verificado → solo administración, con motivo, y queda registro.
11. Subir con la sesión vencida → rechazado y vuelve al acceso.
12. El mismo archivo dos veces → se detecta el duplicado.

---

## 6. ¿Qué pasa si perdemos la base o los escaneos?

Hechos de la documentación de Supabase:

- Las copias automáticas diarias existen **solo en planes pagos** (Pro: 7
  días; Team: 14; Enterprise: 30). Para el plan gratuito, Supabase recomienda
  exportar la base por cuenta propia y guardarla fuera
  ([Database Backups](https://supabase.com/docs/guides/platform/backups)).
- **Las copias de la base no incluyen los archivos de Storage**: solo los
  datos sobre ellos. Restaurar una copia no recupera archivos borrados
  después de esa copia (misma fuente).
- Borrar el proyecto elimina **todo**, incluidas las copias, sin vuelta atrás
  ([Deleting your project](https://supabase.com/docs/guides/platform/delete-project)).

Qué significaría:

| Se pierde | Resultado |
|---|---|
| Los archivos, sin respaldo propio | Se pierden los escaneos. Si el papel se conservó, se vuelve a escanear |
| La base, pero no los archivos | Los archivos quedan sin índice. Se puede rehacer en parte si la ruta de cada archivo lleva el código del alumno y el tipo de documento |
| Todo el proyecto | Solo queda lo que se respaldó fuera, y el papel |

**Mitigación (regla 3-2-1):**
- tres copias, en dos medios distintos, y una fuera de Supabase: la base y
  los archivos, cada semana, a un almacenamiento de la institución;
- respaldo cifrado, porque son documentos de identidad;
- una prueba de restauración cada tres meses: un respaldo que nunca se probó
  no es un respaldo;
- la huella SHA-256 de cada archivo, para comprobar que lo restaurado es lo
  mismo que se subió.

---

## 7. Aspectos legales (Bolivia), a confirmar con un asesor legal y el contador

Esto no es asesoría legal: son los puntos que la institución debe confirmar
antes de construir.

| Norma | Qué implica para este archivo |
|---|---|
| **Constitución, art. 21 y art. 130** | Derecho a la privacidad, la intimidad y la propia imagen; la «Acción de Protección de Privacidad» permite pedir conocer, corregir o eliminar datos guardados en archivos públicos o privados. El sistema tiene que poder mostrar, corregir y eliminar los documentos de una persona. |
| **Protección de datos personales** | Según las fuentes consultadas, Bolivia **no tiene todavía una ley general**: hay proyectos y una primera ley municipal, de Coroico (2023) ([Access Now](https://www.accessnow.org/guia-para-una-ley-de-proteccion-de-datos-personales-en-bolivia/), [Ferrere](https://www.ferrere.com/en/news/se-promulga-la-primera-ley-municipal-sobre-el-gestion-de-datos-personales-en-bolivia/)). Aun así conviene aplicar buenas prácticas: consentimiento informado, finalidad clara, guardar solo lo necesario, plazos y seguridad. **Confirmar si cambió en 2025–2026.** |
| **Ley 164 y DS 1793 (documento y firma digital)** | Un documento digital tiene validez jurídica plena **con firma digital certificada** ([DS 1793](https://www.lexivox.org/norms/BO-RE-DSN1793.html)). Un escaneo o una foto sin esa firma es una copia simple: sirve para consultar, no reemplaza al original ni a una fotocopia legalizada. |
| **Código Tributario (Ley 2492, art. 59, modificado por la Ley 812 de 2016)** | La administración tributaria puede fiscalizar durante **8 años** (10 en algunos casos) ([Infoleyes](https://bolivia.infoleyes.com/articulo/65922), [Lexivox](https://www.lexivox.org/norms/BO-L-N812.html)). Facturas, libros y respaldos contables deben conservarse al menos ese plazo. Si ya se factura en línea con el SIN, las facturas ya son electrónicas. **El contador confirma la forma de conservarlas.** |
| **Normas del Ministerio de Educación para institutos técnicos** | Pueden exigir conservar en papel ciertos documentos (kárdex, actas, certificados) y por plazos definidos. **No verificado: consultar a la institución y al Ministerio.** |
| **Menores de edad** | Si hay estudiantes menores de 18 años, el consentimiento lo da su madre, padre o tutor (Código Niña, Niño y Adolescente). **Confirmar.** |

Los documentos de identidad son datos sensibles: una fotocopia de carnet y un
certificado de nacimiento bastan para suplantar a alguien. Acceso mínimo,
nunca por WhatsApp, y eliminarlos al vencer el plazo que fije el asesor.

---

## 8. ¿Conviene conservar el papel?

**Sí**, mientras no haya firma digital y el asesor no diga otra cosa:

- el papel es la prueba ante el Ministerio, una auditoría tributaria o un
  juicio;
- el archivo digital es una **copia de consulta** y un respaldo si el papel se
  daña (humedad, incendio);
- el mueble puede ordenarse con el mismo índice del sistema (código del
  alumno, tipo, gestión), y así el papel también se encuentra en segundos.

Lo que sí puede reducirse:
- las fotocopias duplicadas;
- los documentos cuyo plazo ya venció, con un acta de eliminación y según lo
  que fije el asesor.

---

## 9. Recomendación y preguntas para la institución

**No construirlo todavía: consultar primero.** Las decisiones de fondo no son
técnicas, y construir sin ellas podría guardar datos sensibles sin necesidad,
o digitalizar lo que nadie busca.

Preguntas para la reunión:

1. ¿Qué hay exactamente en el mueble? ¿De alumnos, reportes, facturas, otros? ¿De cuántos años y cuántas hojas, más o menos?
2. ¿Qué documentos buscan más seguido, y para qué? (certificados, reclamos, auditorías, el Ministerio)
3. ¿Qué exige el Ministerio de Educación conservar, en qué forma y por cuánto tiempo?
4. ¿Quién debe ver cada tipo de documento? ¿Recepción de una sede ve los de la otra?
5. ¿Hay estudiantes menores de edad?
6. ¿Aceptan que el estudiante suba sus fotocopias desde el celular? ¿Igual presenta el original en ventanilla?
7. ¿Hay presupuesto para el plan pago de Supabase y para un respaldo externo?
8. ¿Quién escanearía lo que ya existe? ¿Tienen escáner con alimentador de hojas?
9. ¿Cuánto tiempo conservar cada tipo de documento, y qué se elimina al final?
10. ¿Ya facturan en línea con el SIN?

**Si aprueban, por fases:**

| Fase | Qué | Por qué en ese orden |
|---|---|---|
| 1 | Recepción escanea los requisitos al inscribir y los adjunta a la ficha; búsqueda por alumno, tipo y gestión | Es lo más usado, sin abrir el portal a subidas externas |
| 2 | El estudiante sube sus fotocopias desde el portal, con revisión de recepción | Agrega riesgo (archivos de afuera): mejor cuando la fase 1 esté probada |
| 3 | Archivo institucional (reportes, facturas), solo administración | Depende de lo que diga el contador |
| Siempre | Respaldo externo semanal, prueba de restauración, borrado al vencer el plazo | Sin esto, el archivo digital no es confiable |

Cada fase sería una rebanada como las del panel: migración con permisos y su
batería de pruebas, casos de uso con pruebas, pantallas y documentación.

---

## Fuentes consultadas

- Supabase: [Database Backups](https://supabase.com/docs/guides/platform/backups) · [Deleting your project](https://supabase.com/docs/guides/platform/delete-project) · [Billing (cuotas)](https://supabase.com/docs/guides/platform/billing-on-supabase) · [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- Vercel: [Functions limits](https://vercel.com/docs/functions/limitations)
- Next.js 16: `node_modules/next/dist/docs/.../serverActions.md` (límite de 1 MB)
- Bolivia:
  - [DS 1793 (Lexivox)](https://www.lexivox.org/norms/BO-RE-DSN1793.html)
  - [Ley 812 (Lexivox)](https://www.lexivox.org/norms/BO-L-N812.html)
  - [Código Tributario, art. 59 (Infoleyes)](https://bolivia.infoleyes.com/articulo/65922)
  - [Access Now: guía para una ley de datos personales](https://www.accessnow.org/guia-para-una-ley-de-proteccion-de-datos-personales-en-bolivia/)
  - [Ferrere: primera ley municipal de datos personales](https://www.ferrere.com/en/news/se-promulga-la-primera-ley-municipal-sobre-el-gestion-de-datos-personales-en-bolivia/)
