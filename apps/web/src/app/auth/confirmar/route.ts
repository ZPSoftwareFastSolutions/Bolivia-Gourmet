/**
 * CAPA: Presentation / App — retorno de los enlaces de correo.
 *
 * Supabase envía enlaces de confirmación y de recuperación que vuelven aquí
 * con `?code=` (flujo PKCE) o con `?token_hash=&type=` (plantillas
 * personalizadas). Se canjean por una sesión y se redirige al destino
 * pedido, SIEMPRE filtrado por `destinoSeguro` (sin redirección abierta).
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { TipoDeEnlace } from '@core/application/ports/autenticacion.port';
import { autenticacion } from '@infra/config/composition-root';
import { destinoSeguro } from '@/lib/redirecciones';
import { RUTAS } from '@/lib/rutas';

const TIPOS: readonly TipoDeEnlace[] = ['signup', 'recovery', 'email', 'invite', 'magiclink', 'email_change'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const destino = destinoSeguro(url.searchParams.get('siguiente') ?? url.searchParams.get('next'));
  const codigo = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as TipoDeEnlace | null;

  const auth = await autenticacion();
  let resultado: Awaited<ReturnType<typeof auth.canjearCodigo>> | null = null;
  if (codigo && /^[A-Za-z0-9-]{10,200}$/.test(codigo)) {
    resultado = await auth.canjearCodigo(codigo);
  } else if (tokenHash && tipo && TIPOS.includes(tipo) && /^[A-Za-z0-9_-]{10,200}$/.test(tokenHash)) {
    resultado = await auth.verificarEnlace(tokenHash, tipo);
  }

  const base = request.nextUrl.clone();
  base.search = '';
  if (resultado?.exito) {
    base.pathname = destino.split('?')[0] ?? RUTAS.portal;
    base.search = destino.includes('?') ? `?${destino.split('?')[1]}` : '';
    return NextResponse.redirect(base);
  }
  base.pathname = RUTAS.acceso;
  base.search = '?aviso=enlace';
  return NextResponse.redirect(base);
}
