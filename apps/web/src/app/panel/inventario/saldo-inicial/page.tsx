/**
 * CAPA: Presentation / App — Saldo inicial (especificación §6.18; administración).
 *
 * La puesta en marcha: lo que ya hay en el estante el día que se empieza a
 * usar el sistema y cuánto costó. Una sola vez por artículo y sede: solo se
 * listan los que aún no tienen movimientos en la sede elegida.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { inventarioRepository } from '@infra/config/composition-root';
import { cn } from '@/lib/cn';
import { RUTAS_INVENTARIO } from '@/lib/rutas';
import { Aviso, CLASE_DE_CAMPO } from '@/presentation/formularios/Campos';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../_sesion';
import { parametro, sedeDeCaja, type Parametros } from '../../caja/_componentes';
import { saldoInicialAccion } from '../actions';
import { admiteFraccion, cantidad, ConfirmacionDeOperacion, ElegirSede, EnlaceDeAccion, InsigniaDeArticulo, nombreConVariante, PLURAL_DE_TIPO, TIPOS_EN_ORDEN, tipoDeParametro } from '../_componentes';

export const metadata: Metadata = { title: 'Saldo inicial' };

export default async function SaldoInicial({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_INVENTARIO.saldoInicial), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'inventario.ajustar');
  const sede = sedeDeCaja(ctx, parametro(valores, 'sede'));
  const tipo = tipoDeParametro(parametro(valores, 'tipo'));
  const repo = await inventarioRepository();
  const hecho = parametro(valores, 'hecho');

  if (hecho) {
    return (
      <ConfirmacionDeOperacion
        repo={repo}
        operacionId={hecho}
        palabra="¡Listo!"
        titulo="Lo que había en el estante ya está en el sistema."
        conValor
        etiquetaDeValor="Valor registrado"
        cerrarHref={RUTAS_INVENTARIO.saldoInicial}
        acciones={
          <>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.saldoInicial} icono="almacen">
              Seguir con otros
            </EnlaceDeAccion>
            <EnlaceDeAccion href={RUTAS_INVENTARIO.inicio} icono="almacen" variante="suave">
              Ver inventario
            </EnlaceDeAccion>
          </>
        }
      />
    );
  }

  if (!sede) return <EstadoVacio frase="Sin sede" detalle="No hay una sede en la que puedas registrar el saldo inicial." />;
  const [lista, conMovimientos] = await Promise.all([repo.existencias({ tipo }), repo.variantesConMovimientos(sede.id)]);
  const pendientes =
    lista.exito && conMovimientos.exito
      ? lista.valor.flatMap((a) => a.variantes.filter((v) => !conMovimientos.valor.has(v.id)).map((v) => ({ a, v })))
      : [];

  return (
    <div className="grid gap-6">
      <EncabezadoDePanel
        titulo="Saldo"
        resaltado="inicial"
        descripcion={`Sede ${sede.nombre}. Lo que ya hay en el estante al empezar y cuánto costó. Se hace una sola vez por artículo; después, usa Registrar compra y Contar.`}
      />
      <ElegirSede ctx={ctx} actual={sede.id} base={RUTAS_INVENTARIO.saldoInicial} consulta={`tipo=${tipo}`} />
      <nav aria-label="Tipo" className="flex flex-wrap gap-2">
        {TIPOS_EN_ORDEN.map((t) => (
          <Link
            key={t}
            href={`${RUTAS_INVENTARIO.saldoInicial}?tipo=${t}${ctx.sedes.length > 1 ? `&sede=${sede.id}` : ''}`}
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
      {!lista.exito || !conMovimientos.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar el inventario">
          <p>{!lista.exito ? lista.error : !conMovimientos.exito ? conMovimientos.error : ''}</p>
        </Aviso>
      ) : pendientes.length === 0 ? (
        <EstadoVacio
          frase="Nada pendiente"
          detalle={`Todos los ${PLURAL_DE_TIPO[tipo].toLowerCase()} ya tienen movimientos en ${sede.nombre}. Para corregir lo que hay, usa Contar.`}
          accion={
            <EnlaceDeAccion href={RUTAS_INVENTARIO.articuloNuevo} icono="mas" variante="suave">
              Agregar artículo
            </EnlaceDeAccion>
          }
        />
      ) : (
        <FormularioDelPanel accion={saldoInicialAccion} etiqueta="Guardar el saldo inicial">
          <input type="hidden" name="clave" value={randomUUID()} />
          <input type="hidden" name="sede" value={sede.id} />
          <ul className="grid gap-2">
            {pendientes.map(({ a, v }) => {
              const nombre = nombreConVariante(a.nombre, v.etiqueta);
              return (
                <li key={v.id} className="grid gap-3 rounded-md border-2 border-linea bg-tarjeta p-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:items-end">
                  <input type="hidden" name={`nombre-${v.id}`} value={nombre} />
                  <span className="flex items-center gap-3">
                    <InsigniaDeArticulo icono={a.icono} />
                    <span className="font-semibold text-tinta">{nombre}</span>
                  </span>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-tinta">Hay ({cantidad(2000n, a.unidad).replace(/^2 /, '')})</span>
                    <input name={`cantidad-${v.id}`} inputMode={admiteFraccion(a) ? 'decimal' : 'numeric'} autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-tinta">Costó todo (Bs)</span>
                    <input name={`valor-${v.id}`} inputMode="decimal" autoComplete="off" className={`${CLASE_DE_CAMPO} text-right`} />
                  </label>
                  {a.controlaVencimiento ? (
                    <label className="grid gap-1">
                      <span className="text-sm font-semibold text-tinta">Vence</span>
                      <input name={`vence-${v.id}`} type="date" className={CLASE_DE_CAMPO} />
                    </label>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
          <div>
            <BotonGuardar icono="check" enviando="Guardando…">
              Guardar saldo inicial
            </BotonGuardar>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}
