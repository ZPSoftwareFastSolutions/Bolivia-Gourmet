/**
 * GENERADO con `generate_typescript_types` (conector de Supabase) sobre el
 * proyecto `bnobhnmurzsnffdrxeck` el 2026-10-02, tras la migración 0016 (panel_tablero).
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
      articulos: {
        Row: {
          activo: boolean;
          categoria: string | null;
          codigo: string;
          controla_vencimiento: boolean;
          created_at: string;
          icono: string;
          id: string;
          nombre: string;
          precio_venta: number | null;
          registrado_por: string;
          stock_minimo: number;
          tipo: Database['public']['Enums']['tipo_de_articulo'];
          unidad: Database['public']['Enums']['unidad_de_medida'];
          updated_at: string;
          valuacion: string | null;
        };
        Insert: {
          activo?: boolean;
          categoria?: string | null;
          codigo: string;
          controla_vencimiento?: boolean;
          created_at?: string;
          icono?: string;
          id?: string;
          nombre: string;
          precio_venta?: number | null;
          registrado_por?: string;
          stock_minimo?: number;
          tipo: Database['public']['Enums']['tipo_de_articulo'];
          unidad?: Database['public']['Enums']['unidad_de_medida'];
          updated_at?: string;
          valuacion?: string | null;
        };
        Update: {
          activo?: boolean;
          categoria?: string | null;
          codigo?: string;
          controla_vencimiento?: boolean;
          created_at?: string;
          icono?: string;
          id?: string;
          nombre?: string;
          precio_venta?: number | null;
          registrado_por?: string;
          stock_minimo?: number;
          tipo?: Database['public']['Enums']['tipo_de_articulo'];
          unidad?: Database['public']['Enums']['unidad_de_medida'];
          updated_at?: string;
          valuacion?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'articulos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
        ];
      };
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
            foreignKeyName: 'cargos_entrega_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_entrega_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'v_entregas';
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
            foreignKeyName: 'cargos_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'v_sin_uniforme';
            referencedColumns: ['inscripcion_id'];
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
            foreignKeyName: 'cargos_prestamo_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'prestamos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_prestamo_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'v_prestamos_abiertos';
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
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
          revisado_en: string | null;
          revisado_por: string | null;
          revision_nota: string | null;
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
          revisado_en?: string | null;
          revisado_por?: string | null;
          revision_nota?: string | null;
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
          revisado_en?: string | null;
          revisado_por?: string | null;
          revision_nota?: string | null;
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
            foreignKeyName: 'cierres_de_caja_revisado_por_fkey';
            columns: ['revisado_por'];
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
          {
            foreignKeyName: 'cierres_de_caja_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'cierres_de_caja_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
          hora_fin: string | null;
          hora_inicio: string | null;
          id: string;
          inscripcion_desde: string | null;
          inscripcion_hasta: string | null;
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
          hora_fin?: string | null;
          hora_inicio?: string | null;
          id?: string;
          inscripcion_desde?: string | null;
          inscripcion_hasta?: string | null;
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
          hora_fin?: string | null;
          hora_inicio?: string | null;
          id?: string;
          inscripcion_desde?: string | null;
          inscripcion_hasta?: string | null;
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
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      compras: {
        Row: {
          anulacion_cierre_id: string | null;
          anulacion_motivo: string | null;
          anulado_el: string | null;
          anulado_en: string | null;
          anulado_por: string | null;
          cierre_id: string | null;
          comprobante: Database['public']['Enums']['tipo_de_comprobante'];
          fecha: string;
          fecha_documento: string | null;
          id: string;
          medio: Database['public']['Enums']['medio_de_pago'];
          numero: number;
          numero_comprobante: string | null;
          operacion_id: string;
          proveedor: string | null;
          referencia: string | null;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
          total: number;
        };
        Insert: {
          anulacion_cierre_id?: string | null;
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cierre_id?: string | null;
          comprobante?: Database['public']['Enums']['tipo_de_comprobante'];
          fecha: string;
          fecha_documento?: string | null;
          id?: string;
          medio: Database['public']['Enums']['medio_de_pago'];
          numero?: never;
          numero_comprobante?: string | null;
          operacion_id: string;
          proveedor?: string | null;
          referencia?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
          total: number;
        };
        Update: {
          anulacion_cierre_id?: string | null;
          anulacion_motivo?: string | null;
          anulado_el?: string | null;
          anulado_en?: string | null;
          anulado_por?: string | null;
          cierre_id?: string | null;
          comprobante?: Database['public']['Enums']['tipo_de_comprobante'];
          fecha?: string;
          fecha_documento?: string | null;
          id?: string;
          medio?: Database['public']['Enums']['medio_de_pago'];
          numero?: never;
          numero_comprobante?: string | null;
          operacion_id?: string;
          proveedor?: string | null;
          referencia?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'compras_anulacion_cierre_id_fkey';
            columns: ['anulacion_cierre_id'];
            isOneToOne: false;
            referencedRelation: 'cierres_de_caja';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compras_anulado_por_fkey';
            columns: ['anulado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compras_cierre_id_fkey';
            columns: ['cierre_id'];
            isOneToOne: false;
            referencedRelation: 'cierres_de_caja';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compras_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: true;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'compras_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compras_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compras_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'compras_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
      conteos: {
        Row: {
          clase: Database['public']['Enums']['clase_de_conteo'];
          fecha: string;
          id: string;
          lineas: Json;
          numero: number;
          operacion_id: string;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
        };
        Insert: {
          clase: Database['public']['Enums']['clase_de_conteo'];
          fecha: string;
          id?: string;
          lineas: Json;
          numero?: never;
          operacion_id: string;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
        };
        Update: {
          clase?: Database['public']['Enums']['clase_de_conteo'];
          fecha?: string;
          id?: string;
          lineas?: Json;
          numero?: never;
          operacion_id?: string;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conteos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'conteos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conteos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conteos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'conteos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      entregas: {
        Row: {
          cantidad: number;
          contexto: Database['public']['Enums']['contexto_de_entrega'];
          detalle: string | null;
          devuelta: number;
          fecha: string;
          id: string;
          inscripcion_id: string;
          numero: number;
          operacion_id: string;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
          variante_id: string;
        };
        Insert: {
          cantidad: number;
          contexto?: Database['public']['Enums']['contexto_de_entrega'];
          detalle?: string | null;
          devuelta?: number;
          fecha: string;
          id?: string;
          inscripcion_id: string;
          numero?: never;
          operacion_id: string;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
          variante_id: string;
        };
        Update: {
          cantidad?: number;
          contexto?: Database['public']['Enums']['contexto_de_entrega'];
          detalle?: string | null;
          devuelta?: number;
          fecha?: string;
          id?: string;
          inscripcion_id?: string;
          numero?: never;
          operacion_id?: string;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
          variante_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entregas_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'inscripciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entregas_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'v_sin_uniforme';
            referencedColumns: ['inscripcion_id'];
          },
          {
            foreignKeyName: 'entregas_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'entregas_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entregas_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entregas_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'entregas_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'entregas_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'entregas_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'entregas_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
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
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      existencias: {
        Row: {
          actualizado_en: string;
          disponible: number;
          prestado: number;
          sede_id: string;
          total: number | null;
          variante_id: string;
        };
        Insert: {
          actualizado_en?: string;
          disponible?: number;
          prestado?: number;
          sede_id: string;
          total?: number | null;
          variante_id: string;
        };
        Update: {
          actualizado_en?: string;
          disponible?: number;
          prestado?: number;
          sede_id?: string;
          total?: number | null;
          variante_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'existencias_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'existencias_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'existencias_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'existencias_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'existencias_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'existencias_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
      };
      existencias_costo: {
        Row: {
          sede_id: string;
          valor: number;
          variante_id: string;
        };
        Insert: {
          sede_id: string;
          valor?: number;
          variante_id: string;
        };
        Update: {
          sede_id?: string;
          valor?: number;
          variante_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'existencias_costo_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'existencias_costo_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'existencias_costo_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'existencias_costo_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'existencias_costo_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'existencias_costo_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
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
          {
            foreignKeyName: 'gastos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'gastos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
            foreignKeyName: 'inscripciones_renueva_a_fkey';
            columns: ['renueva_a'];
            isOneToOne: true;
            referencedRelation: 'v_sin_uniforme';
            referencedColumns: ['inscripcion_id'];
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
      lotes: {
        Row: {
          cantidad_inicial: number;
          cantidad_restante: number;
          fecha_ingreso: string;
          id: string;
          movimiento_entrada_id: string;
          origen: Database['public']['Enums']['origen_de_lote'];
          secuencia: number;
          sede_id: string;
          variante_id: string;
          vence_el: string | null;
        };
        Insert: {
          cantidad_inicial: number;
          cantidad_restante: number;
          fecha_ingreso: string;
          id?: string;
          movimiento_entrada_id: string;
          origen: Database['public']['Enums']['origen_de_lote'];
          secuencia?: never;
          sede_id: string;
          variante_id: string;
          vence_el?: string | null;
        };
        Update: {
          cantidad_inicial?: number;
          cantidad_restante?: number;
          fecha_ingreso?: string;
          id?: string;
          movimiento_entrada_id?: string;
          origen?: Database['public']['Enums']['origen_de_lote'];
          secuencia?: never;
          sede_id?: string;
          variante_id?: string;
          vence_el?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lotes_movimiento_entrada_id_fkey';
            columns: ['movimiento_entrada_id'];
            isOneToOne: true;
            referencedRelation: 'movimientos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lotes_movimiento_entrada_id_fkey';
            columns: ['movimiento_entrada_id'];
            isOneToOne: true;
            referencedRelation: 'v_kardex';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lotes_movimiento_entrada_id_fkey';
            columns: ['movimiento_entrada_id'];
            isOneToOne: true;
            referencedRelation: 'v_kardex_valorizado';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lotes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lotes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'lotes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'lotes_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'lotes_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'lotes_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
      };
      lotes_costo: {
        Row: {
          lote_id: string;
          valor_inicial: number;
          valor_restante: number;
        };
        Insert: {
          lote_id: string;
          valor_inicial: number;
          valor_restante: number;
        };
        Update: {
          lote_id?: string;
          valor_inicial?: number;
          valor_restante?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'lotes_costo_lote_id_fkey';
            columns: ['lote_id'];
            isOneToOne: true;
            referencedRelation: 'lotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lotes_costo_lote_id_fkey';
            columns: ['lote_id'];
            isOneToOne: true;
            referencedRelation: 'v_lotes_vigentes';
            referencedColumns: ['id'];
          },
        ];
      };
      movimiento_lotes: {
        Row: {
          cantidad: number;
          lote_id: string;
          movimiento_id: string;
          valor: number;
        };
        Insert: {
          cantidad: number;
          lote_id: string;
          movimiento_id: string;
          valor: number;
        };
        Update: {
          cantidad?: number;
          lote_id?: string;
          movimiento_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'movimiento_lotes_lote_id_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'lotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimiento_lotes_lote_id_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'v_lotes_vigentes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimiento_lotes_movimiento_id_fkey';
            columns: ['movimiento_id'];
            isOneToOne: false;
            referencedRelation: 'movimientos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimiento_lotes_movimiento_id_fkey';
            columns: ['movimiento_id'];
            isOneToOne: false;
            referencedRelation: 'v_kardex';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimiento_lotes_movimiento_id_fkey';
            columns: ['movimiento_id'];
            isOneToOne: false;
            referencedRelation: 'v_kardex_valorizado';
            referencedColumns: ['id'];
          },
        ];
      };
      movimientos: {
        Row: {
          anula_a: string | null;
          cantidad: number;
          cohorte_id: string | null;
          compra_id: string | null;
          conteo_id: string | null;
          delta_disponible: number;
          delta_prestado: number;
          destino: Database['public']['Enums']['destino_de_uso'] | null;
          detalle: string | null;
          disponible_resultante: number;
          entrega_id: string | null;
          fecha: string;
          id: string;
          lote_id: string | null;
          motivo_baja: Database['public']['Enums']['motivo_de_baja'] | null;
          numero: number;
          operacion_id: string;
          prestado_resultante: number;
          prestamo_id: string | null;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
          tipo: Database['public']['Enums']['tipo_de_movimiento'];
          variante_id: string;
        };
        Insert: {
          anula_a?: string | null;
          cantidad: number;
          cohorte_id?: string | null;
          compra_id?: string | null;
          conteo_id?: string | null;
          delta_disponible: number;
          delta_prestado?: number;
          destino?: Database['public']['Enums']['destino_de_uso'] | null;
          detalle?: string | null;
          disponible_resultante: number;
          entrega_id?: string | null;
          fecha: string;
          id?: string;
          lote_id?: string | null;
          motivo_baja?: Database['public']['Enums']['motivo_de_baja'] | null;
          numero?: never;
          operacion_id: string;
          prestado_resultante: number;
          prestamo_id?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
          tipo: Database['public']['Enums']['tipo_de_movimiento'];
          variante_id: string;
        };
        Update: {
          anula_a?: string | null;
          cantidad?: number;
          cohorte_id?: string | null;
          compra_id?: string | null;
          conteo_id?: string | null;
          delta_disponible?: number;
          delta_prestado?: number;
          destino?: Database['public']['Enums']['destino_de_uso'] | null;
          detalle?: string | null;
          disponible_resultante?: number;
          entrega_id?: string | null;
          fecha?: string;
          id?: string;
          lote_id?: string | null;
          motivo_baja?: Database['public']['Enums']['motivo_de_baja'] | null;
          numero?: never;
          operacion_id?: string;
          prestado_resultante?: number;
          prestamo_id?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
          tipo?: Database['public']['Enums']['tipo_de_movimiento'];
          variante_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'movimientos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'v_kardex';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'v_kardex_valorizado';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_compra_id_fkey';
            columns: ['compra_id'];
            isOneToOne: false;
            referencedRelation: 'compras';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_conteo_id_fkey';
            columns: ['conteo_id'];
            isOneToOne: false;
            referencedRelation: 'conteos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_entrega_id_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_entrega_id_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'v_entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_lote_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'lotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_lote_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'v_lotes_vigentes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'prestamos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'v_prestamos_abiertos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
      };
      movimientos_costo: {
        Row: {
          delta_valor: number;
          movimiento_id: string;
          valor_resultante: number;
        };
        Insert: {
          delta_valor: number;
          movimiento_id: string;
          valor_resultante: number;
        };
        Update: {
          delta_valor?: number;
          movimiento_id?: string;
          valor_resultante?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'movimientos_costo_movimiento_id_fkey';
            columns: ['movimiento_id'];
            isOneToOne: true;
            referencedRelation: 'movimientos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_costo_movimiento_id_fkey';
            columns: ['movimiento_id'];
            isOneToOne: true;
            referencedRelation: 'v_kardex';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_costo_movimiento_id_fkey';
            columns: ['movimiento_id'];
            isOneToOne: true;
            referencedRelation: 'v_kardex_valorizado';
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
          {
            foreignKeyName: 'pagos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'pagos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
          {
            foreignKeyName: 'perfiles_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'perfiles_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
      prestamos: {
        Row: {
          cantidad: number;
          cerrado_en: string | null;
          cohorte_id: string | null;
          devolver_el: string;
          devuelta: number;
          estudiante_id: string | null;
          fecha: string;
          id: string;
          numero: number;
          operacion_id: string;
          perdida: number;
          persona: string | null;
          registrado_en: string;
          registrado_por: string;
          sede_id: string;
          variante_id: string;
        };
        Insert: {
          cantidad: number;
          cerrado_en?: string | null;
          cohorte_id?: string | null;
          devolver_el: string;
          devuelta?: number;
          estudiante_id?: string | null;
          fecha: string;
          id?: string;
          numero?: never;
          operacion_id: string;
          perdida?: number;
          persona?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id: string;
          variante_id: string;
        };
        Update: {
          cantidad?: number;
          cerrado_en?: string | null;
          cohorte_id?: string | null;
          devolver_el?: string;
          devuelta?: number;
          estudiante_id?: string | null;
          fecha?: string;
          id?: string;
          numero?: never;
          operacion_id?: string;
          perdida?: number;
          persona?: string | null;
          registrado_en?: string;
          registrado_por?: string;
          sede_id?: string;
          variante_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prestamos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'estudiantes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_alumnos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_alumno';
            referencedColumns: ['estudiante_id'];
          },
          {
            foreignKeyName: 'prestamos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'prestamos_registrado_por_fkey';
            columns: ['registrado_por'];
            isOneToOne: false;
            referencedRelation: 'perfiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'prestamos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'prestamos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'prestamos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'prestamos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
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
          cohorte_id: string | null;
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
          cohorte_id?: string | null;
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
          cohorte_id?: string | null;
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
            foreignKeyName: 'solicitudes_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitudes_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
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
          {
            foreignKeyName: 'solicitudes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'solicitudes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      variantes: {
        Row: {
          activa: boolean;
          articulo_id: string;
          etiqueta: string;
          id: string;
          orden: number;
        };
        Insert: {
          activa?: boolean;
          articulo_id: string;
          etiqueta: string;
          id?: string;
          orden?: number;
        };
        Update: {
          activa?: boolean;
          articulo_id?: string;
          etiqueta?: string;
          id?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'articulos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_entregas';
            referencedColumns: ['articulo_id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['articulo_id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['articulo_id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_kardex';
            referencedColumns: ['articulo_id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_kardex_valorizado';
            referencedColumns: ['articulo_id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_lotes_vigentes';
            referencedColumns: ['articulo_id'];
          },
          {
            foreignKeyName: 'variantes_articulo_id_fkey';
            columns: ['articulo_id'];
            isOneToOne: false;
            referencedRelation: 'v_prestamos_abiertos';
            referencedColumns: ['articulo_id'];
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
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      v_entregas: {
        Row: {
          articulo_codigo: string | null;
          articulo_id: string | null;
          articulo_nombre: string | null;
          cantidad: number | null;
          contexto: Database['public']['Enums']['contexto_de_entrega'] | null;
          detalle: string | null;
          devuelta: number | null;
          en_poder: number | null;
          estudiante_id: string | null;
          etiqueta: string | null;
          fecha: string | null;
          id: string | null;
          inscripcion_id: string | null;
          numero: number | null;
          operacion_id: string | null;
          registrado_en: string | null;
          sede_id: string | null;
          sede_nombre: string | null;
          variante_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'entregas_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'inscripciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entregas_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'v_sin_uniforme';
            referencedColumns: ['inscripcion_id'];
          },
          {
            foreignKeyName: 'entregas_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'entregas_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entregas_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'entregas_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'entregas_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'entregas_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'entregas_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
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
        ];
      };
      v_existencias: {
        Row: {
          activo: boolean | null;
          articulo_id: string | null;
          categoria: string | null;
          codigo: string | null;
          controla_vencimiento: boolean | null;
          disponible: number | null;
          estado: string | null;
          etiqueta: string | null;
          icono: string | null;
          nombre: string | null;
          orden: number | null;
          precio_venta: number | null;
          prestado: number | null;
          proximo_vencimiento: string | null;
          sede_id: string | null;
          sede_nombre: string | null;
          stock_minimo: number | null;
          tipo: Database['public']['Enums']['tipo_de_articulo'] | null;
          total: number | null;
          unidad: Database['public']['Enums']['unidad_de_medida'] | null;
          valuacion: string | null;
          variante_id: string | null;
          vencido: number | null;
        };
        Relationships: [];
      };
      v_existencias_valorizadas: {
        Row: {
          activo: boolean | null;
          articulo_id: string | null;
          categoria: string | null;
          codigo: string | null;
          controla_vencimiento: boolean | null;
          costo_promedio: number | null;
          disponible: number | null;
          estado: string | null;
          etiqueta: string | null;
          icono: string | null;
          nombre: string | null;
          orden: number | null;
          precio_venta: number | null;
          prestado: number | null;
          proximo_vencimiento: string | null;
          sede_id: string | null;
          sede_nombre: string | null;
          stock_minimo: number | null;
          tipo: Database['public']['Enums']['tipo_de_articulo'] | null;
          total: number | null;
          unidad: Database['public']['Enums']['unidad_de_medida'] | null;
          valor: number | null;
          valuacion: string | null;
          variante_id: string | null;
          vencido: number | null;
        };
        Relationships: [];
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
          hora_fin: string | null;
          hora_inicio: string | null;
          id: string | null;
          inscripcion_desde: string | null;
          inscripcion_hasta: string | null;
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
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      v_kardex: {
        Row: {
          anula_a: string | null;
          anulado: boolean | null;
          articulo_id: string | null;
          articulo_nombre: string | null;
          cohorte_id: string | null;
          compra_id: string | null;
          conteo_id: string | null;
          delta_disponible: number | null;
          delta_prestado: number | null;
          destino: Database['public']['Enums']['destino_de_uso'] | null;
          detalle: string | null;
          disponible_resultante: number | null;
          entra: number | null;
          entrega_id: string | null;
          etiqueta: string | null;
          fecha: string | null;
          grupo_nombre: string | null;
          id: string | null;
          lote_id: string | null;
          motivo_baja: Database['public']['Enums']['motivo_de_baja'] | null;
          numero: number | null;
          operacion_id: string | null;
          prestado_resultante: number | null;
          prestamo_id: string | null;
          registrado_en: string | null;
          registrado_por_nombre: string | null;
          sale: number | null;
          sede_id: string | null;
          sede_nombre: string | null;
          tipo: Database['public']['Enums']['tipo_de_movimiento'] | null;
          unidad: Database['public']['Enums']['unidad_de_medida'] | null;
          variante_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'movimientos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'v_kardex';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'v_kardex_valorizado';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_compra_id_fkey';
            columns: ['compra_id'];
            isOneToOne: false;
            referencedRelation: 'compras';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_conteo_id_fkey';
            columns: ['conteo_id'];
            isOneToOne: false;
            referencedRelation: 'conteos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_entrega_id_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_entrega_id_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'v_entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_lote_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'lotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_lote_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'v_lotes_vigentes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'prestamos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'v_prestamos_abiertos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
      };
      v_kardex_valorizado: {
        Row: {
          anula_a: string | null;
          anulado: boolean | null;
          articulo_id: string | null;
          articulo_nombre: string | null;
          cohorte_id: string | null;
          compra_id: string | null;
          conteo_id: string | null;
          delta_disponible: number | null;
          delta_prestado: number | null;
          delta_valor: number | null;
          destino: Database['public']['Enums']['destino_de_uso'] | null;
          detalle: string | null;
          disponible_resultante: number | null;
          entra: number | null;
          entrega_id: string | null;
          etiqueta: string | null;
          fecha: string | null;
          grupo_nombre: string | null;
          id: string | null;
          lote_id: string | null;
          motivo_baja: Database['public']['Enums']['motivo_de_baja'] | null;
          numero: number | null;
          operacion_id: string | null;
          prestado_resultante: number | null;
          prestamo_id: string | null;
          registrado_en: string | null;
          registrado_por_nombre: string | null;
          sale: number | null;
          sede_id: string | null;
          sede_nombre: string | null;
          tipo: Database['public']['Enums']['tipo_de_movimiento'] | null;
          unidad: Database['public']['Enums']['unidad_de_medida'] | null;
          valor_resultante: number | null;
          variante_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'movimientos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'v_kardex';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_anula_a_fkey';
            columns: ['anula_a'];
            isOneToOne: true;
            referencedRelation: 'v_kardex_valorizado';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_compra_id_fkey';
            columns: ['compra_id'];
            isOneToOne: false;
            referencedRelation: 'compras';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_conteo_id_fkey';
            columns: ['conteo_id'];
            isOneToOne: false;
            referencedRelation: 'conteos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_entrega_id_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_entrega_id_fkey';
            columns: ['entrega_id'];
            isOneToOne: false;
            referencedRelation: 'v_entregas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_lote_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'lotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_lote_fkey';
            columns: ['lote_id'];
            isOneToOne: false;
            referencedRelation: 'v_lotes_vigentes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'prestamos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey';
            columns: ['prestamo_id'];
            isOneToOne: false;
            referencedRelation: 'v_prestamos_abiertos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'movimientos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'movimientos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
      };
      v_lotes_vigentes: {
        Row: {
          articulo_id: string | null;
          articulo_nombre: string | null;
          cantidad_inicial: number | null;
          cantidad_restante: number | null;
          dias_para_vencer: number | null;
          estado: string | null;
          fecha_ingreso: string | null;
          id: string | null;
          origen: Database['public']['Enums']['origen_de_lote'] | null;
          secuencia: number | null;
          sede_id: string | null;
          sede_nombre: string | null;
          unidad: Database['public']['Enums']['unidad_de_medida'] | null;
          variante_id: string | null;
          vence_el: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lotes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lotes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'lotes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'lotes_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'lotes_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'lotes_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
            referencedColumns: ['id'];
          },
        ];
      };
      v_prestamos_abiertos: {
        Row: {
          articulo_codigo: string | null;
          articulo_id: string | null;
          articulo_nombre: string | null;
          atrasado: boolean | null;
          cantidad: number | null;
          cohorte_id: string | null;
          destinatario: string | null;
          devolver_el: string | null;
          devuelta: number | null;
          dias_de_atraso: number | null;
          estudiante_apellidos: string | null;
          estudiante_codigo: string | null;
          estudiante_id: string | null;
          estudiante_nombres: string | null;
          estudiante_telefono: string | null;
          fecha: string | null;
          grupo_nombre: string | null;
          icono: string | null;
          id: string | null;
          numero: number | null;
          operacion_id: string | null;
          pendiente: number | null;
          perdida: number | null;
          persona: string | null;
          sede_id: string | null;
          sede_nombre: string | null;
          variante_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prestamos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'cohortes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_cohorte_id_fkey';
            columns: ['cohorte_id'];
            isOneToOne: false;
            referencedRelation: 'v_grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'estudiantes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_alumnos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_estudiante_id_fkey';
            columns: ['estudiante_id'];
            isOneToOne: false;
            referencedRelation: 'v_saldos_de_alumno';
            referencedColumns: ['estudiante_id'];
          },
          {
            foreignKeyName: 'prestamos_operacion_id_fkey';
            columns: ['operacion_id'];
            isOneToOne: false;
            referencedRelation: 'operaciones';
            referencedColumns: ['clave'];
          },
          {
            foreignKeyName: 'prestamos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prestamos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'prestamos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'prestamos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'prestamos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['variante_id'];
          },
          {
            foreignKeyName: 'prestamos_variante_id_fkey';
            columns: ['variante_id'];
            isOneToOne: false;
            referencedRelation: 'variantes';
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
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'estudiantes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
            foreignKeyName: 'cargos_inscripcion_id_fkey';
            columns: ['inscripcion_id'];
            isOneToOne: false;
            referencedRelation: 'v_sin_uniforme';
            referencedColumns: ['inscripcion_id'];
          },
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'cargos_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
          },
        ];
      };
      v_sin_uniforme: {
        Row: {
          apellidos: string | null;
          codigo: string | null;
          estudiante_id: string | null;
          grupo_nombre: string | null;
          inscripcion_id: string | null;
          inscrito_el: string | null;
          nombres: string | null;
          sede_id: string | null;
          sede_nombre: string | null;
          telefono: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'sedes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias';
            referencedColumns: ['sede_id'];
          },
          {
            foreignKeyName: 'cohortes_sede_id_fkey';
            columns: ['sede_id'];
            isOneToOne: false;
            referencedRelation: 'v_existencias_valorizadas';
            referencedColumns: ['sede_id'];
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
      dar_de_baja: {
        Args: {
          p_cantidad: string;
          p_clave: string;
          p_detalle: string;
          p_lote: string;
          p_motivo_baja: Database['public']['Enums']['motivo_de_baja'];
          p_sede: string;
          p_variante: string;
        };
        Returns: Json;
      };
      devolver_uniforme: {
        Args: {
          p_cambiar_por: string;
          p_cantidad: string;
          p_clave: string;
          p_entrega: string;
          p_motivo: string;
        };
        Returns: Json;
      };
      entregar_uniforme: {
        Args: {
          p_cargar: boolean;
          p_clave: string;
          p_cobro: Json;
          p_contexto: Database['public']['Enums']['contexto_de_entrega'];
          p_detalle: string;
          p_inscripcion: string;
          p_lineas: Json;
          p_sede: string;
        };
        Returns: Json;
      };
      generar_cuotas_de_grupo: {
        Args: { p_clave: string; p_cohorte: string };
        Returns: Json;
      };
      guardar_articulo: {
        Args: { p_clave: string; p_datos: Json; p_variantes: string[] };
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
      mis_grupos: { Args: never; Returns: Json };
      oferta_abierta: { Args: never; Returns: Json };
      prestar_utensilios: {
        Args: {
          p_clave: string;
          p_cohorte: string;
          p_devolver_el: string;
          p_estudiante: string;
          p_lineas: Json;
          p_persona: string;
          p_sede: string;
        };
        Returns: Json;
      };
      recibir_devolucion: {
        Args: { p_clave: string; p_lineas: Json };
        Returns: Json;
      };
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
      registrar_compra: {
        Args: {
          p_clave: string;
          p_comprobante: Database['public']['Enums']['tipo_de_comprobante'];
          p_fecha_documento: string;
          p_lineas: Json;
          p_medio: Database['public']['Enums']['medio_de_pago'];
          p_numero_comprobante: string;
          p_proveedor: string;
          p_referencia: string;
          p_sede: string;
        };
        Returns: Json;
      };
      registrar_conteo: {
        Args: { p_clave: string; p_lineas: Json; p_sede: string };
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
      registrar_saldo_inicial: {
        Args: { p_clave: string; p_lineas: Json; p_sede: string };
        Returns: Json;
      };
      resumen_de_deudores: { Args: { p_sede: string }; Returns: Json };
      resumen_del_mes: {
        Args: { p_mes: string; p_sede: string };
        Returns: Json;
      };
      revisar_arqueo: { Args: { p_cierre: string; p_clave: string; p_nota: string }; Returns: Json };
      tablero_de_administracion: { Args: { p_sede: string }; Returns: Json };
      usar_insumos: {
        Args: {
          p_clave: string;
          p_cohorte: string;
          p_destino: Database['public']['Enums']['destino_de_uso'];
          p_detalle: string;
          p_lineas: Json;
          p_sede: string;
        };
        Returns: Json;
      };
      variantes_con_movimientos: { Args: { p_sede: string }; Returns: string[] };
      verificar_cuadre: { Args: { p_sede: string }; Returns: Json };
    };
    Enums: {
      clase_de_conteo: 'conteo' | 'saldo_inicial';
      contexto_de_entrega:
        | 'inscripcion'
        | 'reposicion'
        | 'cambio_de_talla'
        | 'otro';
      destino_de_uso:
        | 'clase'
        | 'practica'
        | 'evento'
        | 'degustacion'
        | 'uso_interno'
        | 'otro';
      estado_de_grupo: 'planificado' | 'abierto' | 'en_curso' | 'cerrado';
      estado_de_inscripcion: 'inscrito' | 'retirado' | 'concluido';
      estado_de_solicitud:
        | 'pendiente'
        | 'en_revision'
        | 'aprobada'
        | 'rechazada'
        | 'cancelada';
      medio_de_pago: 'efectivo' | 'qr' | 'transferencia';
      motivo_de_baja:
        | 'vencimiento'
        | 'dano'
        | 'rotura'
        | 'perdida'
        | 'merma'
        | 'otro';
      naturaleza_de_concepto: 'ingreso' | 'gasto';
      origen_de_cargo: 'plan' | 'entrega' | 'venta_directa' | 'manual';
      origen_de_lote: 'compra' | 'saldo_inicial' | 'sobrante';
      paquete_de_pago: 'economico' | 'ahorrador';
      rol_de_usuario: 'administrador' | 'recepcion' | 'estudiante';
      tipo_de_articulo: 'insumo' | 'uniforme' | 'utensilio' | 'otro';
      tipo_de_comprobante:
        | 'factura'
        | 'recibo'
        | 'nota_de_venta'
        | 'sin_comprobante';
      tipo_de_movimiento:
        | 'saldo_inicial'
        | 'compra'
        | 'consumo'
        | 'entrega'
        | 'devolucion_entrega'
        | 'prestamo'
        | 'devolucion_prestamo'
        | 'baja'
        | 'ajuste_faltante'
        | 'ajuste_sobrante'
        | 'anulacion';
      tipo_de_programa: 'carrera' | 'curso' | 'curso_de_temporada';
      tipo_de_solicitud: 'inscripcion' | 'renovacion';
      unidad_de_medida: 'unidad' | 'kg' | 'g' | 'l' | 'ml' | 'paquete';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
