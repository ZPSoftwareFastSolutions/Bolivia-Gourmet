/**
 * CAPA: Infrastructure / Supabase
 *
 * Traducción de errores del proveedor a mensajes para el estudiante. Se
 * traduce por CÓDIGO, no por el texto (que cambia entre versiones), y nunca se
 * muestra un mensaje técnico: «new row violates row-level security policy»
 * no le dice nada a quien se inscribe y le dice demasiado a quien ataca.
 *
 * Los mensajes que escriben los disparadores de la base (en español, para
 * personas) sí se muestran tal cual: se reconocen porque no traen el
 * vocabulario técnico de PostgreSQL.
 */

interface ErrorConCodigo {
  readonly code?: string | undefined;
  readonly message?: string | undefined;
  readonly status?: number | undefined;
}

const GENERICO = 'No pudimos completar la operación. Inténtalo de nuevo en unos minutos.';

const DE_AUTH: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de entrar: revisa tu bandeja de entrada (y el correo no deseado).',
  user_already_exists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  email_exists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  weak_password: 'Esa contraseña es demasiado débil. Usa una más larga.',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  over_email_send_rate_limit: 'Enviamos demasiados correos seguidos. Espera unos minutos y vuelve a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  email_address_invalid: 'El correo no tiene un formato válido.',
  signup_disabled: 'El registro está cerrado temporalmente. Escríbenos por WhatsApp.',
  otp_expired: 'El enlace caducó o ya se usó. Pide uno nuevo.',
  flow_state_not_found: 'El enlace caducó o ya se usó. Pide uno nuevo.',
  flow_state_expired: 'El enlace caducó o ya se usó. Pide uno nuevo.',
  bad_code_verifier: 'Abre el enlace en el mismo navegador en el que te registraste, o inicia sesión directamente.',
  session_not_found: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  user_banned: 'Esta cuenta está suspendida. Escríbenos para revisarlo.',
};

export function traducirErrorDeAuth(error: ErrorConCodigo | null | undefined): string {
  if (!error) return GENERICO;
  if (error.code && DE_AUTH[error.code]) return DE_AUTH[error.code] as string;
  if (error.status === 429) return DE_AUTH.over_request_rate_limit as string;
  return GENERICO;
}

const TECNICO = /violates|permission denied|null value|duplicate key|invalid input|syntax|relation|column|function|policy/i;

const DE_BASE: Record<string, string> = {
  '23505': 'Ya existe un registro igual.',
  '23503': 'Uno de los datos elegidos ya no está disponible.',
  '23514': 'Algún dato no cumple las reglas de la institución.',
  '42501': 'No tienes permiso para hacer eso.',
  '54000': 'Has alcanzado el límite permitido.',
  PGRST116: 'No encontramos ese registro.',
};

export function traducirErrorDeBase(error: ErrorConCodigo | null | undefined): string {
  if (!error) return GENERICO;
  const mensaje = error.message?.trim() ?? '';
  // Mensajes escritos para personas por los disparadores de la base.
  if (error.code && ['23505', '23514', '42501', '54000'].includes(error.code) && mensaje && !TECNICO.test(mensaje)) {
    return mensaje;
  }
  return (error.code && DE_BASE[error.code]) || GENERICO;
}
