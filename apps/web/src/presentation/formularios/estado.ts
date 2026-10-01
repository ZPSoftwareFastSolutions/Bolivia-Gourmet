/**
 * CAPA: Presentation / Formularios
 *
 * Contrato entre una Server Action y su formulario (useActionState). Los
 * valores escritos vuelven al formulario cuando hay errores, para que nadie
 * tenga que reescribir todo por un campo mal puesto. La contraseña NUNCA
 * vuelve: no se guarda en el estado ni se reenvía al navegador.
 */

export interface EstadoDeFormulario {
  readonly estado: 'inicial' | 'error' | 'exito';
  readonly mensaje?: string;
  /** Errores por nombre de campo, para mostrarlos bajo cada uno. */
  readonly errores?: Readonly<Record<string, string>>;
  /** Valores escritos (sin contraseñas) para volver a rellenar el formulario. */
  readonly valores?: Readonly<Record<string, string>>;
}

export const ESTADO_INICIAL: EstadoDeFormulario = { estado: 'inicial' };

/** Lee un campo de texto de un FormData, siempre como string recortado. */
export function campo(datos: FormData, nombre: string): string {
  const valor = datos.get(nombre);
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Igual que `campo` pero sin recortar: para contraseñas, donde un espacio cuenta. */
export function campoCrudo(datos: FormData, nombre: string): string {
  const valor = datos.get(nombre);
  return typeof valor === 'string' ? valor : '';
}
