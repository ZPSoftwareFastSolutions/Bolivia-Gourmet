/**
 * CAPA: Infrastructure / Supabase
 *
 * Alumnos, grupos, inscripciones y bandeja de solicitudes del panel, con el
 * cliente de ESTA petición (cookie de quien pregunta, nunca service_role).
 * Lee las vistas `v_alumnos` y `v_grupos` (security_invoker) y escribe por
 * RPC o por las columnas que la base concede. No decide nada: la RLS, los
 * disparadores y los motores DEFINER deciden; aquí solo se traduce.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoDeCohorte, Modalidad, TipoDePrograma, Turno } from '@core/domain/academico/programa';
import type { EstadoDeInscripcion, Paquete } from '@core/domain/estudiantes/estudiante';
import { exito, fallo, type Centavos, type FechaISO, type Id, type Resultado } from '@core/domain/shared/tipos-base';
import type {
  AlumnoEnLista,
  AlumnosPort,
  CierreDeGrupo,
  DatosDeAprobacion,
  DatosDeFicha,
  DatosDeGrupo,
  DatosDeInscripcionNueva,
  DatosDePlan,
  EstadoDeSolicitudEnBandeja,
  FichaDeAlumno,
  FichaDeGrupo,
  FichaSugerida,
  FiltroDeAlumnos,
  FiltroDeGrupos,
  GrupoEnLista,
  InscripcionDeAlumno,
  InscripcionHecha,
  PrecioDeGrupo,
  SolicitudEnBandeja,
} from '@core/application/ports/alumnos.port';
import { traducirErrorDePanel } from './errores-del-panel';
import { argsDe, comoObjeto, numero, texto, textoDeBusqueda } from './rpc';
import type { Database, Json } from './tipos-de-base.generados';

type Fila<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];

const NO_GUARDADO = 'No pudimos guardar el cambio. Vuelve a abrir la página e inténtalo otra vez.';
const LIMITE_DE_LISTA = 100;

function grupoDesdeVista(f: Fila<'v_grupos'>, precios: readonly PrecioDeGrupo[] = []): GrupoEnLista {
  return {
    id: (f.id ?? '') as Id,
    programaCodigo: f.programa_codigo ?? '',
    programaNombre: f.programa_nombre ?? '',
    programaTipo: (f.programa_tipo ?? 'curso') as TipoDePrograma,
    sedeId: (f.sede_id ?? '') as Id,
    sedeNombre: f.sede_nombre ?? '',
    gestion: f.gestion ?? 0,
    anioDeCarrera: f.anio_de_carrera,
    turno: (f.turno ?? null) as Turno | null,
    dias: f.dias,
    duracion: f.duracion,
    modalidad: (f.modalidad ?? null) as Modalidad | null,
    fechaInicio: (f.fecha_inicio ?? '') as FechaISO,
    fechaFin: (f.fecha_fin ?? null) as FechaISO | null,
    capacidad: f.capacidad,
    estado: (f.estado ?? 'planificado') as EstadoDeCohorte,
    nombre: f.nombre ?? '',
    inscritos: f.inscritos ?? 0,
    planes: f.planes ?? 0,
    precios,
  };
}

function fichaComoJson(ficha: DatosDeFicha): Json {
  return {
    nombres: ficha.nombres,
    apellidos: ficha.apellidos,
    documento: ficha.documento ?? null,
    telefono: ficha.telefono ?? null,
    correo: ficha.correo ?? null,
    fecha_de_nacimiento: ficha.fechaDeNacimiento ?? null,
    sede_id: ficha.sedeId ?? null,
    observaciones: ficha.observaciones ?? null,
  };
}

function inscripcionHecha(valor: unknown): InscripcionHecha {
  const r = comoObjeto(valor);
  return {
    inscripcionId: texto(r.inscripcion) as Id,
    numero: numero(r.numero),
    estudianteId: texto(r.estudiante) as Id,
    codigo: texto(r.codigo),
    alumno: texto(r.alumno),
    grupoNombre: texto(r.grupo_nombre),
    cuotas: numero(r.cuotas),
    sinPlan: r.sin_plan === true,
    fichaNueva: r.ficha_nueva === true,
    repetida: r.repetida === true,
  };
}

interface SolicitudCruda {
  readonly id: string;
  readonly tipo: 'inscripcion' | 'renovacion';
  readonly programa_codigo: string;
  readonly sede_id: string;
  readonly turno: string | null;
  readonly dias: string | null;
  readonly duracion: number | null;
  readonly modalidad: string | null;
  readonly paquete: Paquete | null;
  readonly gestion_anterior: string | null;
  readonly mensaje: string | null;
  readonly estado: EstadoDeSolicitudEnBandeja;
  readonly respuesta: string | null;
  readonly created_at: string;
  readonly estudiante_id: string;
  readonly sedes: { readonly nombre: string } | null;
  readonly perfiles: {
    readonly nombres: string;
    readonly apellidos: string;
    readonly correo: string | null;
    readonly telefono: string | null;
    readonly documento: string | null;
  } | null;
}

const COLUMNAS_DE_SOLICITUD =
  'id, tipo, programa_codigo, sede_id, turno, dias, duracion, modalidad, paquete, gestion_anterior, mensaje, estado, respuesta, created_at, estudiante_id, sedes(nombre), perfiles!solicitudes_estudiante_id_fkey(nombres, apellidos, correo, telefono, documento)';

export class PanelAlumnosSupabase implements AlumnosPort {
  private readonly cliente: SupabaseClient<Database>;

  constructor(cliente: SupabaseClient<Database>) {
    this.cliente = cliente;
  }

  // ------------------------------------------------------------ alumnos

  async buscarAlumnos(filtro: FiltroDeAlumnos): Promise<Resultado<readonly AlumnoEnLista[]>> {
    let consulta = this.cliente
      .from('v_alumnos')
      .select('id, codigo, nombres, apellidos, documento, telefono, sede_nombre, perfil_id, programa_tipo, programa_nombre, anio_de_carrera, grupo_nombre, inscripciones_vigentes, archivado_en')
      .order('apellidos')
      .order('nombres')
      .limit(LIMITE_DE_LISTA);

    const q = textoDeBusqueda(filtro.texto ?? '');
    if (q.length > 0) {
      const comodin = `%${q.replace(/ /g, '%')}%`;
      const exacto = q.toUpperCase().replace(/ /g, '');
      consulta = consulta.or(`nombre_busqueda.ilike.${comodin},documento.ilike.${exacto}%,codigo.ilike.%${exacto}%`);
    }
    if (filtro.programa === 'carrera') consulta = consulta.eq('programa_tipo', 'carrera');
    if (filtro.programa === 'capacitacion') consulta = consulta.in('programa_tipo', ['curso', 'curso_de_temporada']);
    if (filtro.programa === 'sin_inscripcion') consulta = consulta.eq('inscripciones_vigentes', 0);
    if (filtro.sedeId) consulta = consulta.eq('sede_id', filtro.sedeId);
    if (!filtro.incluirArchivados) consulta = consulta.is('archivado_en', null);

    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(
      (data ?? []).map((f) => ({
        id: (f.id ?? '') as Id,
        codigo: f.codigo ?? '',
        nombres: f.nombres ?? '',
        apellidos: f.apellidos ?? '',
        documento: f.documento,
        telefono: f.telefono,
        sedeNombre: f.sede_nombre ?? '',
        programaTipo: f.programa_tipo,
        programaNombre: f.programa_nombre,
        anioDeCarrera: f.anio_de_carrera,
        grupoNombre: f.grupo_nombre,
        inscripcionesVigentes: f.inscripciones_vigentes ?? 0,
        archivado: f.archivado_en !== null,
        conCuenta: f.perfil_id !== null,
      })),
    );
  }

  async fichaDeAlumno(codigo: string): Promise<Resultado<FichaDeAlumno | null>> {
    const { data: e, error } = await this.cliente
      .from('estudiantes')
      .select('id, codigo, nombres, apellidos, documento, telefono, correo, fecha_de_nacimiento, sede_id, observaciones, perfil_id, archivado_en, archivado_motivo, created_at, sedes(nombre)')
      .eq('codigo', codigo.toUpperCase())
      .maybeSingle();
    if (error) return fallo(traducirErrorDePanel(error));
    if (!e) return exito(null);

    const { data: ins, error: errorIns } = await this.cliente
      .from('inscripciones')
      .select('id, numero, cohorte_id, estado, paquete, fecha, documentos_entregados, motivo_de_retiro, renueva_a, solicitud_id')
      .eq('estudiante_id', e.id)
      .order('fecha', { ascending: false })
      .order('numero', { ascending: false });
    if (errorIns) return fallo(traducirErrorDePanel(errorIns));

    const filas = ins ?? [];
    const grupos = await this.gruposPorId(filas.map((i) => i.cohorte_id));
    if (!grupos.exito) return grupos;

    const renovadas = new Set(filas.map((i) => i.renueva_a).filter((x): x is string => x !== null));
    const inscripciones: InscripcionDeAlumno[] = filas.map((i) => {
      const g = grupos.valor.get(i.cohorte_id);
      return {
        id: i.id as Id,
        numero: i.numero,
        grupoId: i.cohorte_id as Id,
        grupoNombre: g?.nombre ?? 'Grupo',
        programaCodigo: g?.programaCodigo ?? '',
        programaTipo: g?.programaTipo ?? 'curso',
        anioDeCarrera: g?.anioDeCarrera ?? null,
        gestion: g?.gestion ?? 0,
        grupoEstado: g?.estado ?? 'abierto',
        estado: i.estado,
        paquete: i.paquete,
        fecha: i.fecha as FechaISO,
        documentosEntregados: i.documentos_entregados,
        motivoDeRetiro: i.motivo_de_retiro,
        renuevaA: (i.renueva_a ?? null) as Id | null,
        renovada: renovadas.has(i.id),
        desdeElPortal: i.solicitud_id !== null,
      };
    });

    return exito({
      id: e.id as Id,
      codigo: e.codigo,
      nombres: e.nombres,
      apellidos: e.apellidos,
      documento: e.documento,
      telefono: e.telefono,
      correo: e.correo,
      fechaDeNacimiento: (e.fecha_de_nacimiento ?? null) as FechaISO | null,
      sedeId: e.sede_id as Id,
      sedeNombre: e.sedes?.nombre ?? '',
      observaciones: e.observaciones,
      conCuenta: e.perfil_id !== null,
      archivadoEn: e.archivado_en,
      archivadoMotivo: e.archivado_motivo,
      creadoEn: e.created_at,
      inscripciones,
    });
  }

  async sugerirFichas(documento: string | null, nombres: string, apellidos: string): Promise<Resultado<readonly FichaSugerida[]>> {
    const sugeridas = new Map<string, FichaSugerida>();
    const doc = (documento ?? '').trim().toUpperCase();
    if (/^[0-9A-Z-]{4,20}$/.test(doc)) {
      const { data, error } = await this.cliente
        .from('estudiantes')
        .select('id, codigo, nombres, apellidos, documento')
        .is('perfil_id', null)
        .is('archivado_en', null)
        .eq('documento', doc)
        .limit(5);
      if (error) return fallo(traducirErrorDePanel(error));
      for (const f of data ?? []) {
        sugeridas.set(f.id, { id: f.id as Id, codigo: f.codigo, nombre: `${f.nombres} ${f.apellidos}`, documento: f.documento, porDocumento: true });
      }
    }
    const nombre = textoDeBusqueda(`${nombres} ${apellidos}`);
    if (nombre.length >= 3) {
      const { data, error } = await this.cliente
        .from('estudiantes')
        .select('id, codigo, nombres, apellidos, documento')
        .is('perfil_id', null)
        .is('archivado_en', null)
        .ilike('nombre_busqueda', `%${nombre.replace(/ /g, '%')}%`)
        .limit(5);
      if (error) return fallo(traducirErrorDePanel(error));
      for (const f of data ?? []) {
        if (!sugeridas.has(f.id)) {
          sugeridas.set(f.id, { id: f.id as Id, codigo: f.codigo, nombre: `${f.nombres} ${f.apellidos}`, documento: f.documento, porDocumento: false });
        }
      }
    }
    return exito([...sugeridas.values()]);
  }

  async crearAlumno(clave: string, ficha: DatosDeFicha): Promise<Resultado<{ readonly estudianteId: Id; readonly codigo: string }>> {
    const { data, error } = await this.cliente.rpc('crear_estudiante', { p_clave: clave, p_ficha: fichaComoJson(ficha) });
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({ estudianteId: texto(r.estudiante) as Id, codigo: texto(r.codigo) });
  }

  async editarAlumno(id: Id, ficha: DatosDeFicha): Promise<Resultado<void>> {
    const { data, error } = await this.cliente
      .from('estudiantes')
      .update({
        nombres: ficha.nombres,
        apellidos: ficha.apellidos,
        documento: ficha.documento ?? null,
        telefono: ficha.telefono ?? null,
        correo: ficha.correo ?? null,
        fecha_de_nacimiento: ficha.fechaDeNacimiento ?? null,
        observaciones: ficha.observaciones ?? null,
        ...(ficha.sedeId ? { sede_id: ficha.sedeId } : {}),
      })
      .eq('id', id)
      .select('id');
    if (error) return fallo(error.code === '23505' ? 'Ya hay otra ficha con ese carnet. Búscala antes de cambiarlo.' : traducirErrorDePanel(error));
    return (data ?? []).length === 1 ? exito(undefined) : fallo(NO_GUARDADO);
  }

  async archivarAlumno(id: Id, motivo: string): Promise<Resultado<void>> {
    const { data, error } = await this.cliente
      .from('estudiantes')
      .update({ archivado_en: new Date().toISOString(), archivado_motivo: motivo })
      .eq('id', id)
      .is('archivado_en', null)
      .select('id');
    if (error) return fallo(traducirErrorDePanel(error));
    return (data ?? []).length === 1 ? exito(undefined) : fallo(NO_GUARDADO);
  }

  // ------------------------------------------------------------ grupos

  private async gruposPorId(ids: readonly string[]): Promise<Resultado<ReadonlyMap<string, GrupoEnLista>>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return exito(new Map());
    const { data, error } = await this.cliente.from('v_grupos').select('*').in('id', unicos);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(new Map((data ?? []).map((f) => [f.id ?? '', grupoDesdeVista(f)])));
  }

  async listarGrupos(filtro: FiltroDeGrupos): Promise<Resultado<readonly GrupoEnLista[]>> {
    let consulta = this.cliente
      .from('v_grupos')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .order('programa_nombre')
      .limit(LIMITE_DE_LISTA);
    if (filtro.sedeId) consulta = consulta.eq('sede_id', filtro.sedeId);
    if (filtro.programaCodigo) consulta = consulta.eq('programa_codigo', filtro.programaCodigo);
    consulta = filtro.estados && filtro.estados.length > 0 ? consulta.in('estado', [...filtro.estados]) : consulta.neq('estado', 'cerrado');
    const { data, error } = await consulta;
    if (error) return fallo(traducirErrorDePanel(error));
    const filas = data ?? [];
    const precios = await this.preciosDe(filas.map((f) => f.id ?? ''));
    if (!precios.exito) return precios;
    return exito(filas.map((f) => grupoDesdeVista(f, precios.valor.get(f.id ?? '') ?? [])));
  }

  private async preciosDe(ids: readonly string[]): Promise<Resultado<ReadonlyMap<string, readonly PrecioDeGrupo[]>>> {
    const unicos = [...new Set(ids)].filter((x) => x.length > 0);
    const mapa = new Map<string, PrecioDeGrupo[]>();
    if (unicos.length === 0) return exito(mapa);
    const { data, error } = await this.cliente
      .from('planes_de_pago')
      .select('cohorte_id, paquete, monto_cuota, cuotas, cada_meses')
      .in('cohorte_id', unicos)
      .order('paquete');
    if (error) return fallo(traducirErrorDePanel(error));
    for (const p of data ?? []) {
      const lista = mapa.get(p.cohorte_id) ?? [];
      lista.push({ paquete: p.paquete, montoCuota: p.monto_cuota as Centavos, cuotas: p.cuotas, cadaMeses: p.cada_meses });
      mapa.set(p.cohorte_id, lista);
    }
    return exito(mapa);
  }

  async fichaDeGrupo(id: Id): Promise<Resultado<FichaDeGrupo | null>> {
    const [g, planes, inscritos] = await Promise.all([
      this.cliente.from('v_grupos').select('*').eq('id', id).maybeSingle(),
      this.cliente
        .from('planes_de_pago')
        .select('id, paquete, monto_cuota, cuotas, primer_vencimiento, cada_meses, nota')
        .eq('cohorte_id', id)
        .order('paquete'),
      this.cliente
        .from('inscripciones')
        .select('id, estado, paquete, fecha, estudiantes(id, codigo, nombres, apellidos, telefono)')
        .eq('cohorte_id', id)
        .order('fecha'),
    ]);
    const error = g.error ?? planes.error ?? inscritos.error;
    if (error) return fallo(traducirErrorDePanel(error));
    if (!g.data) return exito(null);
    const precios = (planes.data ?? []).map((p) => ({
      paquete: p.paquete,
      montoCuota: p.monto_cuota as Centavos,
      cuotas: p.cuotas,
      cadaMeses: p.cada_meses,
    }));
    return exito({
      grupo: grupoDesdeVista(g.data, precios),
      planes: (planes.data ?? []).map((p) => ({
        id: p.id as Id,
        paquete: p.paquete,
        montoCuota: p.monto_cuota as Centavos,
        cuotas: p.cuotas,
        primerVencimiento: p.primer_vencimiento as FechaISO,
        cadaMeses: p.cada_meses,
        nota: p.nota,
      })),
      inscritos: (inscritos.data ?? []).map((i) => ({
        inscripcionId: i.id as Id,
        estudianteId: (i.estudiantes?.id ?? '') as Id,
        codigo: i.estudiantes?.codigo ?? '',
        nombres: i.estudiantes?.nombres ?? '',
        apellidos: i.estudiantes?.apellidos ?? '',
        telefono: i.estudiantes?.telefono ?? null,
        estado: i.estado,
        paquete: i.paquete,
        fecha: i.fecha as FechaISO,
      })),
    });
  }

  async crearGrupo(datos: DatosDeGrupo): Promise<Resultado<{ readonly id: Id }>> {
    const { data, error } = await this.cliente
      .from('cohortes')
      .insert({
        programa_codigo: datos.programaCodigo,
        sede_id: datos.sedeId,
        gestion: datos.gestion,
        anio_de_carrera: datos.anioDeCarrera ?? null,
        turno: datos.turno ?? null,
        dias: datos.dias ?? null,
        duracion: datos.duracion ?? null,
        modalidad: datos.modalidad ?? null,
        fecha_inicio: datos.fechaInicio,
        fecha_fin: datos.fechaFin ?? null,
        capacidad: datos.capacidad ?? null,
        estado: datos.estado,
      })
      .select('id')
      .single();
    if (error) return fallo(traducirErrorDePanel(error));
    return exito({ id: data.id as Id });
  }

  async editarGrupo(id: Id, datos: Omit<DatosDeGrupo, 'programaCodigo' | 'sedeId'>): Promise<Resultado<void>> {
    const { data, error } = await this.cliente
      .from('cohortes')
      .update({
        gestion: datos.gestion,
        anio_de_carrera: datos.anioDeCarrera ?? null,
        turno: datos.turno ?? null,
        dias: datos.dias ?? null,
        duracion: datos.duracion ?? null,
        modalidad: datos.modalidad ?? null,
        fecha_inicio: datos.fechaInicio,
        fecha_fin: datos.fechaFin ?? null,
        capacidad: datos.capacidad ?? null,
        estado: datos.estado,
      })
      .eq('id', id)
      .select('id');
    if (error) return fallo(traducirErrorDePanel(error));
    return (data ?? []).length === 1 ? exito(undefined) : fallo(NO_GUARDADO);
  }

  async cerrarGrupo(clave: string, id: Id): Promise<Resultado<CierreDeGrupo>> {
    const { data, error } = await this.cliente.rpc('cerrar_grupo', { p_clave: clave, p_cohorte: id });
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({ concluidos: numero(r.concluidos), conDeuda: numero(r.con_deuda) });
  }

  async guardarPlan(grupoId: Id, plan: DatosDePlan, planId?: Id): Promise<Resultado<void>> {
    const valores = {
      paquete: plan.paquete ?? null,
      monto_cuota: plan.montoCuota,
      cuotas: plan.cuotas,
      primer_vencimiento: plan.primerVencimiento,
      cada_meses: plan.cadaMeses,
      nota: plan.nota ?? null,
    };
    const { data, error } = planId
      ? await this.cliente.from('planes_de_pago').update(valores).eq('id', planId).eq('cohorte_id', grupoId).select('id')
      : await this.cliente
          .from('planes_de_pago')
          // El concepto lo elige la base según el programa (disparador validar_plan_de_pago);
          // el tipo generado lo marca obligatorio porque la columna es NOT NULL.
          .insert({ ...valores, cohorte_id: grupoId, concepto_id: null as unknown as string })
          .select('id');
    if (error) {
      return fallo(error.code === '23505' ? 'Este grupo ya tiene un precio para ese paquete. Edítalo en lugar de crear otro.' : traducirErrorDePanel(error));
    }
    return (data ?? []).length === 1 ? exito(undefined) : fallo(NO_GUARDADO);
  }

  async borrarPlan(planId: Id): Promise<Resultado<void>> {
    const { data, error } = await this.cliente.from('planes_de_pago').delete().eq('id', planId).select('id');
    if (error) return fallo(traducirErrorDePanel(error));
    return (data ?? []).length === 1 ? exito(undefined) : fallo(NO_GUARDADO);
  }

  // ------------------------------------------------------------ inscripciones

  async inscribir(clave: string, datos: DatosDeInscripcionNueva): Promise<Resultado<InscripcionHecha>> {
    const { data, error } = await this.cliente.rpc(
      'inscribir',
      argsDe<'inscribir'>({
        p_clave: clave,
        p_estudiante: datos.estudianteId ?? null,
        p_ficha: datos.ficha ? fichaComoJson(datos.ficha) : null,
        p_cohorte: datos.grupoId,
        p_paquete: datos.paquete ?? null,
        p_documentos: [...datos.documentos],
        p_renueva_a: datos.renuevaA ?? null,
        p_observaciones: datos.observaciones ?? null,
        p_desde: null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(inscripcionHecha(data));
  }

  async cambiarEstadoDeInscripcion(
    clave: string,
    inscripcionId: Id,
    estado: Exclude<EstadoDeInscripcion, 'inscrito'>,
    motivo?: string,
  ): Promise<Resultado<{ readonly estado: EstadoDeInscripcion }>> {
    const { data, error } = await this.cliente.rpc(
      'cambiar_estado_de_inscripcion',
      argsDe<'cambiar_estado_de_inscripcion'>({ p_clave: clave, p_inscripcion: inscripcionId, p_estado: estado, p_motivo: motivo ?? null }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    const r = comoObjeto(data);
    return exito({ estado: (texto(r.estado) || estado) as EstadoDeInscripcion });
  }

  async guardarRequisitos(inscripcionId: Id, documentos: readonly string[]): Promise<Resultado<void>> {
    const { data, error } = await this.cliente
      .from('inscripciones')
      .update({ documentos_entregados: [...documentos] })
      .eq('id', inscripcionId)
      .select('id');
    if (error) return fallo(traducirErrorDePanel(error));
    return (data ?? []).length === 1 ? exito(undefined) : fallo(NO_GUARDADO);
  }

  // ------------------------------------------------------------ solicitudes del portal

  private async conFichas(filas: readonly SolicitudCruda[]): Promise<Resultado<readonly SolicitudEnBandeja[]>> {
    const perfiles = [...new Set(filas.map((f) => f.estudiante_id))];
    const fichas = new Map<string, string>();
    if (perfiles.length > 0) {
      const { data, error } = await this.cliente.from('estudiantes').select('perfil_id, codigo').in('perfil_id', perfiles);
      if (error) return fallo(traducirErrorDePanel(error));
      for (const f of data ?? []) if (f.perfil_id) fichas.set(f.perfil_id, f.codigo);
    }
    return exito(
      filas.map((s) => ({
        id: s.id as Id,
        tipo: s.tipo,
        programaCodigo: s.programa_codigo,
        sedeId: s.sede_id as Id,
        sedeNombre: s.sedes?.nombre ?? '',
        turno: s.turno,
        dias: s.dias,
        duracion: s.duracion,
        modalidad: s.modalidad,
        paquete: s.paquete,
        gestionAnterior: s.gestion_anterior,
        mensaje: s.mensaje,
        estado: s.estado,
        respuesta: s.respuesta,
        creadaEn: s.created_at,
        perfilId: s.estudiante_id as Id,
        nombres: s.perfiles?.nombres ?? '',
        apellidos: s.perfiles?.apellidos ?? '',
        correo: s.perfiles?.correo ?? null,
        telefono: s.perfiles?.telefono ?? null,
        documento: s.perfiles?.documento ?? null,
        fichaCodigo: fichas.get(s.estudiante_id) ?? null,
      })),
    );
  }

  async listarSolicitudes(estados: readonly EstadoDeSolicitudEnBandeja[]): Promise<Resultado<readonly SolicitudEnBandeja[]>> {
    const { data, error } = await this.cliente
      .from('solicitudes')
      .select(COLUMNAS_DE_SOLICITUD)
      .in('estado', [...estados])
      .order('created_at', { ascending: true })
      .limit(LIMITE_DE_LISTA);
    if (error) return fallo(traducirErrorDePanel(error));
    return this.conFichas((data ?? []) as unknown as readonly SolicitudCruda[]);
  }

  async solicitud(id: Id): Promise<Resultado<SolicitudEnBandeja | null>> {
    const { data, error } = await this.cliente.from('solicitudes').select(COLUMNAS_DE_SOLICITUD).eq('id', id).maybeSingle();
    if (error) return fallo(traducirErrorDePanel(error));
    if (!data) return exito(null);
    const lista = await this.conFichas([data as unknown as SolicitudCruda]);
    return lista.exito ? exito(lista.valor[0] ?? null) : lista;
  }

  async contarSolicitudesAbiertas(): Promise<Resultado<number>> {
    const { count, error } = await this.cliente
      .from('solicitudes')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'en_revision']);
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(count ?? 0);
  }

  async aprobarSolicitud(clave: string, datos: DatosDeAprobacion): Promise<Resultado<InscripcionHecha>> {
    const { data, error } = await this.cliente.rpc(
      'aprobar_solicitud',
      argsDe<'aprobar_solicitud'>({
        p_clave: clave,
        p_solicitud: datos.solicitudId,
        p_cohorte: datos.grupoId,
        p_paquete: datos.paquete ?? null,
        p_documentos: [...datos.documentos],
        p_respuesta: datos.respuesta || null,
        p_estudiante: datos.estudianteId ?? null,
      }),
    );
    if (error) return fallo(traducirErrorDePanel(error));
    return exito(inscripcionHecha(data));
  }

  async responderSolicitud(id: Id, estado: 'en_revision' | 'rechazada', respuesta: string): Promise<Resultado<void>> {
    const { data, error } = await this.cliente
      .from('solicitudes')
      .update({ estado, respuesta })
      .eq('id', id)
      .in('estado', ['pendiente', 'en_revision'])
      .select('id');
    if (error) return fallo(traducirErrorDePanel(error));
    return (data ?? []).length === 1 ? exito(undefined) : fallo('Esa solicitud ya fue atendida por otra persona. Vuelve a la bandeja.');
  }
}
