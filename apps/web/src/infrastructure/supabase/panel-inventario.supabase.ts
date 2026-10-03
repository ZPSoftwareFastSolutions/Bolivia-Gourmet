/**
 * CAPA: Infrastructure / Supabase
 *
 * Inventario del panel con el cliente de ESTA petición: lee `v_existencias`
 * (y `v_existencias_valorizadas` si se piden costos), `v_lotes_vigentes` y
 * `v_kardex` bajo RLS; escribe solo por RPC (registrar_compra, usar_insumos,
 * dar_de_baja, registrar_conteo, registrar_saldo_inicial, anular) salvo la
 * edición del catálogo, que la RLS permite por columnas.
 *
 * Las cantidades llegan de PostgreSQL como `numeric` (número JSON con hasta
 * 3 decimales) y se guardan en milésimas enteras; hacia la base viajan como
 * texto con punto («2.5»), que es lo que lee `app.leer_cantidad`.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IconoDeArticulo, TipoDeArticulo } from '@core/domain/inventario/articulo';
import type { DestinoDeUso, MotivoDeBaja, TipoDeMovimiento } from '@core/domain/inventario/movimiento';
import type { Milesimas, Unidad } from '@core/domain/shared/cantidad';
import { exito, fallo, type Centavos, type FechaISO, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type {
  AlumnoSinUniforme,
  ArticuloConExistencias,
  CambiosDeArticulo,
  ContextoDeEntrega,
  DatosDeArticuloNuevo,
  DatosDeBaja,
  DatosDeCompra,
  DatosDeDevolucion,
  DatosDeEntrega,
  DatosDePrestamo,
  DatosDeUso,
  DocumentoAnulable,
  EntregaDeUniforme,
  EntregaHecha,
  EstadoDeExistencia,
  EstadoDeLote,
  ExistenciaEnSede,
  FichaDeArticulo,
  FiltroDeExistencias,
  FiltroDeKardex,
  GrupoParaUso,
  InventarioPort,
  LineaContada,
  LineaDeSaldoInicial,
  LineaRecibida,
  LoteVigente,
  MovimientoEnKardex,
  PrestamoAbierto,
  VarianteConExistencias,
} from '@core/application/ports/inventario.port';
import { traducirErrorDePanel } from './errores-del-panel';
import { cantidadParaLaBase, milesimasDe } from './cantidades';
import { argsDe, comoObjeto, numero, texto } from './rpc';
import type { Database, Json } from './tipos-de-base.generados';

const LIMITE_DE_KARDEX = 100;

type FilaDeExistencia = Database['public']['Views']['v_existencias']['Row'];
type FilaDeLote = Database['public']['Views']['v_lotes_vigentes']['Row'];
type FilaDeKardex = Database['public']['Views']['v_kardex_valorizado']['Row'];

const COLUMNAS_DE_EXISTENCIA =
  'articulo_id, codigo, nombre, tipo, valuacion, icono, categoria, unidad, controla_vencimiento, stock_minimo, precio_venta, activo, ' +
  'variante_id, etiqueta, orden, sede_id, sede_nombre, disponible, prestado, total, vencido, proximo_vencimiento, estado';

const COLUMNAS_DE_KARDEX =
  'id, numero, operacion_id, variante_id, articulo_id, articulo_nombre, unidad, etiqueta, sede_id, sede_nombre, tipo, fecha, registrado_en, ' +
  'entra, sale, delta_disponible, disponible_resultante, prestado_resultante, destino, motivo_baja, detalle, grupo_nombre, compra_id, ' +
  'prestamo_id, anula_a, anulado, registrado_por_nombre';

/** Agrupa las filas (una por variante y sede) en artículos con sus variantes. */
function agrupar(filas: readonly FilaDeExistencia[], valores: ReadonlyMap<string, number>): ArticuloConExistencias[] {
  const articulos = new Map<string, { base: Omit<ArticuloConExistencias, 'variantes'>; variantes: Map<string, { v: Omit<VarianteConExistencias, 'sedes'>; sedes: ExistenciaEnSede[] }> }>();
  for (const f of filas) {
    const articuloId = f.articulo_id ?? '';
    let a = articulos.get(articuloId);
    if (!a) {
      a = {
        base: {
          id: articuloId as Id,
          codigo: f.codigo ?? '',
          nombre: f.nombre ?? '',
          tipo: (f.tipo ?? 'otro') as TipoDeArticulo,
          valuacion: f.valuacion === 'peps' ? 'peps' : 'promedio',
          icono: (f.icono ?? 'almacen') as IconoDeArticulo,
          categoria: f.categoria,
          unidad: (f.unidad ?? 'unidad') as Unidad,
          controlaVencimiento: f.controla_vencimiento === true,
          stockMinimo: milesimasDe(f.stock_minimo),
          precioVenta: f.precio_venta === null ? null : (f.precio_venta as Centavos),
          activo: f.activo !== false,
        },
        variantes: new Map(),
      };
      articulos.set(articuloId, a);
    }
    const varianteId = f.variante_id ?? '';
    let v = a.variantes.get(varianteId);
    if (!v) {
      v = { v: { id: varianteId as Id, etiqueta: f.etiqueta ?? '', orden: f.orden ?? 0 }, sedes: [] };
      a.variantes.set(varianteId, v);
    }
    const clave = `${varianteId}|${f.sede_id ?? ''}`;
    v.sedes.push({
      sedeId: (f.sede_id ?? '') as Id,
      sedeNombre: f.sede_nombre ?? '',
      disponible: milesimasDe(f.disponible),
      prestado: milesimasDe(f.prestado),
      total: milesimasDe(f.total),
      vencido: milesimasDe(f.vencido),
      proximoVencimiento: (f.proximo_vencimiento ?? null) as FechaISO | null,
      estado: (f.estado ?? 'bien') as EstadoDeExistencia,
      valor: valores.size > 0 ? ((valores.get(clave) ?? 0) as Centavos) : null,
    });
  }
  return [...articulos.values()].map((a) => ({
    ...a.base,
    variantes: [...a.variantes.values()]
      .map((v) => ({ ...v.v, sedes: v.sedes.sort((x, y) => x.sedeNombre.localeCompare(y.sedeNombre, 'es')) }))
      .sort((x, y) => x.orden - y.orden),
  }));
}

function lote(f: FilaDeLote): LoteVigente {
  return {
    id: (f.id ?? '') as Id,
    varianteId: (f.variante_id ?? '') as Id,
    articuloId: (f.articulo_id ?? '') as Id,
    articuloNombre: f.articulo_nombre ?? '',
    unidad: (f.unidad ?? 'unidad') as Unidad,
    sedeId: (f.sede_id ?? '') as Id,
    sedeNombre: f.sede_nombre ?? '',
    origen: (f.origen ?? 'compra') as LoteVigente['origen'],
    fechaIngreso: (f.fecha_ingreso ?? '') as FechaISO,
    venceEl: (f.vence_el ?? null) as FechaISO | null,
    cantidadInicial: milesimasDe(f.cantidad_inicial),
    cantidadRestante: milesimasDe(f.cantidad_restante),
    diasParaVencer: f.dias_para_vencer,
    estado: (f.estado ?? 'sin_vencimiento') as EstadoDeLote,
  };
}

function movimiento(f: Partial<FilaDeKardex>): MovimientoEnKardex {
  return {
    id: (f.id ?? '') as Id,
    numero: f.numero ?? 0,
    operacionId: (f.operacion_id ?? '') as Id,
    varianteId: (f.variante_id ?? '') as Id,
    articuloId: (f.articulo_id ?? '') as Id,
    articuloNombre: f.articulo_nombre ?? '',
    unidad: (f.unidad ?? 'unidad') as Unidad,
    etiqueta: f.etiqueta ?? '',
    sedeId: (f.sede_id ?? '') as Id,
    sedeNombre: f.sede_nombre ?? '',
    tipo: (f.tipo ?? 'compra') as TipoDeMovimiento,
    fecha: (f.fecha ?? '') as FechaISO,
    registradoEn: f.registrado_en ?? '',
    entra: milesimasDe(f.entra),
    sale: milesimasDe(f.sale),
    deltaDisponible: milesimasDe(f.delta_disponible),
    disponibleResultante: milesimasDe(f.disponible_resultante),
    prestadoResultante: milesimasDe(f.prestado_resultante),
    destino: (f.destino ?? null) as DestinoDeUso | null,
    motivoBaja: (f.motivo_baja ?? null) as MotivoDeBaja | null,
    detalle: f.detalle ?? null,
    grupoNombre: f.grupo_nombre ?? null,
    compraId: (f.compra_id ?? null) as Id | null,
    prestamoId: (f.prestamo_id ?? null) as Id | null,
    anulaA: (f.anula_a ?? null) as Id | null,
    anulado: f.anulado === true,
    quien: f.registrado_por_nombre ?? '',
    deltaValor: f.delta_valor === undefined || f.delta_valor === null ? null : (f.delta_valor as Centavos),
    valorResultante: f.valor_resultante === undefined || f.valor_resultante === null ? null : (f.valor_resultante as Centavos),
  };
}

export class PanelInventarioSupabase implements InventarioPort {
  private readonly cliente: SupabaseClient<Database>;

  constructor(cliente: SupabaseClient<Database>) {
    this.cliente = cliente;
  }

  // ---------------------------------------------------------------- lecturas

  private async valores(articuloId?: string): Promise<Resultado<ReadonlyMap<string, number>>> {
    let consulta = this.cliente.from('v_existencias_valorizadas').select('variante_id, sede_id, valor');
    if (articuloId) consulta = consulta.eq('articulo_id', articuloId);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(new Map((data ?? []).map((f) => [`${f.variante_id ?? ''}|${f.sede_id ?? ''}`, f.valor ?? 0])));
  }

  async existencias(filtro: FiltroDeExistencias): Promise<Resultado<readonly ArticuloConExistencias[]>> {
    let consulta = this.cliente.from('v_existencias').select(COLUMNAS_DE_EXISTENCIA).order('nombre').order('orden');
    if (filtro.tipo) consulta = consulta.eq('tipo', filtro.tipo);
    if (filtro.tipos && filtro.tipos.length > 0) consulta = consulta.in('tipo', [...filtro.tipos]);
    if (!filtro.incluirInactivos) consulta = consulta.eq('activo', true);
    const [filas, valores] = await Promise.all([consulta.returns<FilaDeExistencia[]>(), filtro.conValor ? this.valores() : Promise.resolve(exito(new Map()))]);
    if (filas.error) return fallo(traducirErrorDePanel(filas.error));
    if (!valores.exito) return valores;
    return exito(agrupar(filas.data ?? [], valores.valor));
  }

  async fichaDeArticulo(codigo: string, conValor: boolean): Promise<Resultado<FichaDeArticulo | null>> {
    const filas = await this.cliente.from('v_existencias').select(COLUMNAS_DE_EXISTENCIA).eq('codigo', codigo).order('orden').returns<FilaDeExistencia[]>();
    if (filas.error) return fallo(traducirErrorDePanel(filas.error));
    const articuloId = filas.data?.[0]?.articulo_id;
    if (!articuloId) {
      // Un artículo inactivo sin variantes activas no aparece en la vista.
      return exito(null);
    }
    const [valores, lotes] = await Promise.all([
      conValor ? this.valores(articuloId) : Promise.resolve(exito(new Map<string, number>())),
      this.cliente.from('v_lotes_vigentes').select('*').eq('articulo_id', articuloId).order('fecha_ingreso').order('secuencia'),
    ]);
    if (!valores.exito) return valores;
    if (lotes.error) return fallo(traducirErrorDePanel(lotes.error));
    const [articulo] = agrupar(filas.data ?? [], valores.valor);
    if (!articulo) return exito(null);
    return exito({ ...articulo, lotes: (lotes.data ?? []).map(lote) });
  }

  async lotesConAlerta(sedeId?: Id): Promise<Resultado<readonly LoteVigente[]>> {
    let consulta = this.cliente.from('v_lotes_vigentes').select('*').in('estado', ['vencido', 'por_vencer']).order('vence_el').limit(50);
    if (sedeId) consulta = consulta.eq('sede_id', sedeId);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito((data ?? []).map(lote));
  }

  async kardex(filtro: FiltroDeKardex): Promise<Resultado<readonly MovimientoEnKardex[]>> {
    const vista = filtro.conValor ? 'v_kardex_valorizado' : 'v_kardex';
    const columnas = filtro.conValor ? `${COLUMNAS_DE_KARDEX}, delta_valor, valor_resultante` : COLUMNAS_DE_KARDEX;
    let consulta = this.cliente.from(vista).select(columnas).order('numero', { ascending: false }).limit(filtro.limite ?? LIMITE_DE_KARDEX);
    if (filtro.articuloId) consulta = consulta.eq('articulo_id', filtro.articuloId);
    if (filtro.sedeId) consulta = consulta.eq('sede_id', filtro.sedeId);
    if (filtro.operacionId) consulta = consulta.eq('operacion_id', filtro.operacionId);
    if (filtro.compraId) consulta = consulta.eq('compra_id', filtro.compraId);
    if (filtro.movimientoId) consulta = consulta.eq('id', filtro.movimientoId);
    const { data, error } = await consulta.returns<Partial<FilaDeKardex>[]>();
    if (error) return fallo(traducirErrorDePanel(error));
    return exito((data ?? []).map(movimiento));
  }

  async gruposParaUso(sedeId: Id): Promise<Resultado<readonly GrupoParaUso[]>> {
    const { data, error } = await this.cliente
      .from('v_grupos')
      .select('id, nombre')
      .eq('sede_id', sedeId)
      .in('estado', ['abierto', 'en_curso'])
      .order('fecha_inicio');
    if (error) return fallo(traducirErrorDePanel(error));
    return exito((data ?? []).map((g) => ({ id: (g.id ?? '') as Id, nombre: g.nombre ?? '' })));
  }

  async variantesConMovimientos(sedeId: Id): Promise<Resultado<ReadonlySet<Id>>> {
    const { data, error } = await this.cliente.from('movimientos').select('variante_id').eq('sede_id', sedeId).limit(10000);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(new Set((data ?? []).map((f) => f.variante_id as Id)));
  }

  // ---------------------------------------------------------------- catálogo

  async guardarArticulo(clave: string, datos: DatosDeArticuloNuevo, variantes: readonly string[]): Promise<Resultado<{ readonly codigo: string }>> {
    const { data, error } = await this.cliente.rpc(
      'guardar_articulo',
      argsDe<'guardar_articulo'>({
        p_clave: clave,
        p_datos: {
          nombre: datos.nombre,
          tipo: datos.tipo,
          unidad: datos.unidad,
          categoria: datos.categoria ?? '',
          icono: datos.icono,
          controla_vencimiento: String(datos.controlaVencimiento),
          stock_minimo: cantidadParaLaBase(datos.stockMinimo),
          precio_venta: datos.precioVenta === undefined ? '' : String(datos.precioVenta),
        },
        p_variantes: datos.tipo === 'uniforme' ? [...variantes] : null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ codigo: texto(comoObjeto(data).codigo) });
  }

  async editarArticulo(id: Id, cambios: CambiosDeArticulo): Promise<Resultado<void>> {
    const { error } = await this.cliente
      .from('articulos')
      .update({
        nombre: cambios.nombre,
        categoria: cambios.categoria ?? null,
        icono: cambios.icono,
        stock_minimo: Number(cantidadParaLaBase(cambios.stockMinimo)),
        controla_vencimiento: cambios.controlaVencimiento,
        precio_venta: cambios.precioVenta ?? null,
        activo: cambios.activo,
      })
      .eq('id', id);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async agregarVariante(articuloId: Id, etiqueta: string, orden: number): Promise<Resultado<void>> {
    const { error } = await this.cliente.from('variantes').insert({ articulo_id: articuloId, etiqueta, orden });
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  // ---------------------------------------------------------------- operaciones

  async registrarSaldoInicial(clave: string, sedeId: Id, lineas: readonly LineaDeSaldoInicial[]): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc('registrar_saldo_inicial', {
      p_clave: clave,
      p_sede: sedeId,
      p_lineas: lineas.map((l) => ({ variante: l.varianteId, cantidad: cantidadParaLaBase(l.cantidad), valor: String(l.valor), vence_el: l.venceEl ?? '' })) as Json,
    });
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async registrarCompra(clave: string, datos: DatosDeCompra): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc(
      'registrar_compra',
      argsDe<'registrar_compra'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_fecha_documento: datos.fechaDocumento ?? null,
        p_proveedor: datos.proveedor ?? null,
        p_comprobante: datos.comprobante,
        p_numero_comprobante: datos.numeroComprobante ?? null,
        p_medio: datos.medio,
        p_referencia: datos.referencia ?? null,
        p_lineas: datos.lineas.map((l) => ({
          variante: l.varianteId,
          cantidad: cantidadParaLaBase(l.cantidad),
          costo_total: String(l.costoTotal),
          vence_el: l.venceEl ?? '',
        })) as Json,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async usarInsumos(clave: string, datos: DatosDeUso): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc(
      'usar_insumos',
      argsDe<'usar_insumos'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_destino: datos.destino,
        p_cohorte: datos.grupoId ?? null,
        p_detalle: datos.detalle ?? null,
        p_lineas: datos.lineas.map((l) => ({ variante: l.varianteId, cantidad: cantidadParaLaBase(l.cantidad) })) as Json,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async darDeBaja(clave: string, datos: DatosDeBaja): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc(
      'dar_de_baja',
      argsDe<'dar_de_baja'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_variante: datos.varianteId,
        p_cantidad: cantidadParaLaBase(datos.cantidad),
        p_motivo_baja: datos.motivo,
        p_detalle: datos.detalle ?? null,
        p_lote: datos.loteId ?? null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async registrarConteo(clave: string, sedeId: Id, lineas: readonly LineaContada[]): Promise<Resultado<{ readonly diferencias: number }>> {
    const { data, error } = await this.cliente.rpc('registrar_conteo', {
      p_clave: clave,
      p_sede: sedeId,
      p_lineas: lineas.map((l) => ({
        variante: l.varianteId,
        existencia_vista: cantidadParaLaBase(l.existenciaVista),
        contado: cantidadParaLaBase(l.contado),
        motivo: l.motivo ?? '',
        valor: l.valor === undefined ? '' : String(l.valor),
        vence_el: l.venceEl ?? '',
      })) as Json,
    });
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ diferencias: numero(comoObjeto(data).diferencias) });
  }

  async anular(clave: string, tipo: DocumentoAnulable, id: Id, motivo: string): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc('anular', { p_clave: clave, p_tipo: tipo, p_id: id, p_motivo: motivo });
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  // ---------------------------------------------------------------- uniformes y préstamos (R5)

  async entregas(estudianteId: Id): Promise<Resultado<readonly EntregaDeUniforme[]>> {
    const { data, error } = await this.cliente.from('v_entregas').select('*').eq('estudiante_id', estudianteId).order('numero', { ascending: false });
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((f) => ({
        id: (f.id ?? '') as Id,
        numero: f.numero ?? 0,
        inscripcionId: (f.inscripcion_id ?? '') as Id,
        estudianteId: (f.estudiante_id ?? '') as Id,
        sedeId: (f.sede_id ?? '') as Id,
        sedeNombre: f.sede_nombre ?? '',
        varianteId: (f.variante_id ?? '') as Id,
        articuloId: (f.articulo_id ?? '') as Id,
        articuloCodigo: f.articulo_codigo ?? '',
        articuloNombre: f.articulo_nombre ?? '',
        etiqueta: f.etiqueta ?? '',
        cantidad: f.cantidad ?? 0,
        devuelta: f.devuelta ?? 0,
        enPoder: f.en_poder ?? 0,
        contexto: (f.contexto ?? 'inscripcion') as ContextoDeEntrega,
        detalle: f.detalle,
        fecha: (f.fecha ?? '') as FechaISO,
      })),
    );
  }

  async prestamosAbiertos(filtro: { readonly sedeId?: Id; readonly estudianteId?: Id }): Promise<Resultado<readonly PrestamoAbierto[]>> {
    let consulta = this.cliente.from('v_prestamos_abiertos').select('*').order('devolver_el').order('numero');
    if (filtro.sedeId) consulta = consulta.eq('sede_id', filtro.sedeId);
    if (filtro.estudianteId) consulta = consulta.eq('estudiante_id', filtro.estudianteId);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((f) => ({
        id: (f.id ?? '') as Id,
        numero: f.numero ?? 0,
        operacionId: (f.operacion_id ?? '') as Id,
        sedeId: (f.sede_id ?? '') as Id,
        sedeNombre: f.sede_nombre ?? '',
        varianteId: (f.variante_id ?? '') as Id,
        articuloCodigo: f.articulo_codigo ?? '',
        articuloNombre: f.articulo_nombre ?? '',
        icono: (f.icono ?? 'cubiertos') as IconoDeArticulo,
        cantidad: f.cantidad ?? 0,
        devuelta: f.devuelta ?? 0,
        perdida: f.perdida ?? 0,
        pendiente: f.pendiente ?? 0,
        estudianteId: (f.estudiante_id ?? null) as Id | null,
        estudianteCodigo: f.estudiante_codigo,
        telefono: f.estudiante_telefono,
        grupoNombre: f.grupo_nombre,
        persona: f.persona,
        destinatario: f.destinatario ?? '',
        fecha: (f.fecha ?? '') as FechaISO,
        devolverEl: (f.devolver_el ?? '') as FechaISO,
        diasDeAtraso: f.dias_de_atraso ?? 0,
        atrasado: f.atrasado === true,
      })),
    );
  }

  async sinUniforme(sedeId?: Id): Promise<Resultado<readonly AlumnoSinUniforme[]>> {
    let consulta = this.cliente.from('v_sin_uniforme').select('*').order('inscrito_el');
    if (sedeId) consulta = consulta.eq('sede_id', sedeId);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((f) => ({
        inscripcionId: (f.inscripcion_id ?? '') as Id,
        estudianteId: (f.estudiante_id ?? '') as Id,
        codigo: f.codigo ?? '',
        nombres: f.nombres ?? '',
        apellidos: f.apellidos ?? '',
        telefono: f.telefono,
        sedeId: (f.sede_id ?? '') as Id,
        sedeNombre: f.sede_nombre ?? '',
        grupoNombre: f.grupo_nombre ?? '',
        inscritoEl: (f.inscrito_el ?? '') as FechaISO,
      })),
    );
  }

  async entregarUniforme(clave: string, datos: DatosDeEntrega): Promise<Resultado<EntregaHecha>> {
    const { data, error } = await this.cliente.rpc(
      'entregar_uniforme',
      argsDe<'entregar_uniforme'>({
        p_clave: clave,
        p_inscripcion: datos.inscripcionId,
        p_sede: datos.sedeId,
        p_contexto: datos.contexto,
        p_detalle: datos.detalle ?? null,
        p_lineas: datos.lineas.map((l) => ({ variante: l.varianteId, cantidad: String(l.cantidad) })) as Json,
        p_cargar: datos.cargar,
        p_cobro: datos.cobro ? ({ medio: datos.cobro.medio, referencia: datos.cobro.referencia ?? '' } as Json) : null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({
      codigo: texto(r.codigo),
      cargado: numero(r.cargado) as Centavos,
      pagoId: typeof r.pago === 'string' ? (r.pago as Id) : null,
      recibo: typeof r.recibo === 'string' ? r.recibo : null,
    });
  }

  async devolverUniforme(clave: string, datos: DatosDeDevolucion): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc(
      'devolver_uniforme',
      argsDe<'devolver_uniforme'>({
        p_clave: clave,
        p_entrega: datos.entregaId,
        p_cantidad: String(datos.cantidad),
        p_motivo: datos.motivo,
        p_cambiar_por: datos.cambiarPor ?? null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async prestarUtensilios(clave: string, datos: DatosDePrestamo): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc(
      'prestar_utensilios',
      argsDe<'prestar_utensilios'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_estudiante: datos.estudianteId ?? null,
        p_cohorte: datos.grupoId ?? null,
        p_persona: datos.persona ?? null,
        p_devolver_el: datos.devolverEl ?? null,
        p_lineas: datos.lineas.map((l) => ({ variante: l.varianteId, cantidad: String(l.cantidad) })) as Json,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(undefined);
  }

  async recibirDevolucion(clave: string, lineas: readonly LineaRecibida[]): Promise<Resultado<{ readonly perdidos: number }>> {
    const { data, error } = await this.cliente.rpc('recibir_devolucion', {
      p_clave: clave,
      p_lineas: lineas.map((l) => ({
        prestamo: l.prestamoId,
        devueltos: String(l.devueltos),
        perdidos: String(l.perdidos),
        motivo_baja: l.motivoBaja ?? 'perdida',
        motivo: l.motivo ?? '',
      })) as Json,
    });
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ perdidos: numero(comoObjeto(data).perdidos) });
  }
}
