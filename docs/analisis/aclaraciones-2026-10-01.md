# Aclaraciones del 2026-10-01

> Respuestas del usuario (ZP Software Fast Solutions) a las ambigüedades de la
> fase 0, más el material que envió el cliente por correo. Este documento
> **complementa** a `INFORMACION-INSTITUTO.md`, que no se modifica: es la
> copia del original del cliente. Si ambos dicen cosas distintas, manda este
> documento en lo que aclara y el original en todo lo demás.

---

## 1. Alcance: una demostración escalable

No se ha entrado todavía al detalle del modelo de negocio ni del flujo de
trabajo del instituto. El sistema se construye sobre los requerimientos base
para **mostrar una demostración**; por eso es escalable: si el cliente pide
quitar o modificar algo, se hace sin rehacer la arquitectura.

Consecuencia práctica: las preguntas P1–P12 que siguen abiertas (§7) **no
bloquean la demostración**. Se resuelven con la opción más simple que el
modelo ya soporta y se anotan como supuestos.

## 2. Jerarquía institucional

| Entidad | Papel |
|---|---|
| **TEC-NIB** — Instituto Técnico Nacional de la Integración Boliviana | La institución **madre**. Su escudo aparece bordado en la manga de las chaquetas («TEC-NIB»). |
| **Corporación Bolivia Gourmet** | El área de **gastronomía** del TEC-NIB. Marca comercial con la que se presenta en redes. |
| **Bolivia Gastronómica** | Marca del instituto de gastronomía («Instituto Técnico Bolivia Gastronómica»), con su propio logotipo. |

En la web: los dos logotipos de gastronomía en la cabecera y la mención al
TEC-NIB como institución madre en «Nosotros» y en el pie.

## 3. Roles

| Ámbito | Rol | Qué hace |
|---|---|---|
| Página web | **estudiante** | Único acceso con cuenta en la web. Una pequeña «intranet» simulada: el alumno se registra, solicita inscripción, solicita renovación de gestión y ve el estado de sus trámites y la información de pago. **No es** una intranet académica completa. |
| Sistema interno | **recepción** | Atiende a quien llega en persona: informa oferta, cupos, precios y planes con los datos del sistema; registra inscripciones; consulta y opera inventario. |
| Sistema interno | **administrador** | Todo lo anterior más la gestión de la institución, alumnos, inventario, usuarios y el **módulo contable**. |

Tres roles fijos. Los permisos se asignan por rol en una tabla, para poder
añadir uno sin tocar código (ADR 0005).

## 4. Cobros

- **Medio de pago: QR**, como en los proyectos anteriores. El código QR
  bancario del instituto **todavía no se ha recibido**: hasta entonces el
  portal explica el procedimiento y muestra los importes, sin un QR falso.
- **Paquete Económico de la carrera: Bs 650.**
- **Uniforme de la carrera: Bs 650.**
- Paquete Ahorrador: sigue sin importe (pendiente).
- No se indicó si los Bs 650 son mensuales, por gestión o un pago único: la
  web muestra el importe sin periodicidad y remite a la institución para la
  modalidad de pago.
- El costo de los cursos cortos y de sus uniformes sigue pendiente. La
  aclaración del uniforme se aplica a la carrera, que es donde aparece la
  cifra en el folleto.

## 5. Material recibido del cliente (`FOTOS-WEB/`)

Mensaje del cliente: *«¡Buen día! Le hablamos de Bolivia Gourmet. Le adjunto
los logotipos y fotografías de estudiantes. Me informa en caso que necesite
otro recurso más por favor.»*

| Archivo | Contenido | Uso en la web |
|---|---|---|
| `BOLIVIA GOURMET.png` | Logotipo Corporación Bolivia Gourmet, PNG con transparencia, letras negras | Cabecera, pie (sobre fondo claro) |
| `BOLIVIA GASTRONOMICA.png` | Logotipo Bolivia Gastronómica, PNG con transparencia, letras negras, 11,6 MB | Cabecera, pie (sobre fondo claro); se publica optimizado |
| `2.png` | Tres estudiantes con brazos cruzados (eco de la portada del folleto) | Hero del inicio |
| `1.jpg`, `6.jpg` | Cuatro estudiantes mostrando platos (misma sesión) | Carrera |
| `3.jpg` | Tres estudiantes trabajando con pan y huevos | «Practica», cocina |
| `8.jpg` | Estudiante emplatando con pinzas | Carrera, galería |
| `9.jpg` | Estudiante con batidora | Repostería y Panadería, Tortas |
| `10.jpg`, `12.jpg` | Coctelería | Coctelería |
| `11.jpg` | Dos estudiantes con estuches de cuchillos (TEC-NIB) | Uniforme y kit, requisitos |

Los logotipos no tienen versión en blanco: **solo se colocan sobre fondos
claros**. El cliente ofreció enviar más recursos; ver §8.

### 5.1 Segunda entrega (2026-10-01, tras la presentación)

- `FOTOS-WEB/LOGOS-SOCIOS/`: **21 logotipos** (los 17 socios «durante 16 años»
  y las 4 universidades), JPG/PNG cuadrados, cada uno sobre su propio color de
  fondo. Se publican como hexágonos de panal (como el folleto) en el carrusel
  de la portada y en la página de convenios. El envío del cliente para la web
  se toma como autorización para publicarlos.
- **Mapas de las sedes** (enlaces de Google Maps del usuario): Miraflores
  `https://maps.app.goo.gl/QK31bpHFF39UvxQs8` → lugar «Bolivia Gourmet
  Miraflores» (−16,5023223, −68,1191543); El Alto
  `https://maps.app.goo.gl/EYi1qTQY7x5b1BSS7` → «Instituto Bolivia
  Gastronomica El Alto» (−16,5087942, −68,1637126). Las coordenadas son las
  del lugar al que lleva cada enlace.
- El usuario precisó que **los cursos son de capacitación, aparte de la carrera
  de 3 años**: cursos y «¿Sueñas emprender?» quedan en una sola página
  (`/cursos`; `/emprende` redirige allí).
- Precios y detalles de cursos y licenciatura: **pedidos de nuevo al cliente**;
  hasta su respuesta siguen como «Consultar».

## 6. Convenios con su nombre completo

**Durante 16 años trabajando con** (17):

1. Pastelería Michelline
2. Restaurante Alí Pacha
3. Mamita Masita — panes artesanales
4. Hotel Restaurante Oberland
5. Manq'a — restaurantes y escuelas de cocina
6. Hard Rock Cafe
7. Restaurant Gustu
8. Fusión Gourmet — escuela de pastelería y cocina
9. Restaurante Mugaritz
10. Selina Hotels
11. Propiedad Pública — restaurante de carnes y pastas
12. Cuissine Instituto de Chefs
13. La Boliviana — restaurante
14. La Cordobesa — pastelería
15. Boragó — restaurante
16. Centro de Formación Gastronómica «Le Gourmet»
17. Fideos Aurora — fábrica de harinas y fideos

Esto resuelve las erratas del documento original: «Alt Paocha» es Alí Pacha,
«La Carindera» es La Cordobesa, «Auroras» es Fideos Aurora y «UNIGEN» es
UNICEN.

**Convenios a nivel licenciatura** (4):

- UNANDES — Universidad de los Andes
- UNICEN
- UB — Universidad Unión Bolivariana
- UDI — Universidad para el Desarrollo y la Innovación

> **Discrepancia anotada.** El usuario escribió «Universidad Unión
> Boliviana». El logotipo del folleto y el documento original dicen
> «Universidad **Unión Bolivariana**», que es el nombre de la universidad que
> existe en La Paz. Se publica «Unión Bolivariana» y se pide confirmación.

## 7. Supuestos para la demostración (preguntas aún abiertas)

| # | Pregunta | Supuesto vigente |
|---|---|---|
| P1 | Piezas y tallas del uniforme | Chaqueta, gorro/pañoleta y delantal (lo que muestran las fotos); tallas S–XL |
| P2 | Cuándo se entrega el uniforme | Al inscribirse (contexto `inscripcion`); el sistema registra, no automatiza |
| P3 | Insumos | Los compran los estudiantes en grupo (documento); el instituto solo controla los suyos |
| P4 | Préstamo de utensilios | Sí se prestan y se devuelven (comportamiento actual del dominio) |
| P5 | Importes | Paquete Económico y uniforme de la carrera: Bs 650. Resto pendiente |
| P6 | Paquetes | Económico (Bs 650) y Ahorrador (pendiente); el contenido de cada uno, pendiente |
| P7 | Medios de cobro | **QR** (aclarado) |
| P8 | Gastos | Registro libre por concepto y sede |
| P9 | Roles | **administrador, recepción, estudiante** (aclarado) |
| P10 | Asistencia | No en esta fase |
| P11 | Fechas de cursos | «Consultar» en la web; la carrera inicia en febrero de 2027 |
| P12 | Dominio | Sin dominio: el sitio sigue con `noindex` |

## 8. Recursos que conviene pedir al cliente

1. Logotipos en **blanco** (o SVG) para fondos azules.
2. **QR bancario** de cobro y titular de la cuenta.
3. Fotografías de los **cursos cortos** (polera beige y delantal negro), de
   productos (repostería, tortas, panadería) y de la **sede de El Alto**.
4. Fotografía del **Chef Oscar Mora**.
5. ~~**Logotipos de los socios**~~ — recibidos (§5.1).
6. Enlaces exactos de **Facebook**, **YouTube** y de la **comunidad de
   WhatsApp** (Instagram y TikTok se derivan de sus usuarios).
7. Confirmación del nombre de la UB y de si los Bs 650 son mensuales.
