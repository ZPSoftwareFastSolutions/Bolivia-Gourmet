/**
 * CAPA: Domain / Shared
 *
 * Tipos base compartidos por todo el dominio. Sin dependencias de framework.
 */

/** Marca nominal: evita que dos `string` o dos `number` distintos se confundan. */
export type Branded<T, TMarca extends string> = T & { readonly __marca: TMarca };

/** Identificador de entidad (UUID en la base). */
export type Id = Branded<string, 'Id'>;

/**
 * Importe en centavos de boliviano, ENTERO. Los importes nunca viajan como
 * `number` con decimales por el dominio: 0.1 + 0.2 no es 0.3 y un cobro
 * no admite ese error (regla C3 del modelo).
 */
export type Centavos = Branded<number, 'Centavos'>;

/** Fecha de calendario `AAAA-MM-DD`, sin hora ni zona. */
export type FechaISO = Branded<string, 'FechaISO'>;

// ---------------------------------------------------------------- Resultado

/**
 * Resultado de una operación que puede fallar por una razón esperada.
 * El dominio no lanza excepciones para reglas de negocio: devuelve un fallo
 * con mensaje legible que la interfaz muestra tal cual.
 */
export type Resultado<T, E = string> =
  | { readonly exito: true; readonly valor: T }
  | { readonly exito: false; readonly error: E };

export const exito = <T>(valor: T): Resultado<T, never> => ({ exito: true, valor });
export const fallo = <E>(error: E): Resultado<never, E> => ({ exito: false, error });

// ---------------------------------------------------------------- Pendiente

/**
 * Dato que la institución todavía no ha definido (`[Consultar]` en
 * INFORMACION-INSTITUTO.md). Se modela de forma explícita para que ninguna
 * pantalla lo confunda con un valor real ni lo rellene con uno inventado.
 */
export interface Pendiente {
  readonly pendiente: true;
  /** Por qué falta o qué hay que consultar. Útil en la interfaz («Consultar»). */
  readonly nota?: string;
}

export type Definido<T> = T | Pendiente;

export const PENDIENTE: Pendiente = { pendiente: true };

export function pendiente(nota: string): Pendiente {
  return { pendiente: true, nota };
}

export function esPendiente<T>(valor: Definido<T>): valor is Pendiente {
  return typeof valor === 'object' && valor !== null && 'pendiente' in valor && valor.pendiente === true;
}

// ---------------------------------------------------------------- Validadores

export function centavos(valor: number): Resultado<Centavos> {
  if (!Number.isInteger(valor) || valor < 0) {
    return fallo(`Un importe en centavos debe ser un entero no negativo; se recibió ${valor}.`);
  }
  return exito(valor as Centavos);
}

const PATRON_FECHA_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function fechaISO(valor: string): Resultado<FechaISO> {
  const limpio = valor.trim();
  if (!PATRON_FECHA_ISO.test(limpio)) {
    return fallo(`La fecha debe tener formato AAAA-MM-DD; se recibió "${valor}".`);
  }
  // `Date` acepta 2026-02-30 y lo convierte en marzo: se comprueba la vuelta.
  const fecha = new Date(`${limpio}T00:00:00Z`);
  if (fecha.toISOString().slice(0, 10) !== limpio) {
    return fallo(`La fecha "${valor}" no existe en el calendario.`);
  }
  return exito(limpio as FechaISO);
}

/** Texto obligatorio: no vacío tras recortar espacios. */
export function textoObligatorio(valor: string | undefined, nombre: string): Resultado<string> {
  const limpio = (valor ?? '').trim();
  if (limpio.length === 0) return fallo(`${nombre} es obligatorio.`);
  return exito(limpio);
}

/**
 * Enumera opciones en español: `[1, 2, 3]` → «1, 2 o 3». Sirve para describir
 * duraciones («1, 2 o 3 meses») y turnos en la interfaz.
 */
export function enumerar(valores: readonly (string | number)[]): string {
  if (valores.length === 0) return '';
  if (valores.length === 1) return String(valores[0]);
  const todosMenosUltimo = valores.slice(0, -1).join(', ');
  return `${todosMenosUltimo} o ${String(valores[valores.length - 1])}`;
}
