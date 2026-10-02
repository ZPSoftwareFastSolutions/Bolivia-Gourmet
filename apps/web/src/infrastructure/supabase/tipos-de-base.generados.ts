/**
 * GENERADO con `generate_typescript_types` (conector de Supabase) sobre el
 * proyecto `bnobhnmurzsnffdrxeck` el 2026-10-02, tras la migración 0010 (panel_caja_libro).
 * No editar a mano: regenerar tras cada migración que cambie el esquema.
 * Se conserva solo el tipo `Database` que consume el cliente. El generador
 * marca todos los parámetros de las RPC como obligatorios aunque admitan null:
 * los adaptadores lo dicen en un solo lugar (`ArgsConNulos`).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      cargos: {
        Row: {
          anulacion_motivo: string | null;
          anulado_el: string | null;
          anulado_en: string | null;
          anulado_por: string | null;
          cliente: string | null;
          concepto_id: string;
          descripcion: string;
          entrega_id: string | null;
          estudiante_id: string | null;
          fecha: string;
          id: string;
          inscripcion_id: string | null;
          monto: number;
          numero_de_cuota: number | null;
          operacion_id: string;
          origen: Database['public']['Enums']['origen_de_cargo'];
          plan_id: string | null;
          prestamo_id: string | null;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
          vence_el: string;
        };
        Insert: {
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cliente?: string | null;
          concepto_id: string;
          descripcion: string;
          entrega_id?: string | null;
          estudiante_id?: string | null;
          fecha: string;
          id?: string;
          inscripcion_id?: string | null;
          monto: number;
          numero_de_cuota?: number | null;
          operacion_id: string;
          origen: Database['public']['Enums']['origen_de_cargo'];
          plan_id?: string | null;
          prestamo_id?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
          vence_el: string;
        };
        Update: {
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cliente?: string | null;
          concepto_id?: string;
          descripcion?: string;
          entrega_id?: string | null;
          estudiante_id?: string | null;
          fecha?: string;
          id?: string;
          inscripcion_id?: string | null;
          monto?: number;
          numero_de_cuota?: number | null;
          operacion_id?: string;
          origen?: Database['public']['Enums']['origen_de_cargo'];
          plan_id?: string | null;
          prestamo_id?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
          vence_el?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cargos_anulado_por_fkey';
            columns: ['anulado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_concepto_id_fkey';
            columns: ['concepto_id'];
            isOneToOne: false;
            referencedRelation: 'conceptos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'estudiantes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_alumnos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_alumno';
            referencedColumns: ['estudiante_id'];
          },
          {
            foreignKeyName: 'cargos_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'inscripciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'cargos_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'planes_de_pago';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      cierres_de_caja: {
        Row: {
          cerrado_en: string;
          cerrado_por: string;
          cobros_qr: number;
          cobros_transferencia: number;
          contado: number;
          diferencia: number | null;
          entradas_efectivo: number;
          esperado: number;
          fecha: string;
          id: string;
          numero: number;
          observacion: string | null;
          operacion_id: string;
          queda: number | null;
          registros: number;
          retiro: number;
          saldo_inicial: number;
          salidas_efectivo: number;
          sede_id: string;
        };
        Insert: {
          cerrado_en?: string;
          cerrado_por?: string;
          cobros_qr?: number;
          cobros_transferencia?: number;
          contado: number;
          diferencia?: number | null;
          entradas_efectivo: number;
          esperado: number;
          fecha: string;
          id?: string;
          numero?: never;
          observacion?: string | null;
          operacion_id: string;
          queda?: number | null;
          registros: number;
          retiro?: number;
          saldo_inicial: number;
          salidas_efectivo: number;
          sede_id: string;
        };
        Update: {
          cerrado_en?: string;
          cerrado_por?: string;
          cobros_qr?: number;
          cobros_transferencia?: number;
          contado?: number;
          diferencia?: number | null;
          entradas_efectivo?: number;
          esperado?: number;
          fecha?: string;
          id?: string;
          numero?: never;
          observacion?: string | null;
          operacion_id?: string;
          queda?: number | null;
          registros?: number;
          retiro?: number;
          saldo_inicial?: number;
          salidas_efectivo?: number;
          sede_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cierres_de_caja_cerrado_por_fkey';
            columns: ['cerrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cierres_de_caja_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'cierres_de_caja_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      cohortes: {
        Row: {
          anio_de_carrera: number | null;
          capacidad: number | null;
          created_at: string;
          dias: string | null;
          duracion: number | null;
          estado: Database['public']['Enums']['estado_de_grupo'];
          fecha_fin: string | null;
          fecha_inicio: string;
          gestion: number;
          id: string;
          modalidad: string | null;
          programa_codigo: string;
          registrado_por: string;
          sede_id: string;
          turno: string | null;
          updated_at: string;
        };
        Insert: {
          anio_de_carrera?: number | null;
          capacidad?: number | null;
          created_at?: string;
          dias?: string | null;
          duracion?: number | null;
          estado?: Database['public']['Enums']['estado_de_grupo'];
          fecha_fin?: string | null;
          fecha_inicio: string;
          gestion: number;
          id?: string;
          modalidad?: string | null;
          programa_codigo: string;
          registrado_por?: string;
          sede_id: string;
          turno?: string | null;
          updated_at?: string;
        };
        Update: {
          anio_de_carrera?: number | null;
          capacidad?: number | null;
          created_at?: string;
          dias?: string | null;
          duracion?: number | null;
          estado?: Database['public']['Enums']['estado_de_grupo'];
          fecha_fin?: string | null;
          fecha_inicio?: string;
          gestion?: number;
          id?: string;
          modalidad?: string | null;
          programa_codigo?: string;
          registrado_por?: string;
          sede_id?: string;
          turno?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cohortes_programa_codigo_fkey';
            columns: ['programa_codigo'];
            isOneToOne: false;
            referencedRelation: 'programas';
            referencedColumns: ['codigo'];
          },
          {
            foreignKeyName: 'cohortes_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      conceptos: {
        Row: {
          activo: boolean;
          codigo: string;
          created_at: string;
          del_sistema: boolean;
          grupo: string;
          icono: string;
          id: string;
          naturaleza: Database['public']['Enums']['naturaleza_de_concepto'];
          nombre: string;
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          codigo: string;
          created_at?: string;
          del_sistema?: boolean;
          grupo: string;
          icono?: string;
          id?: string;
          naturaleza: Database['public']['Enums']['naturaleza_de_concepto'];
          nombre: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          codigo?: string;
          created_at?: string;
          del_sistema?: boolean;
          grupo?: string;
          icono?: string;
          id?: string;
          naturaleza?: Database['public']['Enums']['naturaleza_de_concepto'];
          nombre?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      estudiantes: {
        Row: {
          apellidos: string;
          archivado_en: string | null;
          archivado_motivo: string | null;
          archivado_por: string | null;
          codigo: string;
          correo: string | null;
          created_at: string;
          documento: string | null;
          fecha_de_nacimiento: string | null;
          id: string;
          nombre_busqueda: string | null;
          nombres: string;
          observaciones: string | null;
          perfil_id: string | null;
          registrado_por: string;
          sede_id: string;
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          apellidos: string;
          archivado_en?: string | null;
          archivado_motivo?: string | null;
          archivado_por?: string | null;
          codigo: string;
          correo?: string | null;
          created_at?: string;
          documento?: string | null;
          fecha_de_nacimiento?: string | null;
          id?: string;
          nombre_busqueda?: string | null;
          nombres: string;
          observaciones?: string | null;
          perfil_id?: string | null;
          registrado_por?: string;
          sede_id: string;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          apellidos?: string;
          archivado_en?: string | null;
          archivado_motivo?: string | null;
          archivado_por?: string | null;
          codigo?: string;
          correo?: string | null;
          created_at?: string;
          documento?: string | null;
          fecha_de_nacimiento?: string | null;
          id?: string;
          nombre_busqueda?: string | null;
          nombres?: string;
          observaciones?: string | null;
          perfil_id?: string | null;
          registrado_por?: string;
          sede_id?: string;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'estudiantes_archivado_por_fkey';
            columns: ['archivado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'estudiantes_perfil_id_fkey';
            columns: ['perfil_id'];
            isOneToOne: true;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'estudiantes_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      gastos: {
        Row: {
          anulacion_cierre_id: string | null;
          anulacion_motivo: string | null;
          anulado_el: string | null;
          anulado_en: string | null;
          anulado_por: string | null;
          cierre_id: string | null;
          comprobante: Database['public']['Enums']['tipo_de_comprobante'];
          concepto_id: string;
          descripcion: string;
          fecha: string;
          id: string;
          medio: Database['public']['Enums']['medio_de_pago'];
          monto: number;
          numero: number;
          numero_comprobante: string | null;
          operacion_id: string;
          proveedor: string | null;
          referencia: string | null;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
        };
        Insert: {
          anulacion_cierre_id?: string | null;
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cierre_id?: string | null;
          comprobante?: Database['public']['Enums']['tipo_de_comprobante'];
          concepto_id: string;
          descripcion: string;
          fecha: string;
          id?: string;
          medio: Database['public']['Enums']['medio_de_pago'];
          monto: number;
          numero?: never;
          numero_comprobante?: string | null;
          operacion_id: string;
          proveedor?: string | null;
          referencia?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
        };
        Update: {
          anulacion_cierre_id?: string | null;
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cierre_id?: string | null;
          comprobante?: Database['public']['Enums']['tipo_de_comprobante'];
          concepto_id?: string;
          descripcion?: string;
          fecha?: string;
          id?: string;
          medio?: Database['public']['Enums']['medio_de_pago'];
          monto?: number;
          numero?: never;
          numero_comprobante?: string | null;
          operacion_id?: string;
          proveedor?: string | null;
          referencia?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gastos_anulacion_cierre_id_fkey';
            columns: ['anulacion_cierre_id'];
            isOneToOne: false;
            referencedRelation: 'cierres_de_caja';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_anulado_por_fkey';
            columns: ['anulado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_cierre_id_fkey';
            columns: ['cierre_id'];
            isOneToOne: false;
            referencedRelation: 'cierres_de_caja';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_concepto_id_fkey';
            columns: ['concepto_id'];
            isOneToOne: false;
            referencedRelation: 'conceptos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'gastos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      inscripciones: {
        Row: {
          cohorte_id: string;
          created_at: string;
          documentos_entregados: string[];
          estado: Database['public']['Enums']['estado_de_inscripcion'];
          estudiante_id: string;
          fecha: string;
          id: string;
          motivo_de_retiro: string | null;
          numero: number;
          observaciones: string | null;
          operacion_id: string;
          paquete: Database['public']['Enums']['paquete_de_pago'] | null;
          registrado_por: string;
          renueva_a: string | null;
          solicitud_id: string | null;
          updated_at: string;
        };
        Insert: {
          cohorte_id: string;
          created_at?: string;
          documentos_entregados?: string[];
          estado?: Database['public']['Enums']['estado_de_inscripcion'];
          estudiante_id: string;
          fecha: string;
          id?: string;
          motivo_de_retiro?: string | null;
          numero?: never;
          observaciones?: string | null;
          operacion_id: string;
          paquete?: Database['public']['Enums']['paquete_de_pago'] | null;
          registrado_por?: string;
          renueva_a?: string | null;
          solicitud_id?: string | null;
          updated_at?: string;
        };
        Update: {
          cohorte_id?: string;
          created_at?: string;
          documentos_entregados?: string[];
          estado?: Database['public']['Enums']['estado_de_inscripcion'];
          estudiante_id?: string;
          fecha?: string;
          id?: string;
          motivo_de_retiro?: string | null;
          numero?: never;
          observaciones?: string | null;
          operacion_id?: string;
          paquete?: Database['public']['Enums']['paquete_de_pago'] | null;
          registrado_por?: string;
          renueva_a?: string | null;
          solicitud_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inscripciones_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscripciones_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscripciones_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'estudiantes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscripciones_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_alumnos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscripciones_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_alumno';
            referencedColumns: ['estudiante_id'];
          },
          {
            foreignKeyName: 'inscripciones_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'inscripciones_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscripciones_renueva_a_fkey';
            columns: ['renueva_a'];
            isOneToOne: true;
            referencedRelation: 'inscripciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscripciones_solicitud_id_fkey';
            columns: ['solicitud_id'];
            isOneToOne: true;
            referencedRelation: 'solicitudes';
            referencedColumns: ['id'];
          },
        ];
      };
      operaciones: {
        Row: {
          clave: string;
          created_at: string;
          registrado_por: string;
          resultado: Json | null;
          tipo: string;
        };
        Insert: {
          clave: string;
          created_at?: string;
          registrado_por?: string;
          resultado?: Json | null;
          tipo: string;
        };
        Update: {
          clave?: string;
          created_at?: string;
          registrado_por?: string;
          resultado?: Json | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'operaciones_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pago_aplicaciones: {
        Row: {
          cargo_id: string;
          monto: number;
          pago_id: string;
        };
        Insert: {
          cargo_id: string;
          monto: number;
          pago_id: string;
        };
        Update: {
          cargo_id?: string;
          monto?: number;
          pago_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pago_aplicaciones_cargo_id_fkey';
            columns: ['cargo_id'];
            isOneToOne: false;
            referencedRelation: 'cargos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pago_aplicaciones_cargo_id_fkey';
            columns: ['cargo_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_cargo';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pago_aplicaciones_pago_id_fkey';
            columns: ['pago_id'];
            isOneToOne: false;
            referencedRelation: 'pagos';
            referencedColumns: ['id'];
          },
        ];
      };
      pagos: {
        Row: {
          anio: number;
          anulacion_cierre_id: string | null;
          anulacion_motivo: string | null;
          anulado_el: string | null;
          anulado_en: string | null;
          anulado_por: string | null;
          cierre_id: string | null;
          cliente: string | null;
          estudiante_id: string | null;
          fecha: string;
          id: string;
          medio: Database['public']['Enums']['medio_de_pago'];
          monto: number;
          nota: string | null;
          numero: number;
          operacion_id: string;
          referencia: string | null;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
        };
        Insert: {
          anio: number;
          anulacion_cierre_id?: string | null;
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cierre_id?: string | null;
          cliente?: string | null;
          estudiante_id?: string | null;
          fecha: string;
          id?: string;
          medio: Database['public']['Enums']['medio_de_pago'];
          monto: number;
          nota?: string | null;
          numero: number;
          operacion_id: string;
          referencia?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
        };
        Update: {
          anio?: number;
          anulacion_cierre_id?: string | null;
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cierre_id?: string | null;
          cliente?: string | null;
          estudiante_id?: string | null;
          fecha?: string;
          id?: string;
          medio?: Database['public']['Enums']['medio_de_pago'];
          monto?: number;
          nota?: string | null;
          numero?: number;
          operacion_id?: string;
          referencia?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pagos_anulacion_cierre_id_fkey';
            columns: ['anulacion_cierre_id'];
            isOneToOne: false;
            referencedRelation: 'cierres_de_caja';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_anulado_por_fkey';
            columns: ['anulado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_cierre_id_fkey';
            columns: ['cierre_id'];
            isOneToOne: false;
            referencedRelation: 'cierres_de_caja';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'estudiantes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_alumnos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_alumno';
            referencedColumns: ['estudiante_id'];
          },
          {
            foreignKeyName: 'pagos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'pagos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      perfiles: {
        Row: {
          activo: boolean;
          apellidos: string;
          correo: string | null;
          created_at: string;
          documento: string | null;
          id: string;
          nombres: string;
          rol: Database['public']['Enums']['rol_de_usuario'];
          sede_id: string | null;
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          apellidos?: string;
          correo?: string | null;
          created_at?: string;
          documento?: string | null;
          id: string;
          nombres?: string;
          rol?: Database['public']['Enums']['rol_de_usuario'];
          sede_id?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          apellidos?: string;
          correo?: string | null;
          created_at?: string;
          documento?: string | null;
          id?: string;
          nombres?: string;
          rol?: Database['public']['Enums']['rol_de_usuario'];
          sede_id?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'perfiles_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      permisos_de_rol: {
        Row: {
          permiso: string;
          rol: Database['public']['Enums']['rol_de_usuario'];
        };
        Insert: {
          permiso: string;
          rol: Database['public']['Enums']['rol_de_usuario'];
        };
        Update: {
          permiso?: string;
          rol?: Database['public']['Enums']['rol_de_usuario'];
        };
        Relationships: [];
      };
      planes_de_pago: {
        Row: {
          cada_meses: number;
          cohorte_id: string;
          concepto_id: string;
          created_at: string;
          cuotas: number;
          id: string;
          monto_cuota: number;
          nota: string | null;
          paquete: Database['public']['Enums']['paquete_de_pago'] | null;
          primer_vencimiento: string;
          registrado_por: string;
          updated_at: string;
        };
        Insert: {
          cada_meses?: number;
          cohorte_id: string;
          concepto_id: string;
          created_at?: string;
          cuotas: number;
          id?: string;
          monto_cuota: number;
          nota?: string | null;
          paquete?: Database['public']['Enums']['paquete_de_pago'] | null;
          primer_vencimiento: string;
          registrado_por?: string;
          updated_at?: string;
        };
        Update: {
          cada_meses?: number;
          cohorte_id?: string;
          concepto_id?: string;
          created_at?: string;
          cuotas?: number;
          id?: string;
          monto_cuota?: number;
          nota?: string | null;
          paquete?: Database['public']['Enums']['paquete_de_pago'] | null;
          primer_vencimiento?: string;
          registrado_por?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'planes_de_pago_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planes_de_pago_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planes_de_pago_concepto_id_fkey';
            columns: ['concepto_id'];
            isOneToOne: false;
            referencedRelation: 'conceptos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planes_de_pago_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
        ];
      };
      programas: {
        Row: {
          activo: boolean;
          codigo: string;
          created_at: string;
          nombre: string;
          tipo: Database['public']['Enums']['tipo_de_programa'];
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          codigo: string;
          created_at?: string;
          nombre: string;
          tipo: Database['public']['Enums']['tipo_de_programa'];
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          codigo?: string;
          created_at?: string;
          nombre?: string;
          tipo?: Database['public']['Enums']['tipo_de_programa'];
          updated_at?: string;
        };
        Relationships: [];
      };
      sedes: {
        Row: {
          activa: boolean;
          codigo: string;
          created_at: string;
          direccion: string;
          id: string;
          nombre: string;
          telefono: string;
          updated_at: string;
          zona: string;
        };
        Insert: {
          activa?: boolean;
          codigo: string;
          created_at?: string;
          direccion: string;
          id?: string;
          nombre: string;
          telefono: string;
          updated_at?: string;
          zona: string;
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          created_at?: string;
          direccion?: string;
          id?: string;
          nombre?: string;
          telefono?: string;
          updated_at?: string;
          zona?: string;
        };
        Relationships: [];
      };
      solicitudes: {
        Row: {
          created_at: string;
          dias: string | null;
          duracion: number | null;
          estado: Database['public']['Enums']['estado_de_solicitud'];
          estudiante_id: string;
          gestion_anterior: string | null;
          id: string;
          mensaje: string | null;
          modalidad: string | null;
          paquete: Database['public']['Enums']['paquete_de_pago'] | null;
          programa_codigo: string;
          respuesta: string | null;
          revisado_en: string | null;
          revisado_por: string | null;
          sede_id: string;
          tipo: Database['public']['Enums']['tipo_de_solicitud'];
          turno: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dias?: string | null;
          duracion?: number | null;
          estado?: Database['public']['Enums']['estado_de_solicitud'];
          estudiante_id?: string;
          gestion_anterior?: string | null;
          id?: string;
          mensaje?: string | null;
          modalidad?: string | null;
          paquete?: Database['public']['Enums']['paquete_de_pago'] | null;
          programa_codigo: string;
          respuesta?: string | null;
          revisado_en?: string | null;
          revisado_por?: string | null;
          sede_id: string;
          tipo: Database['public']['Enums']['tipo_de_solicitud'];
          turno?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dias?: string | null;
          duracion?: number | null;
          estado?: Database['public']['Enums']['estado_de_solicitud'];
          estudiante_id?: string;
          gestion_anterior?: string | null;
          id?: string;
          mensaje?: string | null;
          modalidad?: string | null;
          paquete?: Database['public']['Enums']['paquete_de_pago'] | null;
          programa_codigo?: string;
          respuesta?: string | null;
          revisado_en?: string | null;
          revisado_por?: string | null;
          sede_id?: string;
          tipo?: Database['public']['Enums']['tipo_de_solicitud'];
          turno?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'solicitudes_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitudes_programa_codigo_fkey';
            columns: ['programa_codigo'];
            isOneToOne: false;
            referencedRelation: 'programas';
            referencedColumns: ['codigo'];
          },
          {
            foreignKeyName: 'solicitudes_revisado_por_fkey';
            columns: ['revisado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitudes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_alumnos: {
        Row: {
          anio_de_carrera: number | null;
          apellidos: string | null;
          archivado_en: string | null;
          codigo: string | null;
          correo: string | null;
          created_at: string | null;
          documento: string | null;
          grupo_nombre: string | null;
          id: string | null;
          inscripciones_vigentes: number | null;
          nombre_busqueda: string | null;
          nombres: string | null;
          perfil_id: string | null;
          programa_codigo: string | null;
          programa_nombre: string | null;
          programa_tipo: Database['public']['Enums']['tipo_de_programa'] | null;
          sede_id: string | null;
          sede_nombre: string | null;
          telefono: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cohortes_programa_codigo_fkey';
            columns: ['programa_codigo'];
            isOneToOne: false;
            referencedRelation: 'programas';
            referencedColumns: ['codigo'];
          },
          {
            foreignKeyName: 'estudiantes_perfil_id_fkey';
            columns: ['perfil_id'];
            isOneToOne: true;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      v_grupos: {
        Row: {
          anio_de_carrera: number | null;
          capacidad: number | null;
          created_at: string | null;
          dias: string | null;
          duracion: number | null;
          estado: Database['public']['Enums']['estado_de_grupo'] | null;
          fecha_fin: string | null;
          fecha_inicio: string | null;
          gestion: number | null;
          id: string | null;
          inscritos: number | null;
          modalidad: string | null;
          nombre: string | null;
          planes: number | null;
          programa_codigo: string | null;
          programa_nombre: string | null;
          programa_tipo: Database['public']['Enums']['tipo_de_programa'] | null;
          sede_id: string | null;
          sede_nombre: string | null;
          turno: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cohortes_programa_codigo_fkey';
            columns: ['programa_codigo'];
            isOneToOne: false;
            referencedRelation: 'programas';
            referencedColumns: ['codigo'];
          },
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      v_saldos_de_alumno: {
        Row: {
          apellidos: string | null;
          cargos_pendientes: number | null;
          codigo: string | null;
          dias_de_atraso: number | null;
          estudiante_id: string | null;
          nombres: string | null;
          sede_id: string | null;
          sede_nombre: string | null;
          telefono: string | null;
          total_pendiente: number | null;
          total_vencido: number | null;
          vence_el_mas_antiguo: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
      v_saldos_de_cargo: {
        Row: {
          anulado_en: string | null;
          aplicado: number | null;
          cliente: string | null;
          concepto_id: string | null;
          concepto_nombre: string | null;
          descripcion: string | null;
          dias_de_atraso: number | null;
          estado: string | null;
          estudiante_id: string | null;
          fecha: string | null;
          id: string | null;
          inscripcion_id: string | null;
          monto: number | null;
          origen: Database['public']['Enums']['origen_de_cargo'] | null;
          pendiente: number | null;
          registrado_en: string | null;
          sede_id: string | null;
          vence_el: string | null;
          vencido: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cargos_concepto_id_fkey';
            columns: ['concepto_id'];
            isOneToOne: false;
            referencedRelation: 'conceptos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'estudiantes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_alumnos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_alumno';
            referencedColumns: ['estudiante_id'];
          },
          {
            foreignKeyName: 'cargos_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'inscripciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      anular: {
        Args: {
          p_clave: string;
          p_id: string;
          p_motivo: string;
          p_tipo: string;
        };
        Returns: Json;
      };
      aprobar_solicitud: {
        Args: {
          p_clave: string;
          p_cohorte: string;
          p_documentos: string[];
          p_estudiante: string;
          p_paquete: Database['public']['Enums']['paquete_de_pago'];
          p_respuesta: string;
          p_solicitud: string;
        };
        Returns: Json;
      };
      caja_por_cerrar: { Args: { p_sede: string }; Returns: Json };
      cambiar_estado_de_inscripcion: {
        Args: {
          p_clave: string;
          p_estado: Database['public']['Enums']['estado_de_inscripcion'];
          p_inscripcion: string;
          p_motivo: string;
        };
        Returns: Json;
      };
      cerrar_caja: {
        Args: {
          p_clave: string;
          p_contado: number;
          p_observacion: string;
          p_retiro: number;
          p_saldo_inicial: number;
          p_sede: string;
        };
        Returns: Json;
      };
      cerrar_grupo: {
        Args: { p_clave: string; p_cohorte: string };
        Returns: Json;
      };
      crear_cargo: {
        Args: {
          p_clave: string;
          p_concepto: string;
          p_descripcion: string;
          p_estudiante: string;
          p_inscripcion: string;
          p_monto: number;
          p_prestamo: string;
          p_vence_el: string;
        };
        Returns: Json;
      };
      crear_estudiante: {
        Args: { p_clave: string; p_ficha: Json };
        Returns: Json;
      };
      generar_cuotas_de_grupo: {
        Args: { p_clave: string; p_cohorte: string };
        Returns: Json;
      };
      inscribir: {
        Args: {
          p_clave: string;
          p_cohorte: string;
          p_desde: string;
          p_documentos: string[];
          p_estudiante: string;
          p_ficha: Json;
          p_observaciones: string;
          p_paquete: Database['public']['Enums']['paquete_de_pago'];
          p_renueva_a: string;
        };
        Returns: Json;
      };
      mi_contexto: { Args: never; Returns: Json };
      registrar_cobro: {
        Args: {
          p_aplicaciones: Json;
          p_clave: string;
          p_estudiante: string;
          p_medio: Database['public']['Enums']['medio_de_pago'];
          p_monto: number;
          p_nota: string;
          p_referencia: string;
          p_sede: string;
          p_venta: Json;
        };
        Returns: Json;
      };
      registrar_gasto: {
        Args: {
          p_clave: string;
          p_comprobante: Database['public']['Enums']['tipo_de_comprobante'];
          p_concepto: string;
          p_descripcion: string;
          p_fecha: string;
          p_medio: Database['public']['Enums']['medio_de_pago'];
          p_monto: number;
          p_numero_comprobante: string;
          p_proveedor: string;
          p_referencia: string;
          p_sede: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      estado_de_grupo: 'planificado' | 'abierto' | 'en_curso' | 'cerrado';
      estado_de_inscripcion: 'inscrito' | 'retirado' | 'concluido';
      estado_de_solicitud:
        | 'pendiente'
        | 'en_revision'
        | 'aprobada'
        | 'rechazada'
        | 'cancelada';
      medio_de_pago: 'efectivo' | 'qr' | 'transferencia';
      naturaleza_de_concepto: 'ingreso' | 'gasto';
      origen_de_cargo: 'plan' | 'entrega' | 'venta_directa' | 'manual';
      paquete_de_pago: 'economico' | 'ahorrador';
      rol_de_usuario: 'administrador' | 'recepcion' | 'estudiante';
      tipo_de_comprobante:
        | 'factura'
        | 'recibo'
        | 'nota_de_venta'
        | 'sin_comprobante';
      tipo_de_programa: 'carrera' | 'curso' | 'curso_de_temporada';
      tipo_de_solicitud: 'inscripcion' | 'renovacion';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
