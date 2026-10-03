/**
 * CAPA: Presentation / App — Historial del inventario (kárdex en frases, §7.5).
 *
 * Cada fila: qué pasó (con icono), cuándo, dónde, quién, cuánto entró o
 * salió y cuánto quedó; administración ve además el valor y puede anular.
 * Filtros por sede y por artículo, y los últimos 100 movimientos.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import type { Id } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_INVENTARIO, rutaDeArticulo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Confirmacion, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, type Parametros } from '../../caja/_componentes';
import { FilaDeKardex, PestanasDeInventario } from '../_componentes';

export const metadata: Metadata = { title: 'Historial del inventario' };

export default async function Historial({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.historial), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.leer');
  const conValor = tienePermiso(ctx, 'contabilidad.leer');
  const repo = await inventarioRepository();
  const codigo = parametro(valores, 'articulo');
  const sedeId = parametro(valores, 'sede');
  const sedes = ctx.sedes;

  const ficha = /^(INS|UNI|UTE|OTR)-\d{4,}$/.test(codigo) ? await repo.fichaDeArticulo(codigo, false) : null;
  const articulo = ficha && ficha.exito ? ficha.valor : null;
  const lista = await repo.kardex({
    articuloId: articulo?.id,
    sedeId: sedes.some((s) => s.id === sedeId) ? (sedeId as Id) : undefined,
    conValor,
    limite: 100,
  });
  const consulta = (cambios: Record<string, string>) => {
    const q = new URLSearchParams({ ...(codigo ? { articulo: codigo } : {}), ...(sedeId ? { sede: sedeId } : {}), ...cambios });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    const texto = q.toString();
    return `${RUTAS_INVENTARIO.historial}${texto ? `?${texto}` : ''}`;
  };

  return (
    <div className="grid gap-6">
      {parametro(valores, 'anulado') ? (
        <Confirmacion palabra="Anulado" titulo="Se deshizo y quedó registrado con su motivo." cerrarHref={consulta({})}>
          <p>La anulación aparece arriba en el historial; la fila original queda marcada.</p>
        </Confirmacion>
      ) : null}
      <EncabezadoDePanel
        titulo="Historial"
        descripcion={articulo ? `De ${articulo.nombre}. Lo más reciente primero.` : 'Todo lo que entró y salió, lo más reciente primero.'}
      />
      <PestanasDeInventario activa="historial" />
      <nav aria-label="Filtros" className="flex flex-wrap items-center gap-2">
        {[{ id: '', nombre: 'Todas las sedes' }, ...sedes].map((s) => (
          <Link
            key={s.id || 'todas'}
            href={consulta({ sede: s.id })}
            aria-current={sedeId === s.id ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold',
              sedeId === s.id ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            <Icono nombre="pin" tamano={16} />
            {s.nombre}
          </Link>
        ))}
        {articulo ? (
          <>
            <Link href={rutaDeArticulo(articulo.codigo)} className="enlace inline-flex min-h-11 items-center font-semibold">
              Ver ficha de {articulo.nombre}
            </Link>
            <Link href={consulta({ articulo: '' })} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold text-tinta-suave hover:bg-superficie-alterna">
              <Icono nombre="cerrar" tamano={16} />
              Todos los artículos
            </Link>
          </>
        ) : null}
      </nav>
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el historial">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio frase="Sin movimientos" detalle="Cuando se compre, use, entregue o preste algo, aquí se contará qué pasó." />
      ) : (
        <ul className="grid gap-2">
          {lista.valor.map((m) => (
            <FilaDeKardex key={m.id} m={m} conArticulo puedeAnular={tienePermiso(ctx, 'inventario.anular')} />
          ))}
        </ul>
      )}
    </div>
  );
}
