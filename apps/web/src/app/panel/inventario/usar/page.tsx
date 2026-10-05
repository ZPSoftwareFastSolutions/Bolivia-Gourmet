/**
 * CAPA: Presentation / App — Usar insumos en clase (especificación §6.2).
 *
 * Tres preguntas: ¿para qué? (clase de un grupo, práctica, evento…), ¿qué se
 * usó? (cada insumo con lo que hay al lado; se escribe solo lo usado) y un
 * botón con verbo. La base saca primero lo más antiguo que no esté vencido.
 * La confirmación muestra cada saldo «antes → ahora», avisa si algo quedó
 * bajo el mínimo y, a administración, el costo de la clase.
 */

import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { tienePermiso } from '@core/domain/identidad/contexto-de-panel';
import { ETIQUETA_DE_DESTINO, type DestinoDeUso } from '@core/domain/inventario/movimiento';
import type { Id } from '@core/domain/shared/tipos-base';
import { inventarioRepository } from '@infra/config/composition-root';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso, CampoDeTexto, CLASE_DE_CAMPO, Etiquetado, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, SelectorDeSede, type Parametros } from '../../caja/_componentes';
import { usarAccion } from '../actions';
import { ConfirmacionDeOperacion, EnlaceDeAccion } from '../_componentes';
import { FilaDeUso } from './_fila';

export const metadata: Metadata = { title: 'Usar en clase' };

const DESTINOS: readonly DestinoDeUso[] = ['clase', 'practica', 'evento', 'degustacion', 'uso_interno', 'otro'];

export default async function UsarEnClase({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.usar), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.operar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const conValor = tienePermiso(ctx, 'contabilidad.leer');
  const repo = await inventarioRepository();
  const hecho = parametro(valores, 'hecho');
  const otra = `${RUTAS_INVENTARIO.usar}${ctx.sedes.length > 1 && sede ? `?sede=${sede.id}` : ''}`;

  if (hecho) {
    const [lineas, existencias] = await Promise.all([repo.kardex({ operacionId: hecho as Id, limite: 60 }), repo.existencias({ tipos: ['insumo', 'otro'] })]);
    const bajos =
      lineas.exito && existencias.exito
        ? existencias.valor.filter((a) =>
            a.variantes.some((v) => v.sedes.some((s) => s.estado !== 'bien' && a.stockMinimo > 0n && lineas.valor.some((m) => m.varianteId === v.id && m.sedeId === s.sedeId))),
          )
        : [];
    return (
      <div className="grid gap-6">
        <ConfirmacionDeOperacion
          repo={repo}
          operacionId={hecho}
          palabra="¡Registrado!"
          titulo="Se descontó del inventario lo que se usó."
          conValor={conValor}
          etiquetaDeValor="Costo de lo usado"
          cerrarHref={otra}
          acciones={
            <>
              <EnlaceDeAccion href={otra} icono="bol">
                Registrar otro uso
              </EnlaceDeAccion>
              <EnlaceDeAccion href={RUTAS_INVENTARIO.inicio} icono="almacen" variante="suave">
                Ver inventario
              </EnlaceDeAccion>
            </>
          }
        />
        {bajos.length > 0 ? (
          <Aviso tono="info" titulo="Quedó poco">
            <p>
              {bajos.map((a) => a.nombre).join(', ')} {bajos.length === 1 ? 'quedó' : 'quedaron'} por debajo del mínimo.{' '}
              {tienePermiso(ctx, 'inventario.comprar') ? 'Registra la compra cuando llegue.' : 'Avisa a administración para que compre.'}
            </p>
          </Aviso>
        ) : null}
      </div>
    );
  }

  if (!sede) {
    return <EstadoVacio frase="Sin sede asignada" detalle="Pide a administración que te asigne una sede para registrar el uso." />;
  }

  const [existencias, grupos] = await Promise.all([repo.existencias({ tipos: ['insumo', 'otro'] }), repo.gruposParaUso(sede.id)]);
  const pedido = parametro(valores, 'articulo');
  const articulos = existencias.exito ? [...existencias.valor].sort((x, y) => Number(y.codigo === pedido) - Number(x.codigo === pedido)) : [];

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel titulo="Usar en" resaltado="clase" descripcion={`Sede ${sede.nombre}. Escribe solo lo que se usó; deja vacío lo demás.`} />
      <SelectorDeSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.usar} />
      {!existencias.exito || !grupos.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los insumos">
          <p>{!existencias.exito ? existencias.error : !grupos.exito ? grupos.error : ''}</p>
        </Aviso>
      ) : articulos.length === 0 ? (
        <EstadoVacio frase="Aún no hay insumos" detalle="Cuando administración agregue insumos y registre lo que hay, podrás descontarlos aquí." />
      ) : (
        <FormularioDelPanel accion={usarAccion} etiqueta="Registrar el uso de insumos">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-estructural">
              <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sobre-estructural">1</span>
              ¿Para qué se usó?
            </h2>
            <GrupoDeOpciones
              nombre="destino"
              leyenda="Para qué"
              columnas={3}
              valor="clase"
              opciones={DESTINOS.map((d) => ({ valor: d, etiqueta: ETIQUETA_DE_DESTINO[d] }))}
            />
            <Etiquetado id="grupo" etiqueta="Grupo de la clase" opcional ayuda={grupos.valor.length === 0 ? 'No hay grupos abiertos ni en curso en esta sede.' : 'Para una clase, elige el grupo.'}>
              <select id="grupo" name="grupo" className={CLASE_DE_CAMPO} defaultValue="">
                <option value="">— Sin grupo —</option>
                {grupos.valor.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </Etiquetado>
            <CampoDeTexto id="detalle" etiqueta="Tema o detalle" opcional maxLength={300} autoComplete="off" placeholder="Por ejemplo: Masa madre" />
          </section>

          <section className="grid gap-3 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-estructural">
              <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sobre-estructural">2</span>
              ¿Qué se usó?
            </h2>
            <ul className="grid gap-2">
              {articulos.map((a) => (
                <FilaDeUso key={a.id} articulo={a} sedeId={sede.id} destacado={a.codigo === pedido} />
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <BotonGuardar icono="check" enviando="Registrando…">
              Registrar uso
            </BotonGuardar>
            <span className="text-sm text-tinta-suave">Se usa primero lo más antiguo que no esté vencido.</span>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}
