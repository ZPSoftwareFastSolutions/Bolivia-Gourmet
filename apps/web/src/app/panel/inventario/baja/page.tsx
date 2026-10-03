/**
 * CAPA: Presentation / App — Dar de baja (especificación §6.7).
 *
 * Primero el artículo (o llega elegido desde su ficha o desde el aviso de
 * vencidos, con el lote). Luego ¿por qué? en tarjetas grandes, cuánto y una
 * frase. Antes del botón, lo que va a pasar dicho en una oración; el botón es
 * de peligro y dice exactamente lo que hace.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { COMPORTAMIENTO_POR_TIPO } from '@core/domain/inventario/articulo';
import { ETIQUETA_DE_MOTIVO_DE_BAJA, type MotivoDeBaja } from '@core/domain/inventario/movimiento';
import { inventarioRepository } from '@infra/config/composition-root';
import { formatearDiaCorto } from '@/lib/fechas';
import { RUTAS_INVENTARIO, rutaDeArticulo } from '@/lib/rutas';
import { Aviso, AreaDeTexto, CLASE_DE_CAMPO, Etiquetado, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, type Parametros } from '../../caja/_componentes';
import { bajaAccion } from '../actions';
import { admiteFraccion, cantidad, ElegirSede, InsigniaDeArticulo, PLURAL_DE_TIPO, TIPOS_EN_ORDEN } from '../_componentes';

export const metadata: Metadata = { title: 'Dar de baja' };

const MOTIVOS: readonly MotivoDeBaja[] = ['vencimiento', 'dano', 'rotura', 'perdida', 'merma', 'otro'];

const DETALLE_DE_MOTIVO: Record<MotivoDeBaja, string> = {
  vencimiento: 'Elige la compra vencida',
  dano: 'Se echó a perder o se manchó',
  rotura: 'Se quebró o dejó de servir',
  perdida: 'No aparece',
  merma: 'Se fue en la preparación o el almacenaje',
  otro: 'Cuéntalo en una frase',
};

export default async function DarDeBaja({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.baja), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.operar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const repo = await inventarioRepository();
  const codigo = parametro(valores, 'articulo');

  if (!codigo) {
    const todos = await repo.existencias({});
    return (
      <div className="grid gap-6">
        <EncabezadoDePanel titulo="Dar de" resaltado="baja" descripcion="¿Qué sale del inventario? Elige el artículo." />
        {!todos.exito ? (
          <Aviso tono="error" titulo="No pudimos cargar el inventario">
            <p>{todos.error}</p>
          </Aviso>
        ) : todos.valor.length === 0 ? (
          <EstadoVacio frase="Nada que dar de baja" detalle="El inventario aún está vacío." />
        ) : (
          TIPOS_EN_ORDEN.map((t) => {
            const lista = todos.valor.filter((a) => a.tipo === t);
            if (lista.length === 0) return null;
            return (
              <section key={t} aria-label={PLURAL_DE_TIPO[t]} className="grid gap-2">
                <h2 className="t-display text-2xl text-estructural">{PLURAL_DE_TIPO[t]}</h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`${RUTAS_INVENTARIO.baja}?articulo=${a.codigo}${sede && ctx.sedes.length > 1 ? `&sede=${sede.id}` : ''}`}
                        className="flex min-h-14 items-center gap-3 rounded-md border-2 border-linea bg-tarjeta p-3 font-semibold text-tinta hover:border-estructural"
                      >
                        <InsigniaDeArticulo icono={a.icono} />
                        {a.nombre}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    );
  }

  const ficha = await repo.fichaDeArticulo(codigo, false);
  if (!ficha.exito) {
    return (
      <Aviso tono="error" titulo="No pudimos abrir el artículo">
        <p>{ficha.error}</p>
      </Aviso>
    );
  }
  const a = ficha.valor;
  if (!a || !sede) {
    return <EstadoVacio frase="No encontramos ese artículo" accion={<Link href={RUTAS_INVENTARIO.baja} className="enlace font-semibold">Elegir otro</Link>} />;
  }
  const vencidos = a.lotes.filter((l) => l.sedeId === sede.id && l.estado === 'vencido');
  const loteElegido = vencidos.find((l) => l.id === parametro(valores, 'lote'));
  const motivos = MOTIVOS.filter((m) => m !== 'vencimiento' || vencidos.length > 0);
  const variante = a.variantes[0];
  const enSede = variante?.sedes.find((s) => s.sedeId === sede.id);
  const unidad = cantidad(2000n, a.unidad).replace(/^2 /, '');

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        gancho={COMPORTAMIENTO_POR_TIPO[a.tipo].etiqueta}
        titulo="Dar de baja:"
        resaltado={a.nombre}
        descripcion={`Sede ${sede.nombre}.${a.tipo !== 'uniforme' && enSede ? ` En el estante hay ${cantidad(enSede.disponible, a.unidad)}.` : ''}`}
      />
      <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.baja} consulta={`articulo=${a.codigo}`} />
      <FormularioDelPanel accion={bajaAccion} etiqueta="Dar de baja">
        <input type="hidden" name="clave" value={randomUUID()} />
        <input type="hidden" name="sede" value={sede.id} />
        <input type="hidden" name="codigo" value={a.codigo} />

        {a.tipo === 'uniforme' ? (
          <GrupoDeOpciones
            nombre="variante"
            leyenda="¿Qué talla?"
            columnas={3}
            opciones={a.variantes.map((v) => {
              const s = v.sedes.find((x) => x.sedeId === sede.id);
              return { valor: v.id, etiqueta: v.etiqueta, detalle: `Hay ${s ? cantidad(s.disponible, 'unidad') : '0 unidades'}` };
            })}
          />
        ) : (
          <input type="hidden" name="variante" value={variante?.id ?? ''} />
        )}

        <GrupoDeOpciones
          nombre="motivo"
          leyenda="¿Por qué sale?"
          columnas={3}
          valor={loteElegido ? 'vencimiento' : undefined}
          opciones={motivos.map((m) => ({ valor: m, etiqueta: ETIQUETA_DE_MOTIVO_DE_BAJA[m], detalle: DETALLE_DE_MOTIVO[m] }))}
        />

        {vencidos.length > 0 ? (
          <Etiquetado id="lote" etiqueta="Compra vencida" opcional ayuda="Solo si sale por vencimiento.">
            <select id="lote" name="lote" className={CLASE_DE_CAMPO} defaultValue={loteElegido?.id ?? ''}>
              <option value="">— Elige la compra —</option>
              {vencidos.map((l) => (
                <option key={l.id} value={l.id}>
                  Compra del {formatearDiaCorto(l.fechaIngreso)} · quedan {cantidad(l.cantidadRestante, l.unidad)} · venció el {l.venceEl ? formatearDiaCorto(l.venceEl) : '—'}
                </option>
              ))}
            </select>
          </Etiquetado>
        ) : null}

        <Etiquetado id="cantidad" etiqueta={`¿Cuánto sale? (${unidad})`}>
          <input
            id="cantidad"
            name="cantidad"
            required
            inputMode={admiteFraccion(a) ? 'decimal' : 'numeric'}
            autoComplete="off"
            defaultValue={loteElegido ? cantidad(loteElegido.cantidadRestante, a.unidad).replace(/ .*$/, '').replace(/\./g, '') : ''}
            className={`${CLASE_DE_CAMPO} max-w-48`}
          />
        </Etiquetado>
        <AreaDeTexto id="detalle" etiqueta="¿Qué pasó?" opcional rows={2} maxLength={300} ayuda="Una frase. Es obligatoria salvo en lo vencido." />

        <Aviso tono="info" titulo="Antes de confirmar">
          <p>
            Vas a sacar {a.nombre.toLowerCase()} del inventario de {sede.nombre}. Quedará registrado con tu nombre; si te equivocas, administración puede anularlo.
          </p>
        </Aviso>
        <div className="flex flex-wrap gap-3">
          <BotonGuardar icono="papelera" variante="peligro" enviando="Dando de baja…">
            Sí, dar de baja
          </BotonGuardar>
          <Link href={rutaDeArticulo(a.codigo)} className="inline-flex min-h-12 items-center rounded-md px-4 font-semibold text-tinta-suave hover:bg-superficie-alterna">
            Cancelar
          </Link>
        </div>
      </FormularioDelPanel>
    </div>
  );
}
