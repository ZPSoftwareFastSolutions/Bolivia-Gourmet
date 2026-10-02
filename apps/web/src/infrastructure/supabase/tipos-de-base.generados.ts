/**
 * GENERADO con `generate_typescript_types` (conector de Supabase) sobre el
 * proyecto `bnobhnmurzsnffdrxeck` el 2026-10-02, tras la migración 0007 (panel_alumnos_motor).
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
    };
    Functions: {
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
      cambiar_estado_de_inscripcion: {
        Args: {
          p_clave: string;
          p_estado: Database['public']['Enums']['estado_de_inscripcion'];
          p_inscripcion: string;
          p_motivo: string;
        };
        Returns: Json;
      };
      cerrar_grupo: {
        Args: { p_clave: string; p_cohorte: string };
        Returns: Json;
      };
      crear_estudiante: {
        Args: { p_clave: string; p_ficha: Json };
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
      naturaleza_de_concepto: 'ingreso' | 'gasto';
      paquete_de_pago: 'economico' | 'ahorrador';
      rol_de_usuario: 'administrador' | 'recepcion' | 'estudiante';
      tipo_de_programa: 'carrera' | 'curso' | 'curso_de_temporada';
      tipo_de_solicitud: 'inscripcion' | 'renovacion';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
