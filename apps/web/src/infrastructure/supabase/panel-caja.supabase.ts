/**
 * CAPA: Infrastructure / Supabase
 *
 * Caja del panel con el cliente de ESTA petición: lee `v_saldos_de_cargo`,
 * `v_saldos_de_alumno`, cobros y arqueos bajo RLS, y escribe solo por RPC
 * (registrar_cobro, cerrar_caja, anular…). Traduce los errores a frases.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoDeCargo, OrigenDeCargo } from '@core/domain/caja/cargo';
import { formatearRecibo, type MedioDePago } from '@core/domain/caja/cobro';
import { exito, fallo, type Centavos, type FechaISO, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type {
  Arqueo,
  CajaPorCerrar,
  CajaPort,
  CargoDeCuenta,
  CierreHecho,
  CobroHecho,
  ConceptoDeCaja,
  CuentaDeAlumno,
  DatosDeCargoManual,
  DatosDeCierre,
  DatosDeCobroNuevo,
  DatosDeGasto,
  Deudor,
  DigitalPorArquear,
  FiltroDeDeudores,
  Recibo,
  ReciboEnLista,
  SalidaPorArquear,
  TipoAnulable,
} from '@core/application/ports/caja.port';
import { TOPE_DE_DEUDORES } from '@core/application/ports/caja.port';
import { traducirErrorDePanel } from './errores-del-panel';
import { argsDe, comoObjeto, numero, texto, textoDeBusqueda } from './rpc';
import type { Database, Json } from './tipos-de-base.generados';

/** Tope de recibos y arqueos. El de `deudores` es `TOPE_DE_DEUDORES` del puerto: su pantalla avisa del corte. */
const LIMITE = 100;

export class PanelCajaSupabase implements CajaPort {
  private readonly cliente: SupabaseClient<Database>;

  constructor(cliente: SupabaseClient<Database>) {
    this.cliente = cliente;
  }

  async cuentaDeAlumno(estudianteId: Id): Promise<Resultado<CuentaDeAlumno | null>> {
    const [alumno, cargos] = await Promise.all([
      this.cliente.from('estudiantes').select('id, codigo, nombres, apellidos, telefono, sede_id').eq('id', estudianteId).maybeSingle(),
      this.cliente
        .from('v_saldos_de_cargo')
        .select('id, descripcion, concepto_nombre, origen, monto, aplicado, pendiente, estado, vence_el, vencido, dias_de_atraso')
        .eq('estudiante_id', estudianteId)
        .neq('estado', 'anulado')
        .order('vence_el')
        .order('registrado_en'),
    ]);
    const error = alumno.error ?? cargos.error;
    if (error) return fallo(traducirErrorDePanel(error));
    if (!alumno.data) return exito(null);
    const lista: CargoDeCuenta[] = (cargos.data ?? []).map((c) => ({
      id: (c.id ?? '') as Id,
      descripcion: c.descripcion ?? '',
      conceptoNombre: c.concepto_nombre ?? '',
      origen: (c.origen ?? 'manual') as OrigenDeCargo,
      monto: (c.monto ?? 0) as Centavos,
      aplicado: (c.aplicado ?? 0) as Centavos,
      pendiente: (c.pendiente ?? 0) as Centavos,
      estado: (c.estado ?? 'pendiente') as EstadoDeCargo,
      venceEl: (c.vence_el ?? '') as FechaISO,
      vencido: c.vencido === true,
      diasDeAtraso: c.dias_de_atraso ?? 0,
    }));
    return exito({
      estudianteId: alumno.data.id as Id,
      codigo: alumno.data.codigo,
      nombres: alumno.data.nombres,
      apellidos: alumno.data.apellidos,
      telefono: alumno.data.telefono,
      sedeId: alumno.data.sede_id as Id,
      totalPendiente: lista.reduce((t, c) => t + c.pendiente, 0) as Centavos,
      totalVencido: lista.filter((c) => c.vencido).reduce((t, c) => t + c.pendiente, 0) as Centavos,
      cargos: lista,
    });
  }

  async deudores(filtro: FiltroDeDeudores): Promise<Resultado<readonly Deudor[]>> {
    let consulta = this.cliente
      .from('v_saldos_de_alumno')
      .select('*')
      .order('total_vencido', { ascending: false })
      .order('total_pendiente', { ascending: false })
      .limit(TOPE_DE_DEUDORES);
    if (filtro.soloVencidos) consulta = consulta.gt('total_vencido', 0);
    if (filtro.sedeId) consulta = consulta.eq('sede_id', filtro.sedeId);
    const q = textoDeBusqueda(filtro.texto ?? '');
    if (q) consulta = consulta.or(`codigo.ilike.%${q.toUpperCase().replace(/ /g, '')}%,apellidos.ilike.%${q.replace(/ /g, '%')}%,nombres.ilike.%${q.replace(/ /g, '%')}%`);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((d) => ({
        estudianteId: (d.estudiante_id ?? '') as Id,
        codigo: d.codigo ?? '',
        nombres: d.nombres ?? '',
        apellidos: d.apellidos ?? '',
        telefono: d.telefono,
        sedeNombre: d.sede_nombre ?? '',
        totalPendiente: (d.total_pendiente ?? 0) as Centavos,
        totalVencido: (d.total_vencido ?? 0) as Centavos,
        cargosPendientes: d.cargos_pendientes ?? 0,
        diasDeAtraso: d.dias_de_atraso ?? 0,
      })),
    );
  }

  async registrarCobro(clave: string, datos: DatosDeCobroNuevo): Promise<Resultado<CobroHecho>> {
    const { data, error } = await this.cliente.rpc(
      'registrar_cobro',
      argsDe<'registrar_cobro'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_estudiante: datos.estudianteId ?? null,
        p_medio: datos.medio,
        p_referencia: datos.referencia ?? null,
        p_aplicaciones: datos.aplicaciones ? (datos.aplicaciones.map((a) => ({ cargo: a.cargoId, monto: a.monto })) as Json) : null,
        p_monto: datos.monto ?? null,
        p_venta: datos.venta
          ? ({ concepto: datos.venta.conceptoCodigo, descripcion: datos.venta.descripcion, monto: String(datos.venta.monto), cliente: datos.venta.cliente ?? null } as Json)
          : null,
        p_nota: datos.nota ?? null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({
      pagoId: texto(r.pago) as Id,
      recibo: texto(r.recibo),
      monto: numero(r.monto) as Centavos,
      saldoPendiente: numero(r.saldo_pendiente) as Centavos,
      codigo: texto(r.codigo) || null,
      repetida: r.repetida === true,
    });
  }

  async recibo(id: Id): Promise<Resultado<Recibo | null>> {
    const { data: p, error } = await this.cliente
      .from('pagos')
      .select(
        'id, sede_id, fecha, anio, numero, cliente, monto, medio, referencia, nota, registrado_en, anulado_el, anulacion_motivo, sedes(codigo, nombre), estudiantes(id, codigo, nombres, apellidos), cobrador:perfiles!pagos_registrado_por_fkey(nombres, apellidos), anulador:perfiles!pagos_anulado_por_fkey(nombres)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) return fallo(traducirErrorDePanel(error));
    if (!p) return exito(null);
    const { data: lineas, error: errorLineas } = await this.cliente.from('pago_aplicaciones').select('monto, cargos(descripcion)').eq('pago_id', id);
    if (errorLineas) return fallo(traducirErrorDePanel(errorLineas));
    return exito({
      id: p.id as Id,
      numero: formatearRecibo(p.sedes?.codigo ?? '', p.anio, p.numero),
      sedeId: p.sede_id as Id,
      sedeNombre: p.sedes?.nombre ?? '',
      fecha: p.fecha as FechaISO,
      registradoEn: p.registrado_en,
      alumno: p.estudiantes ? { id: p.estudiantes.id as Id, codigo: p.estudiantes.codigo, nombre: `${p.estudiantes.nombres} ${p.estudiantes.apellidos}` } : null,
      cliente: p.cliente,
      monto: p.monto as Centavos,
      medio: p.medio as MedioDePago,
      referencia: p.referencia,
      nota: p.nota,
      cobradoPor: p.cobrador ? `${p.cobrador.nombres} ${p.cobrador.apellidos}`.trim() : '',
      lineas: (lineas ?? []).map((l) => ({ descripcion: l.cargos?.descripcion ?? '', monto: l.monto as Centavos })),
      anulacion: p.anulado_el ? { el: p.anulado_el as FechaISO, motivo: p.anulacion_motivo ?? '', por: p.anulador?.nombres ?? '' } : null,
    });
  }

  async recibos(sedeId?: Id): Promise<Resultado<readonly ReciboEnLista[]>> {
    let consulta = this.cliente
      .from('pagos')
      .select('id, anio, numero, registrado_en, cliente, monto, medio, anulado_en, sedes(codigo, nombre), estudiantes(nombres, apellidos)')
      .order('registrado_en', { ascending: false })
      .limit(LIMITE);
    if (sedeId) consulta = consulta.eq('sede_id', sedeId);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((p) => ({
        id: p.id as Id,
        numero: formatearRecibo(p.sedes?.codigo ?? '', p.anio, p.numero),
        registradoEn: p.registrado_en,
        quien: p.estudiantes ? `${p.estudiantes.nombres} ${p.estudiantes.apellidos}` : (p.cliente ?? ''),
        monto: p.monto as Centavos,
        medio: p.medio as MedioDePago,
        anulado: p.anulado_en !== null,
        sedeNombre: p.sedes?.nombre ?? '',
      })),
    );
  }

  async cajaPorCerrar(sedeId: Id): Promise<Resultado<CajaPorCerrar>> {
    const { data, error } = await this.cliente.rpc('caja_por_cerrar', { p_sede: sedeId });
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    const lista = (v: unknown) => (Array.isArray(v) ? v.map(comoObjeto) : []);
    return exito({
      primerArqueo: r.primer_arqueo === true,
      saldoInicial: numero(r.saldo_inicial) as Centavos,
      entradasEfectivo: numero(r.entradas_efectivo) as Centavos,
      salidasEfectivo: numero(r.salidas_efectivo) as Centavos,
      esperado: numero(r.esperado) as Centavos,
      cobrosQr: numero(r.cobros_qr) as Centavos,
      cobrosTransferencia: numero(r.cobros_transferencia) as Centavos,
      registros: numero(r.registros),
      ultimoCierreEn: texto(r.ultimo_cierre_en) || null,
      salidas: lista(r.salidas).map(
        (s): SalidaPorArquear => ({
          quien: texto(s.quien),
          cuando: texto(s.cuando),
          monto: numero(s.monto) as Centavos,
          clase: s.clase === 'cobro_anulado' ? 'cobro_anulado' : 'salida',
        }),
      ),
      digitales: lista(r.digitales).map(
        (d): DigitalPorArquear => ({
          recibo: texto(d.recibo),
          medio: (texto(d.medio) || 'qr') as MedioDePago,
          referencia: texto(d.referencia) || null,
          monto: numero(d.monto) as Centavos,
        }),
      ),
    });
  }

  async cerrarCaja(clave: string, datos: DatosDeCierre): Promise<Resultado<CierreHecho>> {
    const { data, error } = await this.cliente.rpc(
      'cerrar_caja',
      argsDe<'cerrar_caja'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_contado: datos.contado,
        p_retiro: datos.retiro,
        p_observacion: datos.observacion ?? null,
        p_saldo_inicial: datos.saldoInicial ?? null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({
      numero: numero(r.numero),
      esperado: numero(r.esperado) as Centavos,
      contado: numero(r.contado) as Centavos,
      diferencia: numero(r.diferencia) as Centavos,
      queda: numero(r.queda) as Centavos,
    });
  }

  async arqueos(sedeId?: Id): Promise<Resultado<readonly Arqueo[]>> {
    let consulta = this.cliente
      .from('cierres_de_caja')
      .select(
        'id, numero, cerrado_en, saldo_inicial, esperado, contado, diferencia, retiro, queda, cobros_qr, cobros_transferencia, observacion, revisado_en, revision_nota, sedes(nombre), perfiles!cierres_de_caja_cerrado_por_fkey(nombres), revisor:perfiles!cierres_de_caja_revisado_por_fkey(nombres)',
      )
      .order('cerrado_en', { ascending: false })
      .limit(LIMITE);
    if (sedeId) consulta = consulta.eq('sede_id', sedeId);
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((c) => ({
        id: c.id as Id,
        numero: c.numero,
        sedeNombre: c.sedes?.nombre ?? '',
        cerradoEn: c.cerrado_en,
        saldoInicial: c.saldo_inicial as Centavos,
        esperado: c.esperado as Centavos,
        contado: c.contado as Centavos,
        diferencia: (c.diferencia ?? 0) as Centavos,
        retiro: c.retiro as Centavos,
        queda: (c.queda ?? 0) as Centavos,
        cobrosQr: c.cobros_qr as Centavos,
        cobrosTransferencia: c.cobros_transferencia as Centavos,
        cerradoPor: c.perfiles?.nombres ?? '',
        observacion: c.observacion,
        revision: c.revisado_en && c.revision_nota ? { en: c.revisado_en, por: c.revisor?.nombres ?? '', nota: c.revision_nota } : null,
      })),
    );
  }

  async revisarArqueo(clave: string, cierreId: Id, nota: string): Promise<Resultado<{ readonly numero: number }>> {
    const { data, error } = await this.cliente.rpc('revisar_arqueo', argsDe<'revisar_arqueo'>({ p_clave: clave, p_cierre: cierreId, p_nota: nota }));
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ numero: numero(comoObjeto(data).numero) });
  }

  async anular(clave: string, tipo: TipoAnulable, id: Id, motivo: string): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc('anular', { p_clave: clave, p_tipo: tipo, p_id: id, p_motivo: motivo });
    return error ? fallo(traducirErrorDePanel(error)) : exito(undefined);
  }

  async crearCargo(clave: string, datos: DatosDeCargoManual): Promise<Resultado<void>> {
    const { error } = await this.cliente.rpc(
      'crear_cargo',
      argsDe<'crear_cargo'>({
        p_clave: clave,
        p_estudiante: datos.estudianteId,
        p_inscripcion: datos.inscripcionId ?? null,
        p_concepto: datos.conceptoId,
        p_descripcion: datos.descripcion,
        p_monto: datos.monto,
        p_vence_el: datos.venceEl ?? null,
        p_prestamo: null,
      }),
    );
    return error ? fallo(traducirErrorDePanel(error)) : exito(undefined);
  }

  async registrarGasto(clave: string, datos: DatosDeGasto): Promise<Resultado<{ readonly numero: number }>> {
    const { data, error } = await this.cliente.rpc(
      'registrar_gasto',
      argsDe<'registrar_gasto'>({
        p_clave: clave,
        p_sede: datos.sedeId,
        p_fecha: datos.fecha ?? null,
        p_concepto: datos.conceptoId,
        p_descripcion: datos.descripcion,
        p_monto: datos.monto,
        p_medio: datos.medio,
        p_referencia: datos.referencia ?? null,
        p_comprobante: datos.comprobante,
        p_numero_comprobante: datos.numeroComprobante ?? null,
        p_proveedor: datos.proveedor ?? null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ numero: numero(comoObjeto(data).numero) });
  }

  async conceptos(naturaleza: 'ingreso' | 'gasto'): Promise<Resultado<readonly ConceptoDeCaja[]>> {
    const { data, error } = await this.cliente
      .from('conceptos')
      .select('id, codigo, nombre, naturaleza, grupo, icono')
      .eq('naturaleza', naturaleza)
      .eq('activo', true)
      .order('grupo')
      .order('nombre');
    if (error) return fallo(traducirErrorDePanel(error));
    return exito((data ?? []).map((k) => ({ id: k.id as Id, codigo: k.codigo, nombre: k.nombre, naturaleza: k.naturaleza, grupo: k.grupo, icono: k.icono })));
  }

  async generarCuotasDeGrupo(clave: string, grupoId: Id): Promise<Resultado<{ readonly inscripciones: number; readonly cuotas: number }>> {
    const { data, error } = await this.cliente.rpc('generar_cuotas_de_grupo', { p_clave: clave, p_cohorte: grupoId });
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({ inscripciones: numero(r.inscripciones), cuotas: numero(r.cuotas) });
  }
}
