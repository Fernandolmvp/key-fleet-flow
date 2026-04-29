export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          company_id: string | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          city: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          branch_id: string | null
          cnh_category: string | null
          cnh_expires_at: string | null
          cnh_number: string | null
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          medical_exam_expires_at: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          cnh_category?: string | null
          cnh_expires_at?: string | null
          cnh_number?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          medical_exam_expires_at?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          cnh_category?: string | null
          cnh_expires_at?: string | null
          cnh_number?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          medical_exam_expires_at?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_authorizations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authorization_code: string | null
          company_id: string
          created_at: string
          driver_id: string | null
          estimated_liters: number | null
          estimated_value: number | null
          expires_at: string | null
          fuel_record_id: string | null
          fuel_type: string | null
          id: string
          notes: string | null
          requested_at: string
          requested_by: string
          station_name: string | null
          status: Database["public"]["Enums"]["fuel_auth_status"]
          updated_at: string
          used_at: string | null
          vehicle_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          authorization_code?: string | null
          company_id: string
          created_at?: string
          driver_id?: string | null
          estimated_liters?: number | null
          estimated_value?: number | null
          expires_at?: string | null
          fuel_record_id?: string | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          requested_at?: string
          requested_by: string
          station_name?: string | null
          status?: Database["public"]["Enums"]["fuel_auth_status"]
          updated_at?: string
          used_at?: string | null
          vehicle_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          authorization_code?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string | null
          estimated_liters?: number | null
          estimated_value?: number | null
          expires_at?: string | null
          fuel_record_id?: string | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          requested_at?: string
          requested_by?: string
          station_name?: string | null
          status?: Database["public"]["Enums"]["fuel_auth_status"]
          updated_at?: string
          used_at?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      fuel_records: {
        Row: {
          anomalies: Database["public"]["Enums"]["fuel_anomaly"][]
          anomaly_notes: string | null
          anomaly_severity: string | null
          card_number: string | null
          city: string | null
          company_id: string
          cost_center_id: string | null
          cost_per_km: number | null
          created_at: string
          created_by: string | null
          dashboard_photo_url: string | null
          driver_id: string | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          fueled_at: string
          full_tank: boolean
          id: string
          invoice_url: string | null
          km_at_fueling: number
          km_driven: number | null
          km_per_liter: number | null
          latitude: number | null
          liters: number
          longitude: number | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          price_per_liter: number
          pump_photo_url: string | null
          receipt_url: string | null
          state: string | null
          station_cnpj: string | null
          station_name: string | null
          total_value: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          anomalies?: Database["public"]["Enums"]["fuel_anomaly"][]
          anomaly_notes?: string | null
          anomaly_severity?: string | null
          card_number?: string | null
          city?: string | null
          company_id: string
          cost_center_id?: string | null
          cost_per_km?: number | null
          created_at?: string
          created_by?: string | null
          dashboard_photo_url?: string | null
          driver_id?: string | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          fueled_at?: string
          full_tank?: boolean
          id?: string
          invoice_url?: string | null
          km_at_fueling: number
          km_driven?: number | null
          km_per_liter?: number | null
          latitude?: number | null
          liters: number
          longitude?: number | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          price_per_liter: number
          pump_photo_url?: string | null
          receipt_url?: string | null
          state?: string | null
          station_cnpj?: string | null
          station_name?: string | null
          total_value: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          anomalies?: Database["public"]["Enums"]["fuel_anomaly"][]
          anomaly_notes?: string | null
          anomaly_severity?: string | null
          card_number?: string | null
          city?: string | null
          company_id?: string
          cost_center_id?: string | null
          cost_per_km?: number | null
          created_at?: string
          created_by?: string | null
          dashboard_photo_url?: string | null
          driver_id?: string | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          fueled_at?: string
          full_tank?: boolean
          id?: string
          invoice_url?: string | null
          km_at_fueling?: number
          km_driven?: number | null
          km_per_liter?: number | null
          latitude?: number | null
          liters?: number
          longitude?: number | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          price_per_liter?: number
          pump_photo_url?: string | null
          receipt_url?: string | null
          state?: string | null
          station_cnpj?: string | null
          station_name?: string | null
          total_value?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_checklist_items: {
        Row: {
          category: string | null
          checked: boolean
          company_id: string
          created_at: string
          id: string
          item_key: string
          item_label: string
          maintenance_record_id: string
          notes: string | null
        }
        Insert: {
          category?: string | null
          checked?: boolean
          company_id: string
          created_at?: string
          id?: string
          item_key: string
          item_label: string
          maintenance_record_id: string
          notes?: string | null
        }
        Update: {
          category?: string | null
          checked?: boolean
          company_id?: string
          created_at?: string
          id?: string
          item_key?: string
          item_label?: string
          maintenance_record_id?: string
          notes?: string | null
        }
        Relationships: []
      }
      maintenance_records: {
        Row: {
          attachments: string[]
          category: string | null
          city: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          driver_id: string | null
          id: string
          invoice_url: string | null
          km_at_service: number | null
          labor_value: number
          next_service_at: string | null
          next_service_km: number | null
          notes: string | null
          parts: Json
          parts_value: number
          service_at: string
          state: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          total_value: number
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
          vehicle_id: string
          workshop_cnpj: string | null
          workshop_name: string | null
        }
        Insert: {
          attachments?: string[]
          category?: string | null
          city?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          id?: string
          invoice_url?: string | null
          km_at_service?: number | null
          labor_value?: number
          next_service_at?: string | null
          next_service_km?: number | null
          notes?: string | null
          parts?: Json
          parts_value?: number
          service_at?: string
          state?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          total_value?: number
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id: string
          workshop_cnpj?: string | null
          workshop_name?: string | null
        }
        Update: {
          attachments?: string[]
          category?: string | null
          city?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          id?: string
          invoice_url?: string | null
          km_at_service?: number | null
          labor_value?: number
          next_service_at?: string | null
          next_service_km?: number | null
          notes?: string | null
          parts?: Json
          parts_value?: number
          service_at?: string
          state?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          total_value?: number
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id?: string
          workshop_cnpj?: string | null
          workshop_name?: string | null
        }
        Relationships: []
      }
      maintenance_schedules: {
        Row: {
          category: string
          company_id: string
          completed_record_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          interval_days: number | null
          interval_km: number | null
          status: Database["public"]["Enums"]["schedule_status"]
          target_date: string | null
          target_km: number | null
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          category: string
          company_id: string
          completed_record_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          status?: Database["public"]["Enums"]["schedule_status"]
          target_date?: string | null
          target_km?: number | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          category?: string
          company_id?: string
          completed_record_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          status?: Database["public"]["Enums"]["schedule_status"]
          target_date?: string | null
          target_km?: number | null
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_completed_record_id_fkey"
            columns: ["completed_record_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_company_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_company_id?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_company_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_company_id_fkey"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_movements: {
        Row: {
          company_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          from_position: string | null
          id: string
          invoice_url: string | null
          movement_type: Database["public"]["Enums"]["tire_movement_type"]
          notes: string | null
          occurred_at: string
          pressure_psi: number | null
          reason: string | null
          tire_id: string
          to_position: string | null
          tread_mm: number | null
          vehicle_id: string | null
          vehicle_km: number | null
        }
        Insert: {
          company_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          from_position?: string | null
          id?: string
          invoice_url?: string | null
          movement_type: Database["public"]["Enums"]["tire_movement_type"]
          notes?: string | null
          occurred_at?: string
          pressure_psi?: number | null
          reason?: string | null
          tire_id: string
          to_position?: string | null
          tread_mm?: number | null
          vehicle_id?: string | null
          vehicle_km?: number | null
        }
        Update: {
          company_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          from_position?: string | null
          id?: string
          invoice_url?: string | null
          movement_type?: Database["public"]["Enums"]["tire_movement_type"]
          notes?: string | null
          occurred_at?: string
          pressure_psi?: number | null
          reason?: string | null
          tire_id?: string
          to_position?: string | null
          tread_mm?: number | null
          vehicle_id?: string | null
          vehicle_km?: number | null
        }
        Relationships: []
      }
      tires: {
        Row: {
          attachments: string[]
          brand: string
          company_id: string
          created_at: string
          created_by: string | null
          current_position: string | null
          current_tread_mm: number | null
          current_vehicle_id: string | null
          dot: string | null
          id: string
          initial_tread_mm: number | null
          invoice_number: string | null
          invoice_url: string | null
          kind: Database["public"]["Enums"]["tire_kind"]
          km_accumulated: number
          km_target: number | null
          min_tread_mm: number | null
          model: string | null
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          recap_count: number
          serial: string | null
          size: string
          status: Database["public"]["Enums"]["tire_status"]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          attachments?: string[]
          brand: string
          company_id: string
          created_at?: string
          created_by?: string | null
          current_position?: string | null
          current_tread_mm?: number | null
          current_vehicle_id?: string | null
          dot?: string | null
          id?: string
          initial_tread_mm?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          kind?: Database["public"]["Enums"]["tire_kind"]
          km_accumulated?: number
          km_target?: number | null
          min_tread_mm?: number | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          recap_count?: number
          serial?: string | null
          size: string
          status?: Database["public"]["Enums"]["tire_status"]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: string[]
          brand?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_position?: string | null
          current_tread_mm?: number | null
          current_vehicle_id?: string | null
          dot?: string | null
          id?: string
          initial_tread_mm?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          kind?: Database["public"]["Enums"]["tire_kind"]
          km_accumulated?: number
          km_target?: number | null
          min_tread_mm?: number | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          recap_count?: number
          serial?: string | null
          size?: string
          status?: Database["public"]["Enums"]["tire_status"]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_axle_layouts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          layout: Database["public"]["Enums"]["axle_layout"]
          positions: string[]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          layout?: Database["public"]["Enums"]["axle_layout"]
          positions?: string[]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          layout?: Database["public"]["Enums"]["axle_layout"]
          positions?: string[]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          branch_id: string | null
          brand: string
          chassis: string | null
          color: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          current_km: number
          documents: string[]
          fipe_value: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          has_tracker: boolean
          id: string
          insurance_expires_at: string | null
          insurance_policy: string | null
          insurer: string | null
          model: string
          notes: string | null
          photos: string[]
          plate: string
          renavam: string | null
          responsible: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          tank_capacity: number | null
          updated_at: string
          vehicle_type: string | null
          year_manufacture: number | null
          year_model: number | null
        }
        Insert: {
          branch_id?: string | null
          brand: string
          chassis?: string | null
          color?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          current_km?: number
          documents?: string[]
          fipe_value?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          has_tracker?: boolean
          id?: string
          insurance_expires_at?: string | null
          insurance_policy?: string | null
          insurer?: string | null
          model: string
          notes?: string | null
          photos?: string[]
          plate: string
          renavam?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tank_capacity?: number | null
          updated_at?: string
          vehicle_type?: string | null
          year_manufacture?: number | null
          year_model?: number | null
        }
        Update: {
          branch_id?: string | null
          brand?: string
          chassis?: string | null
          color?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          current_km?: number
          documents?: string[]
          fipe_value?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          has_tracker?: boolean
          id?: string
          insurance_expires_at?: string | null
          insurance_policy?: string | null
          insurer?: string | null
          model?: string
          notes?: string | null
          photos?: string[]
          plate?: string
          renavam?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tank_capacity?: number | null
          updated_at?: string
          vehicle_type?: string | null
          year_manufacture?: number | null
          year_model?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_company: {
        Args: { _company_name: string; _full_name: string }
        Returns: string
      }
      can_manage_fleet: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      generate_fuel_auth_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor_frota"
        | "manutencao"
        | "financeiro"
        | "motorista"
        | "auditor"
      axle_layout:
        | "moto_2"
        | "carro_4"
        | "truck_6"
        | "truck_10"
        | "carreta_18"
        | "custom"
      driver_status: "ativo" | "inativo" | "ferias" | "afastado"
      fuel_anomaly:
        | "km_regressivo"
        | "consumo_alto"
        | "consumo_baixo"
        | "tanque_excedido"
        | "duplicado"
        | "valor_atipico"
        | "horario_suspeito"
        | "cidade_incomum"
      fuel_auth_status:
        | "pendente"
        | "aprovada"
        | "recusada"
        | "utilizada"
        | "expirada"
        | "cancelada"
      fuel_type:
        | "gasolina"
        | "etanol"
        | "diesel"
        | "diesel_s10"
        | "flex"
        | "gnv"
        | "eletrico"
        | "hibrido"
      maintenance_status:
        | "agendada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      maintenance_type: "preventiva" | "corretiva" | "pneus" | "sinistro"
      payment_method:
        | "cartao_frota"
        | "dinheiro"
        | "pix"
        | "credito"
        | "debito"
        | "faturado"
        | "outro"
      schedule_status: "pendente" | "proxima" | "vencida" | "concluida"
      tire_kind: "novo" | "recapado" | "remold"
      tire_movement_type:
        | "instalacao"
        | "remocao"
        | "rodizio"
        | "recapagem"
        | "descarte"
        | "calibragem"
        | "inspecao"
        | "compra"
      tire_status: "estoque" | "instalado" | "recapagem" | "descartado"
      vehicle_status:
        | "ativo"
        | "manutencao"
        | "vendido"
        | "parado"
        | "sinistrado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "gestor_frota",
        "manutencao",
        "financeiro",
        "motorista",
        "auditor",
      ],
      axle_layout: [
        "moto_2",
        "carro_4",
        "truck_6",
        "truck_10",
        "carreta_18",
        "custom",
      ],
      driver_status: ["ativo", "inativo", "ferias", "afastado"],
      fuel_anomaly: [
        "km_regressivo",
        "consumo_alto",
        "consumo_baixo",
        "tanque_excedido",
        "duplicado",
        "valor_atipico",
        "horario_suspeito",
        "cidade_incomum",
      ],
      fuel_auth_status: [
        "pendente",
        "aprovada",
        "recusada",
        "utilizada",
        "expirada",
        "cancelada",
      ],
      fuel_type: [
        "gasolina",
        "etanol",
        "diesel",
        "diesel_s10",
        "flex",
        "gnv",
        "eletrico",
        "hibrido",
      ],
      maintenance_status: [
        "agendada",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      maintenance_type: ["preventiva", "corretiva", "pneus", "sinistro"],
      payment_method: [
        "cartao_frota",
        "dinheiro",
        "pix",
        "credito",
        "debito",
        "faturado",
        "outro",
      ],
      schedule_status: ["pendente", "proxima", "vencida", "concluida"],
      tire_kind: ["novo", "recapado", "remold"],
      tire_movement_type: [
        "instalacao",
        "remocao",
        "rodizio",
        "recapagem",
        "descarte",
        "calibragem",
        "inspecao",
        "compra",
      ],
      tire_status: ["estoque", "instalado", "recapagem", "descartado"],
      vehicle_status: [
        "ativo",
        "manutencao",
        "vendido",
        "parado",
        "sinistrado",
      ],
    },
  },
} as const
