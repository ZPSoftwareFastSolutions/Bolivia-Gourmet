/**
 * CAPA: Presentation / App — Contar el inventario (especificación §6.8; administración).
 *
 * Por sede y tipo: «El sistema dice: 9,5 kg» y una casilla «Contaste».
 * Solo se guardan las filas contadas; las que no coinciden piden su motivo.
 * Todo o nada: si alguien movió un artículo mientras se contaba, la base lo
 * rechaza y se vuelve a abrir el conteo con los números nuevos.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import type { ArticuloConExistencias } from '@core/application/ports/inventario.port';
import { inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso, CLASE_DE_CAMPO } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { Confirmacion, EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, type Parametros } from '../../caja/_componentes';
import { contarAccion } from '../actions';
import { admiteFraccion, cantidad, cantidadParaCampo, ConfirmacionDeOperacion, ElegirSede, EnlaceDeAccion, nombreConVariante, PLURAL_DE_TIPO, TIPOS_EN_ORDEN, tipoDeParametro } from '../_componentes';

export const metadata: Metadata = { title: 'Contar el inventario' };

export default async function Contar({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.contar), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.ajustar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const tipo = tipoDeParametro(parametro(valores, 'tipo'));
  const repo = await inventarioRepository();
  const hecho = parametro(valores, 'hecho');

  if (hecho) {
    const contadas = Number.parseInt(parametro(valores, 'contadas'), 10) || 0;
    const diferencias = Number.parseInt(parametro(valores, 'diferencias'), 10) || 0;
    const titulo = `Contaste ${contadas === 1 ? '1 artículo' : `${contadas} artículos`}: ${diferencias === 0 ? 'todo coincide con el sistema.' : diferencias === 1 ? '1 no coincidía y ya se ajustó.' : `${diferencias} no coincidían y ya se ajustaron.`}`;
    const acciones = (
      <EnlaceDeAccion href={RUTAS_INVENTARIO.contar} icono="check">
        Contar otro tipo
      </EnlaceDeAccion>
    );
    return diferencias > 0 ? (
      <ConfirmacionDeOperacion
        repo={repo}
        operacionId={hecho}
        palabra="¡Conteo guardado!"
        titulo={titulo}
        conValor
        etiquetaDeValor="Valor ajustado"
        cerrarHref={RUTAS_INVENTARIO.contar}
        acciones={acciones}
      />
    ) : (
      <Confirmacion palabra="¡Todo en orden!" titulo={titulo} cerrarHref={RUTAS_INVENTARIO.contar} acciones={acciones}>
        <p>El conteo queda como constancia.</p>
      </Confirmacion>
    );
  }

  if (!sede) return <EstadoVacio frase="Sin sede" detalle="No hay una sede en la que puedas contar." />;
  const lista = await repo.existencias({ tipo });

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Contar el"
        resaltado="inventario"
        descripcion={`Sede ${sede.nombre}. Cuenta lo que hay en el estante y escríbelo. Deja vacío lo que no contaste.`}
      />
      <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.contar} consulta={`tipo=${tipo}`} />
      <nav aria-label="Tipo" className="flex flex-wrap gap-2">
        {TIPOS_EN_ORDEN.map((t) => (
          <Link
            key={t}
            href={`${RUTAS_INVENTARIO.contar}?tipo=${t}${ctx.sedes.length > 1 ? `&sede=${sede.id}` : ''}`}
            aria-current={t === tipo ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold',
              t === tipo ? 'border-estructural bg-estructural text-sobre-estructural' : 'border-linea bg-tarjeta text-tinta-suave hover:border-estructural',
            )}
          >
            {PLURAL_DE_TIPO[t]}
          </Link>
        ))}
      </nav>
      {!lista.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el inventario">
          <p>{lista.error}</p>
        </Aviso>
      ) : lista.valor.length === 0 ? (
        <EstadoVacio frase={`Sin ${PLURAL_DE_TIPO[tipo].toLowerCase()}`} detalle="No hay nada que contar de este tipo." />
      ) : (
        <FormularioDelPanel accion={contarAccion} etiqueta="Guardar el conteo">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />
          <ul className="grid gap-2">
            {lista.valor.flatMap((a) => a.variantes.map((v) => <FilaDeConteo key={v.id} articulo={a} varianteId={v.id} sedeId={sede.id} />))}
          </ul>
          <Aviso tono="info" titulo="Todo o nada">
            <p>Si alguien usa o recibe algo mientras cuentas, el sistema te pedirá contar de nuevo esas filas.</p>
          </Aviso>
          <div>
            <BotonGuardar icono="check" enviando="Guardando conteo…">
              Guardar conteo
            </BotonGuardar>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}

function FilaDeConteo({ articulo: a, varianteId, sedeId }: { readonly articulo: ArticuloConExistencias; readonly varianteId: string; readonly sedeId: string }) {
  const v = a.variantes.find((x) => x.id === varianteId);
  const s = v?.sedes.find((x) => x.sedeId === sedeId);
  if (!v || !s) return null;
  const nombre = nombreConVariante(a.nombre, v.etiqueta);
  const id = `contado-${v.id}`;
  return (
    <li className="grid gap-3 rounded-md border-2 border-linea bg-tarjeta p-3 lg:grid-cols-[minmax(0,1.4fr)_10rem_minmax(0,1.6fr)] lg:items-start">
      <input type="hidden" name={`nombre-${v.id}`} value={nombre} />
      <input type="hidden" name={`vista-${v.id}`} value={cantidadParaCampo(s.disponible)} />
      <span>
        <label htmlFor={id} className="block font-semibold text-tinta">
          {nombre}
        </label>
        <span className="text-sm text-tinta-suave">
          El sistema dice: <strong className="text-estructural">{cantidad(s.disponible, a.unidad)}</strong>
          {s.prestado > 0n ? ` · prestados aparte: ${cantidad(s.prestado, a.unidad)}` : ''}
        </span>
      </span>
      <label className="grid gap-1">
        <span className="text-sm font-semibold text-tinta">Contaste</span>
        <input id={id} name={id} inputMode={admiteFraccion(a) ? 'decimal' : 'numeric'} autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
      </label>
      <span className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-tinta">Si no coincide, ¿por qué?</span>
          <input name={`motivo-${v.id}`} maxLength={300} autoComplete="off" className={CLASE_DE_CAMPO} placeholder="Merma, se encontró en otro estante…" />
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-estructural">Si sobra algo que nunca se compró</summary>
          <span className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-tinta">Cuánto vale lo que sobra (Bs)</span>
              <input name={`valor-${v.id}`} inputMode="decimal" autoComplete="off" className={CLASE_DE_CAMPO} />
            </label>
            {a.controlaVencimiento ? (
              <label className="grid gap-1">
                <span className="text-tinta">Vence</span>
                <input name={`vence-${v.id}`} type="date" className={CLASE_DE_CAMPO} />
              </label>
            ) : null}
          </span>
        </details>
      </span>
    </li>
  );
}

