/**
 * CAPA: Infrastructure / Catálogo
 *
 * LA OFERTA ACADÉMICA TAL COMO LA PUBLICA LA INSTITUCIÓN, transcrita de
 * `INFORMACION-INSTITUTO.md` (§2, §4, §6, §7). Es la fuente del sitio público
 * y la semilla del panel hasta que los programas vivan en la base.
 *
 * REGLA: lo que el documento marca como `[Consultar]` va como PENDIENTE.
 * Nunca se rellena con un valor inventado. Un dato pasa a definido solo
 * cuando lo confirma el usuario o el cliente, y se anota de dónde salió
 * (hoy: docs/analisis/aclaraciones-2026-10-01.md). El validador del catálogo
 * lo comprueba en el build.
 *
 * Las erratas probables del documento («Trotas», «Buttercreem») se transcriben
 * tal cual hasta que el cliente confirme (docs/analisis §7).
 */

import type { Programa } from '@core/domain/academico/programa';
import type { Sede } from '@core/domain/shared/sede';
import { PENDIENTE, pendiente, type Centavos, type Id } from '@core/domain/shared/tipos-base';

/** Bs 650 en centavos: Paquete Económico y uniforme de la carrera. */
const BS_650 = 65_000 as Centavos;

/** Ids estables de las sedes mientras no existan en la base. */
export const SEDE_LA_PAZ_ID = 'sede-la-paz' as Id;
export const SEDE_EL_ALTO_ID = 'sede-el-alto' as Id;

export const SEDES: readonly Sede[] = [
  {
    id: SEDE_LA_PAZ_ID,
    codigo: 'la-paz',
    nombre: 'La Paz',
    zona: 'Miraflores',
    direccion: 'Calle Francisco de Miranda #1986 entre Villalobos y Díaz Romero',
    telefono: '77706890',
    activa: true,
    // Enlace enviado por el usuario el 2026-10-01; coordenadas del lugar al que lleva.
    ubicacion: {
      enlace: 'https://maps.app.goo.gl/QK31bpHFF39UvxQs8',
      lugar: 'Bolivia Gourmet Miraflores',
      latitud: -16.5023223,
      longitud: -68.1191543,
    },
  },
  {
    id: SEDE_EL_ALTO_ID,
    codigo: 'el-alto',
    nombre: 'El Alto',
    zona: 'La Ceja',
    direccion: 'Calle 4 esq. Jorge Carrasco, Edificio Kollasuyo #225 (5to piso)',
    telefono: '77708027',
    activa: true,
    // Enlace enviado por el usuario el 2026-10-01; coordenadas del lugar al que lleva.
    ubicacion: {
      enlace: 'https://maps.app.goo.gl/EYi1qTQY7x5b1BSS7',
      lugar: 'Instituto Bolivia Gastronómica El Alto',
      latitud: -16.5087942,
      longitud: -68.1637126,
    },
  },
];

const DIAS_LUNES_A_VIERNES = { codigo: 'lun-vie', etiqueta: 'Lunes a viernes' };
const DIAS_JUEVES_Y_VIERNES = { codigo: 'jue-vie', etiqueta: 'Semana (jueves y viernes)' };
const DIAS_LUNES_A_MIERCOLES = { codigo: 'lun-mie', etiqueta: 'Semana (lunes, martes y miércoles)' };
const DIAS_SABADOS = { codigo: 'sab', etiqueta: 'Sábados' };

const REQUISITOS_CARRERA = [
  { descripcion: 'Fotocopia nítida de carnet de identidad', detalle: 'En funda plástica transparente' },
  { descripcion: 'Fotocopia nítida del certificado de nacimiento actualizado', detalle: 'En funda plástica transparente' },
  { descripcion: 'Fotocopia del título de bachiller simple', detalle: 'En funda plástica transparente' },
  { descripcion: '4 fotografías', detalle: 'De acuerdo a la fotografía solicitada' },
  { descripcion: '1 folder tamaño oficio con fastener' },
] as const;

const REQUISITOS_TEMPORADA = [
  { descripcion: '1 fotocopia de carnet de identidad' },
  { descripcion: '1 funda transparente' },
  { descripcion: 'Fotos fondo celeste mate 3x3' },
] as const;

const NOTA_INSUMOS_CARRERA =
  'El costo no incluye insumos; la compra de insumos la realizan los estudiantes de forma grupal.';
const NOTA_INSUMOS_CURSOS = 'Los insumos se compran de manera grupal por experiencias de marcas y mercado.';

export const PROGRAMAS: readonly Programa[] = [
  {
    codigo: 'gastronomia',
    tipo: 'carrera',
    nombre: 'Gastronomía',
    tituloOtorgado: 'Técnico Superior en Gastronomía',
    duracion: { unidad: 'anios', opciones: [3] },
    diasDeClase: [DIAS_LUNES_A_VIERNES],
    turnos: ['manana', 'tarde', 'noche', 'especial'],
    horaPorTurno: { manana: '08:30', tarde: '15:00', noche: '18:00', especial: 'Disponible según coordinación' },
    modalidades: [],
    planDeEstudios: [
      {
        anio: 1,
        materias: [
          'Inocuidad alimentaria, seguridad ocupacional y medio ambiente',
          'Inglés',
          'Técnicas culinarias e historia de la gastronomía',
          'Procedimientos básicos de repostería, pastelería y panadería',
          'Informática aplicada a la gastronomía',
          'Nutrición y dietética',
          'Organización y gestión de alimentos y bebidas',
          'Servicio comedor, etiqueta y protocolo',
        ],
      },
      {
        anio: 2,
        materias: [
          'Francés técnico',
          'Gastronomía nacional',
          'Repostería y pastelería',
          'Gastronomía internacional',
          'Panadería',
          'Metodología de la investigación',
          'Emprendimiento productivo',
        ],
      },
      {
        anio: 3,
        materias: [
          'Cocina creativa',
          'Bar y coctelería',
          'Enología y maridaje',
          'Eventos, banquetes y garnish',
          'Marketing gastronómico',
          'Industria y especialidades gastronómicas',
          'Taller de modalidad de graduación',
        ],
      },
    ],
    beneficios: [
      'Título en Provisión Nacional de Técnico Superior en Gastronomía',
      'Convalidación para licenciatura en Gastronomía al concluir',
      'Prácticas laborales en hoteles y restaurantes a nivel nacional e internacional',
      'Clases 80 % prácticas y 20 % teóricas',
    ],
    requisitos: REQUISITOS_CARRERA,
    notas: [NOTA_INSUMOS_CARRERA],
    // Aclaración del 2026-10-01 (docs/analisis/aclaraciones-2026-10-01.md §4):
    // Paquete Económico y uniforme a Bs 650. Sin periodicidad: no se indicó si
    // es mensual, por gestión o pago único, y la web no la inventa.
    costo: [
      { etiqueta: 'Paquete Económico', monto: BS_650 },
      { etiqueta: 'Paquete Ahorrador', monto: pendiente('Importe a consultar') },
    ],
    uniforme: { etiqueta: 'Uniforme', monto: BS_650 },
    inicioPublicado: 'Febrero 2027',
    activo: true,
  },
  {
    codigo: 'cocina',
    tipo: 'curso',
    nombre: 'Cocina',
    duracion: { unidad: 'meses', opciones: [1, 2, 3] },
    diasDeClase: [DIAS_JUEVES_Y_VIERNES, DIAS_SABADOS],
    turnos: [],
    modalidades: [],
    modulos: ['Nacional', 'Internacional', 'Eventos'],
    contenido: [
      {
        titulo: 'Temáticas',
        temas: [
          'Cocina Andina',
          'Cocina Valle',
          'Cocina Oriente',
          'Cocina Argentina',
          'Cocina Peruana',
          'Cocina Mexicana',
          'Cocina para Eventos',
          'Cocina Fast Food',
          'Tradiciones Bolivianas',
        ],
      },
    ],
    beneficios: ['Matrícula gratis', '100 % práctico'],
    requisitos: [],
    notas: [],
    costo: PENDIENTE,
    uniforme: PENDIENTE,
    inicioPublicado: PENDIENTE,
    activo: true,
  },
  {
    codigo: 'cocteleria',
    tipo: 'curso',
    nombre: 'Coctelería',
    duracion: { unidad: 'meses', opciones: [1, 2] },
    diasDeClase: [DIAS_JUEVES_Y_VIERNES, DIAS_SABADOS],
    turnos: [],
    modalidades: [],
    contenido: [
      {
        titulo: 'Temáticas',
        temas: [
          'Cocteles',
          'Licores',
          'Macerados',
          'Cocteles con Ron',
          'Cocteles con Tequila',
          'Cocteles con Whisky',
          'Shots',
          'Bebidas Moleculares',
          'Bebidas Ahumadas',
        ],
      },
    ],
    beneficios: ['Matrícula gratis'],
    requisitos: [],
    notas: [],
    costo: PENDIENTE,
    uniforme: PENDIENTE,
    inicioPublicado: PENDIENTE,
    activo: true,
  },
  {
    codigo: 'reposteria-y-panaderia',
    tipo: 'curso',
    nombre: 'Repostería y Panadería',
    duracion: { unidad: 'meses', opciones: [2, 4, 6] },
    diasDeClase: [DIAS_LUNES_A_MIERCOLES, DIAS_SABADOS],
    turnos: ['manana', 'noche', 'unico'],
    modalidades: [],
    contenido: [
      { titulo: 'Repostería Comercial', temas: ['Manejo de merengues', 'Almidón', 'Conservas'] },
      { titulo: 'Masas Líquidas, Livianas', temas: ['Crepés', 'Panqueques', 'Waffles'] },
      { titulo: 'Masas Escaldadas, Quebradas', temas: ['Pasta choux', 'Fritas', 'Horneadas'] },
      { titulo: 'Repostería Internacional', temas: ['Cannoli', 'Tiramisú', 'Cheesecake'] },
      { titulo: 'Chocolatería / Heladería', temas: ['Manejo de chocolatería', 'Helados'] },
      { titulo: 'Masas Pesadas, Batidas', temas: ['Queques', 'Budines', 'Muffins'] },
      { titulo: 'Fermentadas, Laminadas, Hojaldre', temas: ['Donas', 'Rolls de canela'] },
      { titulo: 'Repostería Boliviana', temas: ['Hojarasca', 'Buñuelos', 'Pastel de api', 'Etc.'] },
      { titulo: 'Panadería Comercial', temas: ['Pan básico', 'Pan sarnita', 'Pan de leche'] },
      { titulo: 'Panadería Saludable', temas: ['Pan de avena', 'Quinua', 'Integral'] },
      { titulo: 'Panadería Internacional', temas: ['Panes latinoamericanos', 'Europeos', 'Asiáticos'] },
      { titulo: 'Panadería Boliviana', temas: ['Marraqueta', 'Cachitos', 'Pan de todos santos'] },
      { titulo: 'Panadería Eventos', temas: ['Pan saborizado', 'Grissinis', 'Pan botón'] },
      { titulo: 'Panadería Industrial', temas: ['Panetón', 'Rosca de reyes', 'Hojaldres'] },
      { titulo: 'Panadería Masa Madre', temas: ['Panes con masa madre', 'Pizzas clásicas'] },
    ],
    beneficios: ['Matrícula gratis'],
    requisitos: [],
    notas: [NOTA_INSUMOS_CURSOS],
    costo: pendiente('Costo por mes: consultar'),
    uniforme: PENDIENTE,
    inicioPublicado: PENDIENTE,
    activo: true,
  },
  {
    codigo: 'tortas',
    tipo: 'curso',
    nombre: 'Tortas',
    duracion: { unidad: 'meses', opciones: [2, 4, 6] },
    diasDeClase: [DIAS_LUNES_A_MIERCOLES, DIAS_SABADOS],
    turnos: [],
    modalidades: [],
    contenido: [
      {
        titulo: 'Bases Generales',
        temas: [
          'Manejo de boquillas',
          'Cremas',
          'Alisados',
          'Decorado',
          'Flores de crema',
          'Chocolatería para tortas',
          'Macarrones',
        ],
      },
      {
        titulo: 'Tortas Tradicionales / Vitrina / Comerciales',
        temas: [
          'Torta Moka',
          'Tres Leches',
          'Selva Negra',
          'Sacher',
          'Red Velvet',
          'Carrot Cake',
          'Gelatina',
          'Trotas',
          'Espejo',
          'Craqueladas',
          'Fault Line Cake',
          'Buttercreem',
          'Chantilly',
        ],
      },
      {
        titulo: 'Tortas con Fondant / Tortas para Eventos',
        temas: ['Fondant clásico', 'Pasta Goma (flores)', 'Muñequería', 'Masa Cereal', 'Tortas de Piso Clásica', 'Tortas Temáticas'],
      },
    ],
    beneficios: ['Matrícula gratis'],
    requisitos: [],
    notas: [],
    costo: PENDIENTE,
    uniforme: PENDIENTE,
    inicioPublicado: PENDIENTE,
    activo: true,
  },
  {
    codigo: 'cursos-de-temporada',
    tipo: 'curso_de_temporada',
    nombre: 'Cursos de Temporada',
    duracion: PENDIENTE,
    diasDeClase: [],
    turnos: [],
    modalidades: ['practico', 'magistral', 'virtual'],
    beneficios: [],
    requisitos: REQUISITOS_TEMPORADA,
    notas: [],
    costo: PENDIENTE,
    uniforme: PENDIENTE,
    inicioPublicado: PENDIENTE,
    activo: true,
  },
];
