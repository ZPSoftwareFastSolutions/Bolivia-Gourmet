/**
 * Rutas del sitio en un solo lugar. Un enlace roto por una errata en una ruta
 * escrita a mano en un componente es el tipo de fallo que nadie ve hasta que
 * un visitante lo encuentra.
 */

export const RUTAS = {
  inicio: '/',
  nosotros: '/nosotros',
  carrera: '/carrera',
  cursos: '/cursos',
  convenios: '/convenios',
  contacto: '/contacto',
  privacidad: '/privacidad',
  portal: '/portal',
  acceso: '/portal/acceso',
  registro: '/portal/registro',
  recuperar: '/portal/recuperar',
  nuevaClave: '/portal/nueva-clave',
  solicitud: '/portal/solicitud',
  renovacion: '/portal/renovacion',
  confirmar: '/auth/confirmar',
  panel: '/panel',
} as const;

/** Panel interno (personal). Una sección por módulo; las subrutas cuelgan de aquí. */
export const RUTAS_PANEL = {
  inicio: '/panel',
  alumnos: '/panel/alumnos',
  inventario: '/panel/inventario',
  caja: '/panel/caja',
  contabilidad: '/panel/contabilidad',
  ajustes: '/panel/ajustes',
  mas: '/panel/mas',
} as const;

/** Alumnos del panel: lista, inscripción, bandeja del portal y grupos. */
export const RUTAS_ALUMNOS = {
  lista: '/panel/alumnos',
  nuevo: '/panel/alumnos/nuevo',
  inscribir: '/panel/alumnos/inscribir',
  solicitudes: '/panel/alumnos/solicitudes',
  grupos: '/panel/alumnos/grupos',
  grupoNuevo: '/panel/alumnos/grupos/nuevo',
} as const;

export function rutaDeAlumno(codigo: string): string {
  return `${RUTAS_ALUMNOS.lista}/${encodeURIComponent(codigo)}`;
}

export function rutaDeGrupo(id: string): string {
  return `${RUTAS_ALUMNOS.grupos}/${encodeURIComponent(id)}`;
}

export function rutaDeSolicitudDelPanel(id: string): string {
  return `${RUTAS_ALUMNOS.solicitudes}/${encodeURIComponent(id)}`;
}

/** Caja del panel: por cerrar, cobrar, lo que deben, recibos y arqueos. */
export const RUTAS_CAJA = {
  inicio: '/panel/caja',
  cobrar: '/panel/caja/cobrar',
  deben: '/panel/caja/deben',
  recibos: '/panel/caja/recibos',
  cerrar: '/panel/caja/cerrar',
  arqueos: '/panel/caja/arqueos',
} as const;

export function rutaDeRecibo(id: string): string {
  return `${RUTAS_CAJA.recibos}/${encodeURIComponent(id)}`;
}

/** Inventario del panel: existencias, ficha del artículo y cada operación. */
export const RUTAS_INVENTARIO = {
  inicio: '/panel/inventario',
  historial: '/panel/inventario/historial',
  usar: '/panel/inventario/usar',
  baja: '/panel/inventario/baja',
  compra: '/panel/inventario/compra',
  contar: '/panel/inventario/contar',
  saldoInicial: '/panel/inventario/saldo-inicial',
  articuloNuevo: '/panel/inventario/articulos/nuevo',
  anular: '/panel/inventario/anular',
  entregar: '/panel/inventario/entregar',
  prestar: '/panel/inventario/prestar',
  prestamos: '/panel/inventario/prestamos',
} as const;

export function rutaDeArticulo(codigo: string): string {
  return `${RUTAS_INVENTARIO.inicio}/${encodeURIComponent(codigo)}`;
}

/** Contabilidad del panel (administración): resumen del mes, gastos, compras, inventario valorizado. */
export const RUTAS_CONTABILIDAD = {
  resumen: '/panel/contabilidad',
  gastos: '/panel/contabilidad/gastos',
  gastoNuevo: '/panel/contabilidad/gastos/nuevo',
  compras: '/panel/contabilidad/compras',
  inventario: '/panel/contabilidad/inventario',
  tarjeta: '/panel/contabilidad/tarjeta',
} as const;

export function rutaDeCompra(id: string): string {
  return `${RUTAS_CONTABILIDAD.compras}/${encodeURIComponent(id)}`;
}

/** La carrera tiene página propia; los cursos cuelgan de /cursos. */
export function rutaDePrograma(codigo: string): string {
  return codigo === 'gastronomia' ? RUTAS.carrera : `${RUTAS.cursos}/${codigo}`;
}

export interface EnlaceDeNavegacion {
  readonly etiqueta: string;
  readonly href: string;
}

export const NAVEGACION: readonly EnlaceDeNavegacion[] = [
  { etiqueta: 'Nosotros', href: RUTAS.nosotros },
  { etiqueta: 'Carrera', href: RUTAS.carrera },
  { etiqueta: 'Cursos', href: RUTAS.cursos },
  { etiqueta: 'Convenios', href: RUTAS.convenios },
  { etiqueta: 'Contacto', href: RUTAS.contacto },
];
