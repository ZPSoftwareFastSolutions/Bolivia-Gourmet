/**
 * CAPA: Infrastructure / Supabase
 *
 * Errores del panel interno en lenguaje simple (especificación §8.5).
 *
 * Las funciones del panel lanzan su error con el CÓDIGO como mensaje
 * (`^[a-z_]+$`) y los datos de la frase en `detail` (jsonb). Aquí cada código
 * se convierte en una frase que dice qué pasó y qué hacer, sin culpar y sin
 * vocabulario técnico. Lo que no está en el catálogo cae en la traducción
 * general de la base y, si tampoco, en el genérico. El código queda en el
 * registro del servidor; ningún texto de PostgreSQL llega a la pantalla.
 *
 * `tests/errores-de-panel.test.ts` exige que todo `message = '<codigo>'` de
 * las migraciones tenga su frase aquí, y que no sobren frases sin código.
 */

import { traducirErrorDeBase } from './errores';

interface ErrorDePostgrest {
  readonly code?: string | undefined;
  readonly message?: string | undefined;
  readonly details?: string | null | undefined;
}

export type Detalle = Readonly<Record<string, unknown>>;

/** Código → frase. Las frases que necesitan datos los leen del detalle. */
export const MENSAJES_DE_PANEL: Readonly<Record<string, (detalle: Detalle) => string>> = {
  // Comunes
  sin_permiso: () => 'Esta acción la hace administración. Si la necesitas, pídesela.',
  sede_no_operable: () => 'Solo puedes registrar operaciones en tu sede.',
  sede_no_asignada: () => 'Tu cuenta aún no tiene sede. Pide a administración que te la asigne.',
  datos_invalidos: () => 'Faltan datos o alguno no es válido. Revisa el formulario.',
  clave_reutilizada: () => 'Este formulario ya se usó para otra cosa. Vuelve a abrirlo y repite la operación.',
};

const GENERICO = 'No pudimos guardar. Revisa tu conexión e inténtalo otra vez. Si se repite, avisa a administración.';

function leerDetalle(detalles: string | null | undefined): Detalle {
  if (!detalles) return {};
  try {
    const valor: unknown = JSON.parse(detalles);
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Detalle) : {};
  } catch {
    return {};
  }
}

/** Código propio del panel, si el error lo trae. */
export function codigoDelPanel(error: ErrorDePostgrest | null | undefined): string | null {
  const mensaje = error?.message?.trim() ?? '';
  return /^[a-z_]+$/.test(mensaje) && mensaje in MENSAJES_DE_PANEL ? mensaje : null;
}

export function traducirErrorDePanel(error: ErrorDePostgrest | null | undefined): string {
  if (!error) return GENERICO;
  const codigo = codigoDelPanel(error);
  if (codigo) {
    const frase = MENSAJES_DE_PANEL[codigo];
    if (frase) return frase(leerDetalle(error.details));
  }
  const base = traducirErrorDeBase(error);
  return base.startsWith('No pudimos completar') ? GENERICO : base;
}
