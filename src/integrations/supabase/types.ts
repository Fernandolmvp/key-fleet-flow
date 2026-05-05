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
            foreignKeyName: "al_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "al_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
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
            foreignKeyName: "branches_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      checklist_answers: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          photo_urls: string[]
          question_category: string | null
          question_id: string
          question_label: string
          question_type: Database["public"]["Enums"]["checklist_question_type"]
          run_id: string
          signature_url: string | null
          status: Database["public"]["Enums"]["checklist_answer_status"]
          updated_at: string
          value_bool: boolean | null
          value_choice: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_urls?: string[]
          question_category?: string | null
          question_id: string
          question_label: string
          question_type: Database["public"]["Enums"]["checklist_question_type"]
          run_id: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["checklist_answer_status"]
          updated_at?: string
          value_bool?: boolean | null
          value_choice?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_urls?: string[]
          question_category?: string | null
          question_id?: string
          question_label?: string
          question_type?: Database["public"]["Enums"]["checklist_question_type"]
          run_id?: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["checklist_answer_status"]
          updated_at?: string
          value_bool?: boolean | null
          value_choice?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ca_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ca_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ca_question_fk"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "checklist_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ca_run_fk"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "checklist_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "checklist_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_answers_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "checklist_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_questions: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          help_text: string | null
          id: string
          label: string
          max_value: number | null
          min_value: number | null
          options: Json
          question_type: Database["public"]["Enums"]["checklist_question_type"]
          require_note_when_fail: boolean
          require_photo_when_fail: boolean
          required: boolean
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          help_text?: string | null
          id?: string
          label: string
          max_value?: number | null
          min_value?: number | null
          options?: Json
          question_type?: Database["public"]["Enums"]["checklist_question_type"]
          require_note_when_fail?: boolean
          require_photo_when_fail?: boolean
          required?: boolean
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          help_text?: string | null
          id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          options?: Json
          question_type?: Database["public"]["Enums"]["checklist_question_type"]
          require_note_when_fail?: boolean
          require_photo_when_fail?: boolean
          required?: boolean
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cq_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cq_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cq_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_runs: {
        Row: {
          company_id: string
          completed_at: string | null
          conform_items: number
          created_at: string
          created_by: string | null
          driver_id: string | null
          due_date: string | null
          generated_maintenance_id: string | null
          id: string
          km_at_check: number | null
          na_items: number
          non_conform_items: number
          notes: string | null
          reference_month: string | null
          score: number | null
          signature_url: string | null
          signed_by_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["checklist_run_status"]
          template_id: string
          total_items: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          conform_items?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          due_date?: string | null
          generated_maintenance_id?: string | null
          id?: string
          km_at_check?: number | null
          na_items?: number
          non_conform_items?: number
          notes?: string | null
          reference_month?: string | null
          score?: number | null
          signature_url?: string | null
          signed_by_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["checklist_run_status"]
          template_id: string
          total_items?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          conform_items?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          due_date?: string | null
          generated_maintenance_id?: string | null
          id?: string
          km_at_check?: number | null
          na_items?: number
          non_conform_items?: number
          notes?: string | null
          reference_month?: string | null
          score?: number | null
          signature_url?: string | null
          signed_by_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["checklist_run_status"]
          template_id?: string
          total_items?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cr_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_maintenance_fk"
            columns: ["generated_maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          active: boolean
          auto_open_os: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          frequency: Database["public"]["Enums"]["checklist_frequency"]
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          auto_open_os?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["checklist_frequency"]
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          auto_open_os?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["checklist_frequency"]
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ct_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          group_id: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_groups: {
        Row: {
          created_at: string
          extra_company_fee: number
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_company_fee?: number
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_company_fee?: number
          id?: string
          name?: string
          owner_user_id?: string
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
            foreignKeyName: "company_members_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
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
            foreignKeyName: "cost_centers_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_extracted: Json
          ai_validation: Json
          company_id: string
          created_at: string
          created_by: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity"]
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          mime_type: string | null
          notes: string | null
          status: Database["public"]["Enums"]["document_status"]
          title: string | null
          updated_at: string
          validation_warning: string | null
        }
        Insert: {
          ai_extracted?: Json
          ai_validation?: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity"]
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          mime_type?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string | null
          updated_at?: string
          validation_warning?: string | null
        }
        Update: {
          ai_extracted?: Json
          ai_validation?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          document_number?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["document_entity"]
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          mime_type?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string | null
          updated_at?: string
          validation_warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      driver_onboarding_attempts: {
        Row: {
          attempted_at: string
          cpf: string
          id: string
          ip: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          cpf: string
          id?: string
          ip?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          cpf?: string
          id?: string
          ip?: string | null
          success?: boolean
        }
        Relationships: []
      }
      driver_otp_codes: {
        Row: {
          attempts: number
          code: string
          company_id: string
          consumed_at: string | null
          created_at: string
          created_ip: string | null
          driver_id: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code: string
          company_id: string
          consumed_at?: string | null
          created_at?: string
          created_ip?: string | null
          driver_id: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code?: string
          company_id?: string
          consumed_at?: string | null
          created_at?: string
          created_ip?: string | null
          driver_id?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "otp_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_status_history: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string
          driver_id: string
          id: string
          inactivated_at: string | null
          new_status: Database["public"]["Enums"]["driver_status"]
          previous_status: Database["public"]["Enums"]["driver_status"] | null
          reason: string | null
          termination_date: string | null
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string
          driver_id: string
          id?: string
          inactivated_at?: string | null
          new_status: Database["public"]["Enums"]["driver_status"]
          previous_status?: Database["public"]["Enums"]["driver_status"] | null
          reason?: string | null
          termination_date?: string | null
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          inactivated_at?: string | null
          new_status?: Database["public"]["Enums"]["driver_status"]
          previous_status?: Database["public"]["Enums"]["driver_status"] | null
          reason?: string | null
          termination_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dsh_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsh_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "dsh_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          assigned_vehicle_id: string | null
          auto_fuel_authorized: boolean
          birth_date: string | null
          branch_id: string | null
          cnh_category: string | null
          cnh_expires_at: string | null
          cnh_number: string | null
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          email_verified_at: string | null
          full_name: string
          has_assigned_vehicle: boolean
          id: string
          inactivated_at: string | null
          inactive_reason: string | null
          manager_user_id: string | null
          medical_exam_expires_at: string | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          phone_verified_at: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_vehicle_id?: string | null
          auto_fuel_authorized?: boolean
          birth_date?: string | null
          branch_id?: string | null
          cnh_category?: string | null
          cnh_expires_at?: string | null
          cnh_number?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name: string
          has_assigned_vehicle?: boolean
          id?: string
          inactivated_at?: string | null
          inactive_reason?: string | null
          manager_user_id?: string | null
          medical_exam_expires_at?: string | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_vehicle_id?: string | null
          auto_fuel_authorized?: boolean
          birth_date?: string | null
          branch_id?: string | null
          cnh_category?: string | null
          cnh_expires_at?: string | null
          cnh_number?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string
          has_assigned_vehicle?: boolean
          id?: string
          inactivated_at?: string | null
          inactive_reason?: string | null
          manager_user_id?: string | null
          medical_exam_expires_at?: string | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_assigned_vehicle_fk"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_branch_fk"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      fuel_authorization_items: {
        Row: {
          authorization_id: string
          company_id: string
          created_at: string
          description: string
          fuel_type: string | null
          id: string
          is_fuel: boolean
          quantity: number
          total_value: number
          unit_value: number
        }
        Insert: {
          authorization_id: string
          company_id: string
          created_at?: string
          description: string
          fuel_type?: string | null
          id?: string
          is_fuel?: boolean
          quantity?: number
          total_value?: number
          unit_value?: number
        }
        Update: {
          authorization_id?: string
          company_id?: string
          created_at?: string
          description?: string
          fuel_type?: string | null
          id?: string
          is_fuel?: boolean
          quantity?: number
          total_value?: number
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "fai_auth_fk"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "fuel_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fai_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fai_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_items_auth"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "fuel_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_items_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_items_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fuel_authorization_items_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "fuel_authorizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_authorizations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authorization_code: string | null
          cnpj_match: boolean | null
          company_id: string
          confirmed_at: string | null
          created_at: string
          driver_id: string | null
          estimated_liters: number | null
          estimated_value: number | null
          expires_at: string | null
          fuel_record_id: string | null
          fuel_station_id: string | null
          fuel_type: string | null
          id: string
          km_at_request: number | null
          km_photo_url: string | null
          notes: string | null
          plate_photo_url: string | null
          plate_recognized: string | null
          receipt_cnpj: string | null
          receipt_extracted: Json
          receipt_photo_url: string | null
          receipt_total: number | null
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
          cnpj_match?: boolean | null
          company_id: string
          confirmed_at?: string | null
          created_at?: string
          driver_id?: string | null
          estimated_liters?: number | null
          estimated_value?: number | null
          expires_at?: string | null
          fuel_record_id?: string | null
          fuel_station_id?: string | null
          fuel_type?: string | null
          id?: string
          km_at_request?: number | null
          km_photo_url?: string | null
          notes?: string | null
          plate_photo_url?: string | null
          plate_recognized?: string | null
          receipt_cnpj?: string | null
          receipt_extracted?: Json
          receipt_photo_url?: string | null
          receipt_total?: number | null
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
          cnpj_match?: boolean | null
          company_id?: string
          confirmed_at?: string | null
          created_at?: string
          driver_id?: string | null
          estimated_liters?: number | null
          estimated_value?: number | null
          expires_at?: string | null
          fuel_record_id?: string | null
          fuel_station_id?: string | null
          fuel_type?: string | null
          id?: string
          km_at_request?: number | null
          km_photo_url?: string | null
          notes?: string | null
          plate_photo_url?: string | null
          plate_recognized?: string | null
          receipt_cnpj?: string | null
          receipt_extracted?: Json
          receipt_photo_url?: string | null
          receipt_total?: number | null
          requested_at?: string
          requested_by?: string
          station_name?: string | null
          status?: Database["public"]["Enums"]["fuel_auth_status"]
          updated_at?: string
          used_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fa_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fa_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fa_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fa_record_fk"
            columns: ["fuel_record_id"]
            isOneToOne: false
            referencedRelation: "fuel_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fa_station_fk"
            columns: ["fuel_station_id"]
            isOneToOne: false
            referencedRelation: "fuel_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fa_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_record"
            columns: ["fuel_record_id"]
            isOneToOne: false
            referencedRelation: "fuel_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_station"
            columns: ["fuel_station_id"]
            isOneToOne: false
            referencedRelation: "fuel_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_auth_vehicle"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_records: {
        Row: {
          anomalies: Database["public"]["Enums"]["fuel_anomaly"][]
          anomaly_notes: string | null
          anomaly_severity: string | null
          authorization_id: string | null
          card_number: string | null
          city: string | null
          company_id: string
          cost_center_id: string | null
          cost_per_km: number | null
          created_at: string
          created_by: string | null
          dashboard_photo_url: string | null
          driver_id: string | null
          fuel_station_id: string | null
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
          source_origin: string
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
          authorization_id?: string | null
          card_number?: string | null
          city?: string | null
          company_id: string
          cost_center_id?: string | null
          cost_per_km?: number | null
          created_at?: string
          created_by?: string | null
          dashboard_photo_url?: string | null
          driver_id?: string | null
          fuel_station_id?: string | null
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
          source_origin?: string
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
          authorization_id?: string | null
          card_number?: string | null
          city?: string | null
          company_id?: string
          cost_center_id?: string | null
          cost_per_km?: number | null
          created_at?: string
          created_by?: string | null
          dashboard_photo_url?: string | null
          driver_id?: string | null
          fuel_station_id?: string | null
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
          source_origin?: string
          state?: string | null
          station_cnpj?: string | null
          station_name?: string | null
          total_value?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_fuel_records_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_records_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_fuel_records_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_records_station"
            columns: ["fuel_station_id"]
            isOneToOne: false
            referencedRelation: "fuel_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_records_vehicle"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fr_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fr_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fr_cost_center_fk"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fr_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fr_station_fk"
            columns: ["fuel_station_id"]
            isOneToOne: false
            referencedRelation: "fuel_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fr_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "fuel_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
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
      fuel_stations: {
        Row: {
          active: boolean
          address: string | null
          brand: string | null
          city: string | null
          cnpj: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          fuel_types: string[]
          id: string
          inactivated_at: string | null
          inactive_reason: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          brand?: string | null
          city?: string | null
          cnpj?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          fuel_types?: string[]
          id?: string
          inactivated_at?: string | null
          inactive_reason?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          brand?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          fuel_types?: string[]
          id?: string
          inactivated_at?: string | null
          inactive_reason?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fs_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fs_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      insurance_brokers: {
        Row: {
          active: boolean
          address: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          susep: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          susep?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          susep?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ib_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          ai_extracted: Json
          broker_id: string | null
          company_id: string
          coverage_summary: string | null
          created_at: string
          created_by: string | null
          deductible: number | null
          end_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          insurer_email: string | null
          insurer_name: string
          insurer_phone: string | null
          notes: string | null
          policy_number: string
          start_date: string | null
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          ai_extracted?: Json
          broker_id?: string | null
          company_id: string
          coverage_summary?: string | null
          created_at?: string
          created_by?: string | null
          deductible?: number | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          insurer_email?: string | null
          insurer_name: string
          insurer_phone?: string | null
          notes?: string | null
          policy_number: string
          start_date?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          ai_extracted?: Json
          broker_id?: string | null
          company_id?: string
          coverage_summary?: string | null
          created_at?: string
          created_by?: string | null
          deductible?: number | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          insurer_email?: string | null
          insurer_name?: string
          insurer_phone?: string | null
          notes?: string | null
          policy_number?: string
          start_date?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "insurance_brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_broker_fk"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "insurance_brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      insurance_policy_vehicles: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          endorsement_number: string | null
          id: string
          included_at: string
          inclusion_type: string
          notes: string | null
          policy_id: string
          removed_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          endorsement_number?: string | null
          id?: string
          included_at?: string
          inclusion_type?: string
          notes?: string | null
          policy_id: string
          removed_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          endorsement_number?: string | null
          id?: string
          included_at?: string
          inclusion_type?: string
          notes?: string | null
          policy_id?: string
          removed_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policy_vehicles_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipv_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipv_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ipv_policy_fk"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipv_vehicle_fk"
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
        Relationships: [
          {
            foreignKeyName: "mci_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mci_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mci_record_fk"
            columns: ["maintenance_record_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "mr_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mr_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mr_cost_center_fk"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mr_driver_fk"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mr_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "ms_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ms_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ms_completed_fk"
            columns: ["completed_record_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ms_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          is_custom: boolean
          monthly_price: number | null
          name: string
          slug: string
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
          vehicle_limit: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          is_custom?: boolean
          monthly_price?: number | null
          name: string
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
          vehicle_limit?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          is_custom?: boolean
          monthly_price?: number | null
          name?: string
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
          vehicle_limit?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_company_fk"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_current_company_fk"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "profiles_current_company_id_fkey"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_current_company_id_fkey"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          allowed: boolean
          company_id: string
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          tab: string | null
          updated_at: string
        }
        Insert: {
          action: string
          allowed?: boolean
          company_id: string
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          tab?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          company_id?: string
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          tab?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          company_id: string
          covers_period_end: string | null
          covers_period_start: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["sub_payment_method"]
          notes: string | null
          paid_at: string
          receipt_url: string | null
          recorded_by: string | null
          reference: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          company_id: string
          covers_period_end?: string | null
          covers_period_start?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["sub_payment_method"]
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          covers_period_end?: string | null
          covers_period_start?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["sub_payment_method"]
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sp_subscription_fk"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "sp_subscription_fk"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          company_id: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          custom_vehicle_limit: number | null
          group_id: string | null
          id: string
          last_payment_status: string | null
          monthly_amount: number | null
          notes: string | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_environment: string | null
          stripe_subscription_id: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          company_id?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          custom_vehicle_limit?: number | null
          group_id?: string | null
          id?: string
          last_payment_status?: string | null
          monthly_amount?: number | null
          notes?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_environment?: string | null
          stripe_subscription_id?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          company_id?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          custom_vehicle_limit?: number | null
          group_id?: string | null
          id?: string
          last_payment_status?: string | null
          monthly_amount?: number | null
          notes?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_environment?: string | null
          stripe_subscription_id?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_company_fk"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_company_fk"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sub_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "sub_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "tm_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tm_tire_fk"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "tires_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tires_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tires_vehicle_fk"
            columns: ["current_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "user_roles_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
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
        Relationships: [
          {
            foreignKeyName: "val_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "val_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "val_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          movement_type: string
          notes: string | null
          occurred_at: string | null
          reason: string | null
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          movement_type: string
          notes?: string | null
          occurred_at?: string | null
          reason?: string | null
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          movement_type?: string
          notes?: string | null
          occurred_at?: string | null
          reason?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          branch_id: string | null
          brand: string
          buyer_address: string | null
          buyer_doc: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          chassis: string | null
          color: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          crlv_city: string | null
          crlv_issue_date: string | null
          current_km: number
          documents: string[]
          fipe_value: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          has_tracker: boolean
          id: string
          inactivated_at: string | null
          inactive_notes: string | null
          inactive_reason: string | null
          insurance_expires_at: string | null
          insurance_policy: string | null
          insurance_responsible: string | null
          insurer: string | null
          licensing_year: number | null
          model: string
          notes: string | null
          owner_doc: string | null
          owner_name: string | null
          photos: string[]
          plate: string
          renavam: string | null
          responsible: string | null
          sale_city: string | null
          sale_contract_url: string | null
          sale_date: string | null
          sale_notary: string | null
          sale_notes: string | null
          sale_payment_method: string | null
          sale_state: string | null
          sale_value: number | null
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
          buyer_address?: string | null
          buyer_doc?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          chassis?: string | null
          color?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          crlv_city?: string | null
          crlv_issue_date?: string | null
          current_km?: number
          documents?: string[]
          fipe_value?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          has_tracker?: boolean
          id?: string
          inactivated_at?: string | null
          inactive_notes?: string | null
          inactive_reason?: string | null
          insurance_expires_at?: string | null
          insurance_policy?: string | null
          insurance_responsible?: string | null
          insurer?: string | null
          licensing_year?: number | null
          model: string
          notes?: string | null
          owner_doc?: string | null
          owner_name?: string | null
          photos?: string[]
          plate: string
          renavam?: string | null
          responsible?: string | null
          sale_city?: string | null
          sale_contract_url?: string | null
          sale_date?: string | null
          sale_notary?: string | null
          sale_notes?: string | null
          sale_payment_method?: string | null
          sale_state?: string | null
          sale_value?: number | null
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
          buyer_address?: string | null
          buyer_doc?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          chassis?: string | null
          color?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          crlv_city?: string | null
          crlv_issue_date?: string | null
          current_km?: number
          documents?: string[]
          fipe_value?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          has_tracker?: boolean
          id?: string
          inactivated_at?: string | null
          inactive_notes?: string | null
          inactive_reason?: string | null
          insurance_expires_at?: string | null
          insurance_policy?: string | null
          insurance_responsible?: string | null
          insurer?: string | null
          licensing_year?: number | null
          model?: string
          notes?: string | null
          owner_doc?: string | null
          owner_name?: string | null
          photos?: string[]
          plate?: string
          renavam?: string | null
          responsible?: string | null
          sale_city?: string | null
          sale_contract_url?: string | null
          sale_date?: string | null
          sale_notary?: string | null
          sale_notes?: string | null
          sale_payment_method?: string | null
          sale_state?: string | null
          sale_value?: number | null
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
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
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
      company_usage: {
        Row: {
          cancelled_at: string | null
          cnpj: string | null
          company_created_at: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          current_period_end: string | null
          drivers_count: number | null
          email: string | null
          last_payment_at: string | null
          members_count: number | null
          monthly_amount: number | null
          plan_id: string | null
          plan_name: string | null
          plan_slug: string | null
          subscription_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          suspended_at: string | null
          vehicle_limit: number | null
          vehicles_used: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_stripe_subscription: {
        Args: {
          _cancel_at_period_end: boolean
          _company_id: string
          _current_period_end: string
          _current_period_start: string
          _environment: string
          _stripe_customer_id: string
          _stripe_price_id: string
          _stripe_status: string
          _stripe_subscription_id: string
        }
        Returns: undefined
      }
      bootstrap_company: {
        Args: { _company_name: string; _full_name: string }
        Returns: string
      }
      bootstrap_super_admin: { Args: { _email: string }; Returns: string }
      calculate_group_monthly_amount: {
        Args: { _group_id: string }
        Returns: number
      }
      can_manage_fleet: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      generate_fuel_auth_code: { Args: never; Returns: string }
      get_company_vehicle_limit: {
        Args: { _company_id: string }
        Returns: number
      }
      has_permission:
        | {
            Args: {
              _action: string
              _company_id: string
              _module: string
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _action: string
              _company_id: string
              _module: string
              _tab?: string
              _user_id: string
            }
            Returns: boolean
          }
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      record_stripe_payment: {
        Args: {
          _amount: number
          _company_id: string
          _paid_at: string
          _stripe_invoice_id: string
          _stripe_payment_intent_id: string
        }
        Returns: undefined
      }
      seed_default_role_permissions: {
        Args: { _company_id: string }
        Returns: undefined
      }
      sync_vehicle_insurance_fields: {
        Args: { _vehicle_ids: string[] }
        Returns: undefined
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
        | "visualizador"
      axle_layout:
        | "moto_2"
        | "carro_4"
        | "truck_6"
        | "truck_10"
        | "carreta_18"
        | "custom"
      checklist_answer_status:
        | "conforme"
        | "nao_conforme"
        | "nao_aplicavel"
        | "pendente"
      checklist_frequency:
        | "unico"
        | "diario"
        | "semanal"
        | "mensal"
        | "trimestral"
        | "semestral"
        | "anual"
      checklist_question_type:
        | "sim_nao"
        | "multipla_escolha"
        | "numero"
        | "texto"
        | "foto"
        | "assinatura"
      checklist_run_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "reprovado"
        | "cancelado"
      document_entity: "vehicle" | "driver"
      document_status: "valido" | "vencendo" | "vencido" | "sem_validade"
      document_type:
        | "crlv"
        | "ipva"
        | "licenciamento"
        | "seguro"
        | "rastreador"
        | "laudo_veiculo"
        | "outro_veiculo"
        | "cnh"
        | "exame_medico"
        | "exame_toxicologico"
        | "curso_mopp"
        | "curso_transporte_passageiros"
        | "outro_motorista"
      driver_status:
        | "ativo"
        | "inativo"
        | "ferias"
        | "afastado"
        | "desligado"
        | "licenca_medica"
        | "suspenso"
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
      sub_payment_method:
        | "pix"
        | "boleto"
        | "transferencia"
        | "cartao"
        | "dinheiro"
        | "outro"
      subscription_status:
        | "aguardando_pagamento"
        | "ativa"
        | "atrasada"
        | "suspensa"
        | "cancelada"
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
        | "inativo"
        | "transferido"
        | "roubado_furtado"
        | "leiloado"
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
        "visualizador",
      ],
      axle_layout: [
        "moto_2",
        "carro_4",
        "truck_6",
        "truck_10",
        "carreta_18",
        "custom",
      ],
      checklist_answer_status: [
        "conforme",
        "nao_conforme",
        "nao_aplicavel",
        "pendente",
      ],
      checklist_frequency: [
        "unico",
        "diario",
        "semanal",
        "mensal",
        "trimestral",
        "semestral",
        "anual",
      ],
      checklist_question_type: [
        "sim_nao",
        "multipla_escolha",
        "numero",
        "texto",
        "foto",
        "assinatura",
      ],
      checklist_run_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "reprovado",
        "cancelado",
      ],
      document_entity: ["vehicle", "driver"],
      document_status: ["valido", "vencendo", "vencido", "sem_validade"],
      document_type: [
        "crlv",
        "ipva",
        "licenciamento",
        "seguro",
        "rastreador",
        "laudo_veiculo",
        "outro_veiculo",
        "cnh",
        "exame_medico",
        "exame_toxicologico",
        "curso_mopp",
        "curso_transporte_passageiros",
        "outro_motorista",
      ],
      driver_status: [
        "ativo",
        "inativo",
        "ferias",
        "afastado",
        "desligado",
        "licenca_medica",
        "suspenso",
      ],
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
      sub_payment_method: [
        "pix",
        "boleto",
        "transferencia",
        "cartao",
        "dinheiro",
        "outro",
      ],
      subscription_status: [
        "aguardando_pagamento",
        "ativa",
        "atrasada",
        "suspensa",
        "cancelada",
      ],
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
        "inativo",
        "transferido",
        "roubado_furtado",
        "leiloado",
      ],
    },
  },
} as const
