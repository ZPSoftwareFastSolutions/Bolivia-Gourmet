/**
 * CONTENIDO INSTITUCIONAL ESTÁTICO.
 *
 * Nombres, lema, fundador, redes y pilares tal como los da
 * `INFORMACION-INSTITUTO.md`. Lo consumen la página pública y la cabecera del
 * panel. Ningún componente incrusta estos textos: si el cliente corrige un
 * nombre, se corrige aquí y en ningún otro sitio.
 *
 * Las tres denominaciones institucionales se respetan literalmente. Cuál va
 * en qué lugar (título, pie legal, metadatos) está pendiente de confirmar
 * (docs/analisis §1); mientras tanto `nombreCorto` es la marca comercial que
 * aparece en las redes.
 */

export const INSTITUTO = {
  nombreLegal: 'Instituto Técnico Nacional de la Integración Boliviana',
  nombreComercial: 'Corporación Bolivia Gourmet',
  marcaSecundaria: 'Bolivia Gastronómica',
  nombreCorto: 'Bolivia Gourmet',
  lema: 'Descubre el chef que llevas dentro!',
  tituloOtorgado: 'Técnico Superior en Gastronomía',
  fundador: 'Chef Oscar Mora',
  aniosDeExperiencia: 16,
  descripcion:
    'Somos un Instituto de Gastronomía fundado por el reconocido Chef Oscar Mora, con más de 16 años brindando el servicio de educación y formando profesionales en el área.',
  pilares: [
    {
      titulo: 'Titúlate',
      texto: 'Obtén tu título en Provisión Nacional de Técnico Superior en Gastronomía.',
    },
    {
      titulo: 'Convalida',
      texto: 'Una vez concluida la carrera opta para convalidar y sacar licenciatura en Gastronomía.',
    },
    {
      titulo: 'Practica',
      texto: 'Realiza tus prácticas laborales en los mejores hoteles, restaurantes a nivel nacional e internacional.',
    },
    {
      titulo: 'Aprende',
      texto: 'Contamos con un programa académico actualizado, docentes especializados y clases 80% práctico y 20% teórica.',
    },
  ],
  redes: {
    facebook: 'Corporación Bolivia Gourmet / Bolivia Gourmet',
    tiktok: '@bolivia.gourmet',
    instagram: '@corp.bolivia.gourmet',
    youtube: 'Bolivia Gourmet',
  },
} as const;
