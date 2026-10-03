/**
 * CAPA: Presentation / App — Historial del inventario (kárdex en frases, §7.5).
 *
 * Cada fila: qué pasó (con icono), cuándo, dónde, quién, cuánto entró o
 * salió y cuánto quedó; administración ve además el valor y puede anular.
 * Filtros por sede, por artículo y por tipo de movimiento (`?tipo=baja,
 * ajuste_faltante`: a eso llevan los avisos del inicio «Revisar bajas» y «Ver
 * entregas y pérdidas»). Se lee de 100 en 100, lo más reciente primero, con
 * «Ver más» (`?desde=`). Todo son enlaces: funciona sin JavaScript y la URL se
 * puede compartir. Cambiar un filtro vuelve a la primera página.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { ETIQUETA_DE_MOVIMIENTO } from '@core/domain/inventario/movimiento';
import type { Id } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_INVENTARIO, rutaDeArticulo } from '@/lib/rutas';
import { Aviso } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { Chip, Confirmacion, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, type Parametros } from '../../caja/_componentes';
import { EnlaceDeAccion, FilaDeKardex, PestanasDeInventario } from '../_componentes';
import { desdeDeParametro, MOVIMIENTOS_POR_PAGINA, tiposDeParametro } from './_filtro';

export const metadata: Metadata = { title: 'Historial del inventario' };

const ENLACE_SUAVE = 'inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold text-tinta-suave hover:bg-superficie-alterna';

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
  const tipos = tiposDeParametro(parametro(valores, 'tipo'));
  const desde = desdeDeParametro(parametro(valores, 'desde'));
  // Solo para la frase de «Nada de este tipo», que sí parte líneas; los
  // filtros de arriba van en un chip por tipo.
  const etiquetaDeTipos = tipos.map((t) => ETIQUETA_DE_MOVIMIENTO[t]).join(' · ');

  const ficha = /^(INS|UNI|UTE|OTR)-\d{4,}$/.test(codigo) ? await repo.fichaDeArticulo(codigo, false) : null;
  const articulo = ficha && ficha.exito ? ficha.valor : null;
  const lista = await repo.kardex({
    articuloId: articulo?.id,
    sedeId: sedes.some((s) => s.id === sedeId) ? (sedeId as Id) : undefined,
    tipos,
    conValor,
    // Uno de más: si llega, hay movimientos más antiguos y se ofrece «Ver más».
    limite: MOVIMIENTOS_POR_PAGINA + 1,
    desde,
  });
  const movimientos = lista.exito ? lista.valor.slice(0, MOVIMIENTOS_POR_PAGINA) : [];
  const hayMas = lista.exito && lista.valor.length > MOVIMIENTOS_POR_PAGINA;

  // Los filtros vigentes (artículo, sede, tipo) y los cambios pedidos. `desde`
  // solo va cuando se pide: cualquier otro enlace vuelve a la primera página.
  const consulta = (cambios: Record<string, string>) => {
    const tipo = tipos.join(',');
    const q = new URLSearchParams({ ...(codigo ? { articulo: codigo } : {}), ...(sedeId ? { sede: sedeId } : {}), ...(tipo ? { tipo } : {}), ...cambios });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    // La coma de `tipo` queda legible en la barra de direcciones.
    const texto = q.toString().replace(/%2C/gi, ',');
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
            <Link href={consulta({ articulo: '' })} className={ENLACE_SUAVE}>
              <Icono nombre="cerrar" tamano={16} />
              Todos los artículos
            </Link>
          </>
        ) : null}
        {tipos.length > 0 ? (
          <>
            {/* Un chip por tipo: el chip no parte su texto, y uno solo con todos
                los tipos de la URL empujaba la página de lado a 375 px. Sueltos,
                el contenedor los pasa a la línea siguiente. */}
            <span className="text-sm font-semibold text-tinta-suave">Solo:</span>
            {tipos.map((t) => (
              <Chip key={t} tono="azul">
                {ETIQUETA_DE_MOVIMIENTO[t]}
              </Chip>
            ))}
            <Link href={consulta({ tipo: '' })} className={ENLACE_SUAVE}>
              <Icono nombre="cerrar" tamano={16} />
              Quitar filtro
            </Link>
          </>
        ) : null}
      </nav>
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el historial">
          <p>{lista.error}</p>
        </Aviso>
      ) : movimientos.length === 0 ? (
        desde > 0 ? (
          <EstadoVacio
            frase="No hay más"
            detalle="Ya viste todos los movimientos con estos filtros."
            accion={
              <EnlaceDeAccion href={consulta({})} icono="reloj" variante="suave">
                Volver a los más recientes
              </EnlaceDeAccion>
            }
          />
        ) : tipos.length > 0 ? (
          <EstadoVacio frase="Nada de este tipo" detalle={`No hay movimientos de «${etiquetaDeTipos}» con estos filtros. Quita el filtro para ver todo lo que entró y salió.`} />
        ) : (
          <EstadoVacio frase="Sin movimientos" detalle="Cuando se compre, use, entregue o preste algo, aquí se contará qué pasó." />
        )
      ) : (
        <>
          <ul className="grid gap-2">
            {movimientos.map((m) => (
              <FilaDeKardex key={m.id} m={m} conArticulo puedeAnular={tienePermiso(ctx, 'inventario.anular')} />
            ))}
          </ul>
          {desde > 0 || hayMas ? (
            <nav aria-label="Más movimientos" className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-tinta-suave">
                Movimientos {desde + 1} a {desde + movimientos.length}
                {hayMas ? '; hay más antiguos.' : '; no hay más antiguos.'}
              </p>
              {desde > 0 ? (
                <Link href={consulta({})} className={ENLACE_SUAVE}>
                  Volver a los más recientes
                </Link>
              ) : null}
              {hayMas ? (
                <EnlaceDeAccion href={consulta({ desde: String(desde + MOVIMIENTOS_POR_PAGINA) })} icono="mas" variante="suave">
                  Ver más
                </EnlaceDeAccion>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
