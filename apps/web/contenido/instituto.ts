/**
 * CONTENIDO INSTITUCIONAL ESTÁTICO.
 *
 * Fuentes: `INFORMACION-INSTITUTO.md` y las aclaraciones del 2026-10-01
 * (`docs/analisis/aclaraciones-2026-10-01.md`). Lo consumen la página pública
 * y el portal. Ningún componente incrusta estos textos: si el cliente corrige
 * un nombre, se corrige aquí y en ningún otro sitio.
 *
 * Jerarquía (aclaraciones §2): el TEC-NIB es la institución madre; Corporación
 * Bolivia Gourmet es su área de gastronomía; Bolivia Gastronómica es la marca
 * del instituto de gastronomía.
 */

export interface RedSocial {
  readonly red: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
  readonly etiqueta: string;
  /** Cómo aparece en la red. */
  readonly usuario: string;
  /**
   * Enlace verificable. `null` cuando el cliente no lo ha enviado: la web
   * muestra el nombre para buscarlo, nunca un enlace adivinado.
   */
  readonly url: string | null;
}

export const INSTITUTO = {
  institucionMadre: {
    sigla: 'TEC-NIB',
    nombre: 'Instituto Técnico Nacional de la Integración Boliviana',
  },
  nombreLegal: 'Instituto Técnico Nacional de la Integración Boliviana',
  nombreComercial: 'Corporación Bolivia Gourmet',
  marcaSecundaria: 'Bolivia Gastronómica',
  nombreDelInstituto: 'Instituto Técnico Bolivia Gastronómica',
  nombreCorto: 'Bolivia Gourmet',
  lema: 'Descubre el chef que llevas dentro!',
  lemasSecundarios: {
    carrera: 'Cocina con pasión',
    formacion: 'Tu talento, nuestra formación',
    futuro: 'Tu futuro en la gastronomía comienza aquí',
    cursos: 'Aprende y emprende',
  },
  tituloOtorgado: 'Técnico Superior en Gastronomía',
  fundador: 'Chef Oscar Mora',
  aniosDeExperiencia: 16,
  porcentajePractica: 80,
  porcentajeTeoria: 20,
  descripcion:
    'Somos un Instituto de Gastronomía fundado por el reconocido Chef Oscar Mora, con más de 16 años brindando el servicio de educación y formando profesionales en el área.',
  pilares: [
    {
      titulo: 'Titúlate',
      icono: 'documento',
      texto: 'Obtén tu título en Provisión Nacional de Técnico Superior en Gastronomía.',
    },
    {
      titulo: 'Convalida',
      icono: 'medalla',
      texto: 'Una vez concluida la carrera opta para convalidar y sacar licenciatura en Gastronomía.',
    },
    {
      titulo: 'Practica',
      icono: 'plato',
      texto: 'Realiza tus prácticas laborales en los mejores hoteles y restaurantes a nivel nacional e internacional.',
    },
    {
      titulo: 'Aprende',
      icono: 'lapiz',
      texto: 'Contamos con un programa académico actualizado, docentes especializados y clases 80 % prácticas y 20 % teóricas.',
    },
  ],
  emprende: {
    titulo: '¿Sueñas emprender?',
    texto:
      'Aprende a emprender con cursos de capacitación de forma fácil y práctica: cursos 100 % prácticos, ideal si sueñas con tu propio negocio. Este es tu lugar para aprender y emprender con confianza: te enseñamos desde cero, sin límites de edad.',
    beneficios: [
      { cifra: '100 %', texto: 'Cursos prácticos' },
      { cifra: '+15', texto: 'Años capacitando' },
      { cifra: 'Gratis', texto: 'Certificado con carga horaria' },
      { cifra: 'Desde cero', texto: 'Sin límites de edad' },
    ],
  },
  redes: [
    { red: 'facebook', etiqueta: 'Facebook', usuario: 'Corporación Bolivia Gourmet', url: null },
    { red: 'instagram', etiqueta: 'Instagram', usuario: '@corp.bolivia.gourmet', url: 'https://www.instagram.com/corp.bolivia.gourmet/' },
    { red: 'tiktok', etiqueta: 'TikTok', usuario: '@bolivia.gourmet', url: 'https://www.tiktok.com/@bolivia.gourmet' },
    { red: 'youtube', etiqueta: 'YouTube', usuario: 'Bolivia Gourmet', url: null },
  ] satisfies readonly RedSocial[],
  /** Medio de cobro aclarado el 2026-10-01. El QR bancario aún no se ha recibido. */
  pago: {
    medio: 'QR',
    qrDisponible: false,
  },
} as const;
