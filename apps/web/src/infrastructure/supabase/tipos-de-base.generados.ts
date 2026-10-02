/**
 * GENERADO con `generate_typescript_types` (conector de Supabase) sobre el
 * proyecto `bnobhnmurzsnffdrxeck` el 2026-10-02, tras la migración 0005 (panel_nucleo).
 * No editar a mano: regenerar tras cada migración que cambie el esquema.
 * Se conserva solo el tipo `Database` que consume el cliente.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
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
      [_ in never]: never;
    };
    Functions: {
      mi_contexto: { Args: never; Returns: Json };
    };
    Enums: {
      estado_de_solicitud: 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'cancelada';
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
