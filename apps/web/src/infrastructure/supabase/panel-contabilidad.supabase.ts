/**
 * CAPA: Infrastructure / Supabase
 *
 * Contabilidad del panel (especificación §5.7; solo administración) con el
 * cliente de ESTA petición. Todo es lectura bajo RLS: los totales del mes y
 * el cuadre los suma la base (`resumen_del_mes`, `verificar_cuadre`, que
 * exigen `contabilidad.leer`); los gastos, las compras y la tarjeta PEPS se
 * leen de sus tablas. Registrar o anular va por la caja y el inventario.
 *
 * Los nombres (concepto, sede, quién registró) se piden en consultas aparte
 * con `.in(...)` y no con embebidos de PostgREST: así no depende de cómo se
 * llamen las claves foráneas, y si la RLS no deja leer un perfil el nombre
 * queda vacío en lugar de tumbar la lista entera.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MedioDePago } from '@core/domain/caja/cobro';
import { sumarMeses } from '@core/domain/shared/calendario';
import { exito, fallo, type Centavos, type FechaISO, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type {
  CompraEnLista,
  ContabilidadPort,
  CuadreDeLaBase,
  DatosDeTarjetaPeps,
  GastoEnLista,
  LoteDeTarjeta,
  TomaDeLote,
  TotalesDelMesEnBase,
} from '@core/application/ports/contabilidad.port';
// Tope de filas de una lista del mes (gastos o compras): vive en el puerto
// porque sus pantallas lo leen para avisar del corte.
import { TOPE_DE_LISTA_DEL_MES } from '@core/application/ports/contabilidad.port';
import type { MovimientoEnKardex, TipoDeComprobante } from '@core/application/ports/inventario.port';
import { cuadreDesdeBase, totalesDesdeBase } from './contabilidad-desde-base';
import { milesimasDe } from './cantidades';
import { traducirErrorDePanel } from './errores-del-panel';
import { PanelInventarioSupabase } from './panel-inventario.supabase';
import { argsDe } from './rpc';
import type { Database } from './tipos-de-base.generados';

/** Movimientos de la tarjeta PEPS (el más nuevo primero, luego se invierte). */
/** La API devuelve como mucho 1000 filas por consulta: la tarjeta se lee por páginas. */
const PAGINA_DE_TARJETA = 1000;
const PAGINAS_MAXIMAS = 20;
/** Ids por consulta `.in(...)`: cada uuid ocupa ~37 caracteres en la URL. */
const TANDA = 100;

const MES_INVALIDO = 'El mes no es válido. Elige uno en el selector de meses.';

const COLUMNAS_DE_GASTO =
  'id, numero, sede_id, fecha, concepto_id, descripcion, monto, medio, referencia, comprobante, numero_comprobante, proveedor, anulado_en, anulado_el, anulacion_motivo, registrado_por';

const COLUMNAS_DE_COMPRA =
  'id, numero, operacion_id, sede_id, fecha, fecha_documento, proveedor, comprobante, numero_comprobante, medio, referencia, total, anulado_en, anulado_el, anulacion_motivo, registrado_por';

type FilaDeGasto = Pick<
  Database['public']['Tables']['gastos']['Row'],
  | 'id'
  | 'numero'
  | 'sede_id'
  | 'fecha'
  | 'concepto_id'
  | 'descripcion'
  | 'monto'
  | 'medio'
  | 'referencia'
  | 'comprobante'
  | 'numero_comprobante'
  | 'proveedor'
  | 'anulado_en'
  | 'anulado_el'
  | 'anulacion_motivo'
  | 'registrado_por'
>;

type FilaDeCompra = Pick<
  Database['public']['Tables']['compras']['Row'],
  | 'id'
  | 'numero'
  | 'operacion_id'
  | 'sede_id'
  | 'fecha'
  | 'fecha_documento'
  | 'proveedor'
  | 'comprobante'
  | 'numero_comprobante'
  | 'medio'
  | 'referencia'
  | 'total'
  | 'anulado_en'
  | 'anulado_el'
  | 'anulacion_motivo'
  | 'registrado_por'
>;

interface Nombres {
  readonly sedes: ReadonlyMap<string, string>;
  readonly quienes: ReadonlyMap<string, string>;
}

/** `AAAA-MM` → primer día del mes y primer día del mes siguiente (o null si no es un mes). */
function rangoDelMes(mes: string): { readonly desde: FechaISO; readonly hasta: FechaISO } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const desde = `${mes}-01` as FechaISO;
  return { desde, hasta: sumarMeses(desde, 1) };
}

/**
 * Filtro PostgREST «con fecha en el mes O anulado en el mes». Una anulación
 * cuenta en el mes en que se hace (igual que en `resumen_del_mes`), así que
 * la lista del mes debe mostrarla aunque el documento sea de antes.
 */
function delMesOAnuladoEnElMes(desde: FechaISO, hasta: FechaISO): string {
  return `and(fecha.gte.${desde},fecha.lt.${hasta}),and(anulado_el.gte.${desde},anulado_el.lt.${hasta})`;
}

function unicos(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

function enTandas<T>(valores: readonly T[], tamano: number): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < valores.length; i += tamano) tandas.push(valores.slice(i, i + tamano));
  return tandas;
}

function compraEnLista(c: FilaDeCompra, nombres: Nombres, articulos: ReadonlyMap<string, readonly string[]>): CompraEnLista {
  return {
    id: c.id as Id,
    numero: c.numero,
    operacionId: c.operacion_id as Id,
    sedeId: c.sede_id as Id,
    sedeNombre: nombres.sedes.get(c.sede_id) ?? '',
    fecha: c.fecha as FechaISO,
    fechaDocumento: (c.fecha_documento ?? null) as FechaISO | null,
    proveedor: c.proveedor,
    comprobante: c.comprobante as TipoDeComprobante,
    numeroComprobante: c.numero_comprobante,
    medio: c.medio as MedioDePago,
    referencia: c.referencia,
    total: c.total as Centavos,
    anulado: c.anulado_en !== null,
    anuladoEl: (c.anulado_el ?? null) as FechaISO | null,
    anulacionMotivo: c.anulacion_motivo,
    quien: nombres.quienes.get(c.registrado_por) ?? '',
    articulos: articulos.get(c.id) ?? [],
  };
}

export class PanelContabilidadSupabase implements ContabilidadPort {
  private readonly cliente: SupabaseClient<Database>;

  constructor(cliente: SupabaseClient<Database>) {
    this.cliente = cliente;
  }

  // ---------------------------------------------------------------- totales que suma la base

  async totalesDelMes(mes: string, sedeId?: Id): Promise<Resultado<TotalesDelMesEnBase>> {
    const rango = rangoDelMes(mes);
    if (!rango) return fallo(MES_INVALIDO);
    const { data, error } = await this.cliente.rpc(
      'resumen_del_mes',
      argsDe<'resumen_del_mes'>({ p_mes: rango.desde, p_sede: sedeId ?? null }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(totalesDesdeBase(data));
  }

  async verificarCuadre(sedeId?: Id): Promise<Resultado<CuadreDeLaBase>> {
    const { data, error } = await this.cliente.rpc('verificar_cuadre', argsDe<'verificar_cuadre'>({ p_sede: sedeId ?? null }));
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(cuadreDesdeBase(data));
  }

  // ---------------------------------------------------------------- gastos y compras del mes

  async gastos(mes: string, sedeId?: Id): Promise<Resultado<readonly GastoEnLista[]>> {
    const rango = rangoDelMes(mes);
    if (!rango) return fallo(MES_INVALIDO);
    let consulta = this.cliente
      .from('gastos')
      .select(COLUMNAS_DE_GASTO)
      .or(delMesOAnuladoEnElMes(rango.desde, rango.hasta))
      .order('numero', { ascending: false })
      .limit(TOPE_DE_LISTA_DEL_MES);
    if (sedeId) consulta = consulta.eq('sede_id', sedeId);
    const { data, error } = await consulta.returns<FilaDeGasto[]>();
    if (error) return fallo(traducirErrorDePanel(error));
    const filas = data ?? [];

    const [nombres, conceptos] = await Promise.all([
      this.nombres(filas),
      this.conceptos(unicos(filas.map((g) => g.concepto_id))),
    ]);
    if (!nombres.exito) return nombres;
    if (!conceptos.exito) return conceptos;

    return exito(
      filas.map((g): GastoEnLista => {
        const concepto = conceptos.valor.get(g.concepto_id);
        return {
          id: g.id as Id,
          numero: g.numero,
          sedeId: g.sede_id as Id,
          sedeNombre: nombres.valor.sedes.get(g.sede_id) ?? '',
          fecha: g.fecha as FechaISO,
          conceptoNombre: concepto?.nombre ?? '',
          conceptoIcono: concepto?.icono ?? '',
          descripcion: g.descripcion,
          monto: g.monto as Centavos,
          medio: g.medio as MedioDePago,
          referencia: g.referencia,
          comprobante: g.comprobante as TipoDeComprobante,
          numeroComprobante: g.numero_comprobante,
          proveedor: g.proveedor,
          anulado: g.anulado_en !== null,
          anuladoEl: (g.anulado_el ?? null) as FechaISO | null,
          anulacionMotivo: g.anulacion_motivo,
          quien: nombres.valor.quienes.get(g.registrado_por) ?? '',
        };
      }),
    );
  }

  async compras(mes: string, sedeId?: Id): Promise<Resultado<readonly CompraEnLista[]>> {
    const rango = rangoDelMes(mes);
    if (!rango) return fallo(MES_INVALIDO);
    let consulta = this.cliente
      .from('compras')
      .select(COLUMNAS_DE_COMPRA)
      .or(delMesOAnuladoEnElMes(rango.desde, rango.hasta))
      .order('numero', { ascending: false })
      .limit(TOPE_DE_LISTA_DEL_MES);
    if (sedeId) consulta = consulta.eq('sede_id', sedeId);
    const { data, error } = await consulta.returns<FilaDeCompra[]>();
    if (error) return fallo(traducirErrorDePanel(error));
    const filas = data ?? [];
    const [nombres, articulos] = await Promise.all([this.nombres(filas), this.articulosDeCompras(filas.map((c) => c.id))]);
    if (!nombres.exito) return nombres;
    if (!articulos.exito) return articulos;
    return exito(filas.map((c) => compraEnLista(c, nombres.valor, articulos.valor)));
  }

  async compra(id: Id): Promise<Resultado<CompraEnLista | null>> {
    const { data, error } = await this.cliente.from('compras').select(COLUMNAS_DE_COMPRA).eq('id', id).returns<FilaDeCompra[]>().maybeSingle();
    if (error) return fallo(traducirErrorDePanel(error));
    if (!data) return exito(null);
    const [nombres, articulos] = await Promise.all([this.nombres([data]), this.articulosDeCompras([data.id])]);
    if (!nombres.exito) return nombres;
    if (!articulos.exito) return articulos;
    return exito(compraEnLista(data, nombres.valor, articulos.valor));
  }

  /** Qué se compró en cada compra (los artículos de sus líneas, sin repetir). */
  private async articulosDeCompras(ids: readonly string[]): Promise<Resultado<ReadonlyMap<string, readonly string[]>>> {
    const porCompra = new Map<string, string[]>();
    const tandas = await Promise.all(
      enTandas(unicos(ids), TANDA).map((lote) =>
        this.cliente.from('v_kardex').select('compra_id, articulo_nombre, etiqueta, numero').eq('tipo', 'compra').in('compra_id', lote).order('numero'),
      ),
    );
    for (const { data, error } of tandas) {
      if (error) return fallo(traducirErrorDePanel(error));
      for (const f of data ?? []) {
        if (!f.compra_id) continue;
        const nombre = f.etiqueta && f.etiqueta !== 'Única' ? `${f.articulo_nombre ?? ''} · ${f.etiqueta}` : (f.articulo_nombre ?? '');
        const lista = porCompra.get(f.compra_id) ?? [];
        if (!lista.includes(nombre)) lista.push(nombre);
        porCompra.set(f.compra_id, lista);
      }
    }
    return exito(porCompra);
  }

  // ---------------------------------------------------------------- tarjeta kárdex PEPS

  async tarjetaPeps(articuloId: Id, sedeId: Id): Promise<Resultado<DatosDeTarjetaPeps>> {
    // Todo el libro del insumo en la sede, por páginas: si faltaran los
    // movimientos más antiguos, faltarían las entradas que crearon los lotes.
    const inventario = new PanelInventarioSupabase(this.cliente);
    const leidos: MovimientoEnKardex[] = [];
    for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina += 1) {
      const kardex = await inventario.kardex({ articuloId, sedeId, conValor: true, limite: PAGINA_DE_TARJETA, desde: pagina * PAGINA_DE_TARJETA });
      if (!kardex.exito) return kardex;
      leidos.push(...kardex.valor);
      if (kardex.valor.length < PAGINA_DE_TARJETA) break;
      if (pagina === PAGINAS_MAXIMAS - 1) return fallo('Esta tarjeta tiene demasiados movimientos para mostrarse completa.');
    }
    // El kárdex llega del más nuevo al más antiguo; la tarjeta se lee al revés.
    const movimientos = [...leidos].reverse();

    const tomas: TomaDeLote[] = [];
    const tandasDeTomas = await Promise.all(
      enTandas(unicos(movimientos.map((m) => m.id)), TANDA).map((ids) =>
        this.cliente.from('movimiento_lotes').select('movimiento_id, lote_id, cantidad, valor').in('movimiento_id', ids),
      ),
    );
    for (const { data, error } of tandasDeTomas) {
      if (error) return fallo(traducirErrorDePanel(error));
      for (const t of data ?? []) {
        tomas.push({ movimientoId: t.movimiento_id as Id, loteId: t.lote_id as Id, cantidad: milesimasDe(t.cantidad), valor: t.valor as Centavos });
      }
    }

    const lotes: LoteDeTarjeta[] = [];
    const tandasDeLotes = await Promise.all(
      enTandas(unicos(tomas.map((t) => t.loteId)), TANDA).map((ids) =>
        this.cliente.from('lotes').select('id, secuencia, fecha_ingreso, vence_el, origen').in('id', ids),
      ),
    );
    for (const { data, error } of tandasDeLotes) {
      if (error) return fallo(traducirErrorDePanel(error));
      for (const l of data ?? []) {
        lotes.push({
          id: l.id as Id,
          secuencia: l.secuencia,
          fechaIngreso: l.fecha_ingreso as FechaISO,
          venceEl: (l.vence_el ?? null) as FechaISO | null,
          origen: l.origen,
        });
      }
    }
    // Orden PEPS: primero lo que entró antes; a igual fecha, la secuencia.
    lotes.sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? -1 : a.fechaIngreso > b.fechaIngreso ? 1 : a.secuencia - b.secuencia));

    return exito({ movimientos, tomas, lotes });
  }

  // ---------------------------------------------------------------- nombres

  /** Sedes y quién registró de un grupo de documentos. */
  private async nombres(filas: readonly { readonly sede_id: string; readonly registrado_por: string }[]): Promise<Resultado<Nombres>> {
    const [sedes, quienes] = await Promise.all([this.sedes(unicos(filas.map((f) => f.sede_id))), this.quienes(unicos(filas.map((f) => f.registrado_por)))]);
    if (!sedes.exito) return sedes;
    if (!quienes.exito) return quienes;
    return exito({ sedes: sedes.valor, quienes: quienes.valor });
  }

  private async sedes(ids: readonly string[]): Promise<Resultado<ReadonlyMap<string, string>>> {
    if (ids.length === 0) return exito(new Map());
    const { data, error } = await this.cliente.from('sedes').select('id, nombre').in('id', [...ids]);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(new Map((data ?? []).map((s) => [s.id, s.nombre])));
  }

  private async conceptos(ids: readonly string[]): Promise<Resultado<ReadonlyMap<string, { readonly nombre: string; readonly icono: string }>>> {
    if (ids.length === 0) return exito(new Map());
    const { data, error } = await this.cliente.from('conceptos').select('id, nombre, icono').in('id', [...ids]);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(new Map((data ?? []).map((k) => [k.id, { nombre: k.nombre, icono: k.icono }])));
  }

  /**
   * Nombre de quien registró. Si la RLS no deja ver un perfil, la fila no
   * llega y ese nombre queda vacío; un error real de la consulta sí se avisa.
   */
  private async quienes(ids: readonly string[]): Promise<Resultado<ReadonlyMap<string, string>>> {
    if (ids.length === 0) return exito(new Map());
    const { data, error } = await this.cliente.from('perfiles').select('id, nombres, apellidos').in('id', [...ids]);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(new Map((data ?? []).map((p) => [p.id, `${p.nombres} ${p.apellidos}`.trim()])));
  }
}
