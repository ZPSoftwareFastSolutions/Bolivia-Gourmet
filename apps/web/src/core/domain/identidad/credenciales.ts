/**
 * CAPA: Domain / Identidad
 *
 * Reglas de las credenciales del portal. Supabase Auth exige solo 6
 * caracteres y en el plan gratuito no comprueba contraseñas filtradas: la
 * política la pone la aplicación antes de llamar al proveedor.
 *
 * Accesibilidad (skill ui-ux-pro-max, «accessible authentication»): no se
 * prohíbe pegar ni se exigen símbolos raros que obliguen a memorizar. Se pide
 * longitud, que es lo que de verdad protege, y que no sea trivial.
 *
 * Sin React, sin Next, sin I/O.
 */

import { exito, fallo, type Resultado } from '../shared/tipos-base';
import { validarEstudiante, type DatosDeEstudiante } from '../estudiantes/estudiante';

export const LONGITUD_MINIMA_DE_CLAVE = 10;
export const LONGITUD_MAXIMA_DE_CLAVE = 72; // bcrypt ignora lo que pasa de 72 bytes

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Contraseñas que aparecen primero en cualquier diccionario de ataque. */
const TRIVIALES = ['contraseña', 'contrasena', 'password', '1234567890', '0123456789', 'qwertyuiop', 'boliviagourmet', 'gastronomia'];

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function validarCorreo(correo: string): Resultado<string> {
  const limpio = normalizarCorreo(correo);
  if (limpio.length === 0) return fallo('Escribe tu correo electrónico.');
  if (limpio.length > 254 || !PATRON_CORREO.test(limpio)) return fallo('El correo no tiene un formato válido.');
  return exito(limpio);
}

export function validarClave(clave: string, correo?: string): Resultado<string> {
  if (clave.length < LONGITUD_MINIMA_DE_CLAVE) {
    return fallo(`La contraseña debe tener al menos ${LONGITUD_MINIMA_DE_CLAVE} caracteres.`);
  }
  if (new TextEncoder().encode(clave).length > LONGITUD_MAXIMA_DE_CLAVE) {
    return fallo(`La contraseña admite hasta ${LONGITUD_MAXIMA_DE_CLAVE} caracteres.`);
  }
  const minuscula = clave.toLowerCase();
  if (TRIVIALES.some((t) => minuscula.includes(t)) || /^(.)\1+$/.test(clave)) {
    return fallo('Esa contraseña es demasiado fácil de adivinar. Usa una frase o combina palabras.');
  }
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(clave) || !/\d/.test(clave)) {
    return fallo('Combina letras y números.');
  }
  const usuario = correo ? normalizarCorreo(correo).split('@')[0] : undefined;
  if (usuario && usuario.length >= 4 && minuscula.includes(usuario)) {
    return fallo('La contraseña no debe contener tu correo.');
  }
  return exito(clave);
}

export interface DatosDeRegistro extends DatosDeEstudiante {
  readonly correo: string;
  readonly clave: string;
  readonly confirmacion: string;
  readonly aceptaPrivacidad: boolean;
}

export interface RegistroValido {
  readonly correo: string;
  readonly clave: string;
  readonly estudiante: DatosDeEstudiante;
}

/** Errores por campo, para mostrarlos bajo cada uno (aria-describedby). */
export type ErroresDeRegistro = Partial<Record<'nombres' | 'apellidos' | 'telefono' | 'documento' | 'correo' | 'clave' | 'confirmacion' | 'aceptaPrivacidad' | 'general', string>>;

export function validarRegistro(datos: DatosDeRegistro): Resultado<RegistroValido, ErroresDeRegistro> {
  const errores: ErroresDeRegistro = {};

  const estudiante = validarEstudiante({
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    telefono: datos.telefono,
    documento: datos.documento,
  });
  if (!estudiante.exito) {
    for (const mensaje of estudiante.error) {
      if (/nombre/i.test(mensaje)) errores.nombres ??= mensaje;
      else if (/apellido/i.test(mensaje)) errores.apellidos ??= mensaje;
      else if (/teléfono/i.test(mensaje)) errores.telefono ??= mensaje;
      else if (/documento/i.test(mensaje)) errores.documento ??= mensaje;
      else errores.general ??= mensaje;
    }
  }

  const correo = validarCorreo(datos.correo);
  if (!correo.exito) errores.correo = correo.error;

  const clave = validarClave(datos.clave, datos.correo);
  if (!clave.exito) errores.clave = clave.error;
  else if (datos.clave !== datos.confirmacion) errores.confirmacion = 'Las contraseñas no coinciden.';

  if (!datos.aceptaPrivacidad) errores.aceptaPrivacidad = 'Debes aceptar el aviso de privacidad para crear tu cuenta.';

  if (Object.keys(errores).length > 0 || !estudiante.exito || !correo.exito) return fallo(errores);

  return exito({ correo: correo.valor, clave: datos.clave, estudiante: estudiante.valor });
}
