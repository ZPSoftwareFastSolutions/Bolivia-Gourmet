/**
 * CAPA: Application / Panel · Tablero
 *
 * Arma lo que muestran los dos tableros (especificación §7.6 y §7.7;
 * enmiendas B.12 crítica 29: tableros más livianos).
 *
 * - Recepción: «Pendientes de hoy», del más urgente al menos.
 * - Administración: «Requiere tu atención», del más grave al menos, y las
 *   cifras del mes comparadas con el mes anterior a la misma fecha.
 *
 * Reglas comunes de los avisos:
 * - En cero no aparecen: un tablero lleno de ceros esconde lo que sí importa.
 * - Se ven los 4 primeros (crítica 29); el resto queda en `resto` para
 *   «Ver N más».
 * - `cifra` es la cantidad exacta que la pantalla muestra en grande.
 * - `frase` es una línea COMPLETA que se entiende sola y ya lleva la cantidad
 *   («3 préstamos de utensilios atrasados y 1 vence hoy.»). Así sirve igual
 *   en la tarjeta, en la lista de «Ver N más» y para un lector de pantalla,
 *   aunque la cifra grande no esté al lado.
 *
 * No llama a la base: recibe los datos ya leídos por los puertos. Así se
 * prueba con números y la página solo pinta.
 */

import { variacion, type Variacion } from '../../../domain/contabilidad/tablero';
import { formatearMontoExacto } from '../../../domain/shared/dinero';
import type { Centavos, FechaISO } from '../../../domain/shared/tipos-base';
import type { TableroDeAdministracionEnBase } from '../../ports/tablero.port';

export type ClaseDeAviso =
  | 'prestamos_atrasados'
  | 'solicitudes'
  | 'cuotas_vencidas'
  | 'sin_uniforme'
  | 'lotes_vencidos'
  | 'lotes_por_vencer'
  | 'bajo_minimo'
  | 'efectivo_sin_arqueo'
  | 'arqueos_con_diferencia'
  | 'bajas'
  | 'sin_precio';

export interface AvisoDeTablero {
  readonly clase: ClaseDeAviso;
  /** La cantidad exacta que se muestra en grande. */
  readonly cifra: number;
  /** Una línea simple que se entiende sola y ya incluye la cantidad. */
  readonly frase: string;
}

export interface AvisosVisibles {
  readonly visibles: readonly AvisoDeTablero[];
  readonly resto: readonly AvisoDeTablero[];
}

/** Avisos a la vista en cada tablero (enmiendas B.12, crítica 29). */
export const AVISOS_VISIBLES = 4;

// ---------------------------------------------------------------- Piezas de redacción

/** Cantidad con punto de miles, como el resto de las cifras bolivianas: «1.250». */
function numero(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** «1 préstamo atrasado» / «3 préstamos atrasados». */
function contar(n: number, singular: string, plural: string): string {
  return `${numero(n)} ${n === 1 ? singular : plural}`;
}

/** Solo cantidades positivas y finitas cuentan como aviso. */
function hay(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * «28/09», igual que `formatearDiaCorto` de `lib/fechas`. Se arma aquí
 * cortando el texto para que la capa de aplicación no dependa de `lib`
 * (ningún caso de uso lo hace); la fecha de negocio ya llega como
 * `AAAA-MM-DD`, sin hora ni zona, así que no hay día que se corra.
 */
function diaCorto(fecha: FechaISO | null): string | null {
  if (fecha === null || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

/** «a, b y c»: `enumerar` de tipos-base une con «o», que aquí diría otra cosa. */
function unirConY(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1] ?? ''}`;
}

/** «, en 2 sedes»: solo cuando el problema está en más de una (el enlace lleva a una). */
function enSedes(n: number): string {
  return hay(n) && n > 1 ? `, en ${numero(n)} sedes` : '';
}

function separar(avisos: readonly AvisoDeTablero[]): AvisosVisibles {
  const presentes = avisos.filter((a) => hay(a.cifra));
  return { visibles: presentes.slice(0, AVISOS_VISIBLES), resto: presentes.slice(AVISOS_VISIBLES) };
}

function prestamosAtrasados(atrasados: number, vencenHoy = 0): AvisoDeTablero {
  const base = contar(atrasados, 'préstamo de utensilios atrasado', 'préstamos de utensilios atrasados');
  const hoy = hay(vencenHoy) ? ` y ${numero(vencenHoy)} ${vencenHoy === 1 ? 'vence' : 'vencen'} hoy` : '';
  return { clase: 'prestamos_atrasados', cifra: atrasados, frase: `${base}${hoy}.` };
}

function solicitudes(n: number): AvisoDeTablero {
  return { clase: 'solicitudes', cifra: n, frase: `${contar(n, 'solicitud del portal', 'solicitudes del portal')} por atender.` };
}

function lotesVencidos(n: number): AvisoDeTablero {
  return { clase: 'lotes_vencidos', cifra: n, frase: `${contar(n, 'lote de insumos vencido', 'lotes de insumos vencidos')}.` };
}

function bajoMinimo(n: number): AvisoDeTablero {
  return { clase: 'bajo_minimo', cifra: n, frase: `${contar(n, 'artículo agotado o bajo el mínimo', 'artículos agotados o bajo el mínimo')}.` };
}

// ---------------------------------------------------------------- Recepción (§7.6)

export interface DatosDeRecepcion {
  readonly prestamosAtrasados: number;
  readonly prestamosHoy: number;
  readonly solicitudes: number;
  readonly deudoresVencidos: number;
  readonly montoVencido: Centavos;
  readonly sinUniforme: number;
  readonly lotesVencidos: number;
  readonly lotesPorVencer: number;
  readonly bajoMinimo: number;
}

/**
 * Pendientes de recepción, del más urgente al menos: los utensilios
 * atrasados primero (son de otro y alguien los espera), luego las
 * solicitudes del portal (una persona espera respuesta), las cuotas
 * vencidas, los alumnos sin uniforme y, al final, el inventario. Lo vencido
 * va antes que lo por vencer (enmiendas B.13, crítica 40).
 *
 * El aviso de préstamos cuenta solo los atrasados: si ninguno lo está, no
 * aparece aunque alguno venza hoy (todavía está a tiempo).
 */
export function pendientesDeRecepcion(d: DatosDeRecepcion): AvisosVisibles {
  return separar([
    prestamosAtrasados(d.prestamosAtrasados, d.prestamosHoy),
    solicitudes(d.solicitudes),
    {
      clase: 'cuotas_vencidas',
      cifra: d.deudoresVencidos,
      frase:
        d.deudoresVencidos === 1
          ? `1 alumno tiene cuotas vencidas por ${formatearMontoExacto(d.montoVencido)}.`
          : `${numero(d.deudoresVencidos)} alumnos tienen cuotas vencidas por ${formatearMontoExacto(d.montoVencido)} en total.`,
    },
    {
      clase: 'sin_uniforme',
      cifra: d.sinUniforme,
      frase: `${contar(d.sinUniforme, 'alumno de la carrera sin uniforme', 'alumnos de la carrera sin uniforme')}.`,
    },
    lotesVencidos(d.lotesVencidos),
    {
      clase: 'lotes_por_vencer',
      cifra: d.lotesPorVencer,
      frase: `${contar(d.lotesPorVencer, 'lote de insumos vence', 'lotes de insumos vencen')} en los próximos 7 días.`,
    },
    bajoMinimo(d.bajoMinimo),
  ]);
}

// ---------------------------------------------------------------- Administración (§7.7)

export interface DatosDeAdministracion {
  readonly tablero: TableroDeAdministracionEnBase;
  readonly solicitudes: number;
  readonly prestamosAtrasados: number;
  readonly lotesVencidos: number;
  readonly bajoMinimo: number;
}

/** «Falta el precio de 1 grupo con inscritos, 2 entregas de uniforme y 1 pérdida en préstamos.» */
function fraseSinPrecio(s: TableroDeAdministracionEnBase['sinPrecio']): string {
  const partes = [
    hay(s.grupos) ? contar(s.grupos, 'grupo con inscritos', 'grupos con inscritos') : null,
    hay(s.entregas) ? contar(s.entregas, 'entrega de uniforme', 'entregas de uniforme') : null,
    hay(s.perdidas) ? contar(s.perdidas, 'pérdida en préstamos', 'pérdidas en préstamos') : null,
  ].filter((p): p is string => p !== null);
  return `Falta el precio de ${unirConY(partes)}.`;
}

/**
 * Alertas de administración, de la más grave a la menos: primero el dinero
 * (efectivo que nadie contó, arqueos que no cuadraron), luego lo que se
 * perdió del inventario y lo que se entregó sin cobrar; después lo que
 * también ve recepción.
 */
export function alertasDeAdministracion(d: DatosDeAdministracion): AvisosVisibles {
  const t = d.tablero;
  const efectivo = t.efectivoSinArqueo.registros;
  const desde = diaCorto(t.efectivoSinArqueo.desde);
  const arqueos = t.arqueosConDiferencia.cantidad;
  const bajas = t.bajasUltimos7Dias.cantidad;
  const sinPrecio =
    (hay(t.sinPrecio.grupos) ? t.sinPrecio.grupos : 0) +
    (hay(t.sinPrecio.entregas) ? t.sinPrecio.entregas : 0) +
    (hay(t.sinPrecio.perdidas) ? t.sinPrecio.perdidas : 0);

  return separar([
    {
      clase: 'efectivo_sin_arqueo',
      cifra: efectivo,
      frase: `${contar(efectivo, 'registro en efectivo', 'registros en efectivo')} sin arquear ${desde ? `desde el ${desde}` : 'de días anteriores'}${enSedes(t.efectivoSinArqueo.sedes)}.`,
    },
    {
      clase: 'arqueos_con_diferencia',
      cifra: arqueos,
      frase:
        arqueos === 1
          ? `1 arqueo de este mes no cuadró: ${formatearMontoExacto(t.arqueosConDiferencia.monto)} de diferencia.`
          : `${numero(arqueos)} arqueos de este mes no cuadraron${enSedes(t.arqueosConDiferencia.sedes)}: ${formatearMontoExacto(t.arqueosConDiferencia.monto)} de diferencia en total.`,
    },
    {
      clase: 'bajas',
      cifra: bajas,
      frase:
        bajas === 1
          ? `1 baja o faltante en los últimos 7 días: valía ${formatearMontoExacto(t.bajasUltimos7Dias.monto)}.`
          : `${numero(bajas)} bajas y faltantes en los últimos 7 días: valían ${formatearMontoExacto(t.bajasUltimos7Dias.monto)}.`,
    },
    { clase: 'sin_precio', cifra: sinPrecio, frase: fraseSinPrecio(t.sinPrecio) },
    lotesVencidos(d.lotesVencidos),
    bajoMinimo(d.bajoMinimo),
    solicitudes(d.solicitudes),
    prestamosAtrasados(d.prestamosAtrasados),
  ]);
}

// ---------------------------------------------------------------- Dinero del mes

export interface CifrasDelMes {
  readonly entro: Centavos;
  readonly salio: Centavos;
  readonly variacionEntro: Variacion;
  readonly variacionSalio: Variacion;
  /** Hasta qué día del mes anterior se comparó («a esta fecha»). */
  readonly corteAnterior: FechaISO;
}

/** Entró y salió de este mes (día 1 a hoy) frente al mes anterior hasta el mismo día. */
export function cifrasDelMes(t: TableroDeAdministracionEnBase): CifrasDelMes {
  const c = t.comparacion;
  return {
    entro: c.entroMes,
    salio: c.salioMes,
    variacionEntro: variacion(c.entroMes, c.entroAnterior),
    variacionSalio: variacion(c.salioMes, c.salioAnterior),
    corteAnterior: c.corteAnterior,
  };
}
