/**
 * CAPA: Domain / Portal
 *
 * Saludo del panel del estudiante según la hora de La Paz, como los
 * asistentes de chat: cinco franjas (madrugada, mañana, mediodía, tarde y
 * noche) con frases cortas que se turnan.
 *
 * - La frase cambia de un día a otro pero no al recargar la página: se elige
 *   por el día del calendario. Así también se puede probar.
 * - Ninguna frase concuerda en género con la persona (no sabemos su
 *   género): nada de «listo/lista» ni «bienvenido/bienvenida».
 * - `cierre` es el signo que va DESPUÉS del nombre cuando el gancho abre
 *   una exclamación («¡Buen provecho, Valeria!»).
 *
 * Sin React, sin Next, sin I/O.
 */

export type FranjaDelDia = 'madrugada' | 'manana' | 'mediodia' | 'tarde' | 'noche';

export interface Saludo {
  readonly franja: FranjaDelDia;
  /** Va antes del nombre, en letra caligráfica: «Buenos días,». */
  readonly gancho: string;
  /** Va pegado después del nombre si el gancho abrió «¡». */
  readonly cierre: '' | '!';
  /** Una línea corta debajo del nombre. */
  readonly frase: string;
}

type Variante = Omit<Saludo, 'franja'>;

/** De 00:00 a 04:59 madrugada; mañana hasta las 11:59; mediodía hasta las 13:59; tarde hasta las 18:59; después, noche. */
export function franjaDelDia(hora: number): FranjaDelDia {
  if (!Number.isFinite(hora) || hora < 0 || hora >= 24) return 'manana';
  if (hora < 5) return 'madrugada';
  if (hora < 12) return 'manana';
  if (hora < 14) return 'mediodia';
  if (hora < 19) return 'tarde';
  return 'noche';
}

export const SALUDOS: Readonly<Record<FranjaDelDia, readonly Variante[]>> = {
  madrugada: [
    { gancho: 'Hola,', cierre: '', frase: '¿Sin sueño? Tu portal está aquí cuando lo necesites.' },
    { gancho: 'Buenas noches,', cierre: '', frase: 'Ya es madrugada: tus solicitudes siguen aquí mañana.' },
    { gancho: 'Hola,', cierre: '', frase: 'Hasta los grandes chefs descansan. Te esperamos mañana.' },
  ],
  manana: [
    { gancho: 'Buenos días,', cierre: '', frase: '¿Qué vamos a cocinar hoy?' },
    { gancho: 'Buen día,', cierre: '', frase: 'Un café y a revisar tus cursos.' },
    { gancho: 'Buenos días,', cierre: '', frase: 'Empieza el día con todo.' },
  ],
  mediodia: [
    { gancho: '¡Buen provecho,', cierre: '!', frase: 'Hora de almorzar… y de ver tus cursos.' },
    { gancho: 'Hola,', cierre: '', frase: '¿Qué hay de almuerzo hoy?' },
    { gancho: 'Buenas tardes,', cierre: '', frase: 'A mitad del día, todo en orden por aquí.' },
  ],
  tarde: [
    { gancho: 'Buenas tardes,', cierre: '', frase: 'Sigamos con tus cursos.' },
    { gancho: '¡Hola de nuevo,', cierre: '!', frase: 'La tarde es buena para planear tu próximo curso.' },
    { gancho: 'Buenas tardes,', cierre: '', frase: '¿Ya probaste algo nuevo en la cocina?' },
  ],
  noche: [
    { gancho: 'Buenas noches,', cierre: '', frase: 'Cierra el día revisando tus cursos.' },
    { gancho: 'Buenas noches,', cierre: '', frase: 'Antes de descansar, todo en orden por aquí.' },
    { gancho: '¡Hola,', cierre: '!', frase: '¿Qué se cocinó hoy?' },
  ],
};

/** Número de día desde 1970 de una fecha `AAAA-MM-DD` (0 si no es una fecha). */
function numeroDeDia(fecha: string): number {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return 0;
  const ms = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0;
}

/** El saludo de esta hora de este día (`dia` en La Paz, `AAAA-MM-DD`). */
export function saludoDelMomento(hora: number, dia: string): Saludo {
  const franja = franjaDelDia(hora);
  const variantes = SALUDOS[franja];
  const variante = variantes[((numeroDeDia(dia) % variantes.length) + variantes.length) % variantes.length] ?? variantes[0]!;
  return { franja, ...variante };
}
