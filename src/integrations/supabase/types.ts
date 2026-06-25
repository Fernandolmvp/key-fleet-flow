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
      ai_feature_routing: {
        Row: {
          active: boolean
          created_at: string
          estimated_tokens: number
          fallback_model_id: string | null
          feature: string
          id: string
          primary_model_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          estimated_tokens?: number
          fallback_model_id?: string | null
          feature: string
          id?: string
          primary_model_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          estimated_tokens?: number
          fallback_model_id?: string | null
          feature?: string
          id?: string
          primary_model_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feature_routing_fallback_model_id_fkey"
            columns: ["fallback_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feature_routing_primary_model_id_fkey"
            columns: ["primary_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          input_cost_per_1k_tokens: number
          max_tokens: number | null
          model_id: string
          output_cost_per_1k_tokens: number
          provider_id: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          input_cost_per_1k_tokens?: number
          max_tokens?: number | null
          model_id: string
          output_cost_per_1k_tokens?: number
          provider_id: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          input_cost_per_1k_tokens?: number
          max_tokens?: number | null
          model_id?: string
          output_cost_per_1k_tokens?: number
          provider_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          active: boolean
          api_endpoint: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          priority: number
          secret_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_endpoint?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: number
          secret_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_endpoint?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: number
          secret_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_token_balance: {
        Row: {
          company_id: string
          extra_tokens_balance: number
          id: string
          last_plan_reset_at: string | null
          plan_tokens_remaining: number
          updated_at: string
        }
        Insert: {
          company_id: string
          extra_tokens_balance?: number
          id?: string
          last_plan_reset_at?: string | null
          plan_tokens_remaining?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          extra_tokens_balance?: number
          id?: string
          last_plan_reset_at?: string | null
          plan_tokens_remaining?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_token_packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          sort_order: number
          stripe_price_id: string | null
          tokens_amount: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price: number
          sort_order?: number
          stripe_price_id?: string | null
          tokens_amount: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          sort_order?: number
          stripe_price_id?: string | null
          tokens_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_token_purchases: {
        Row: {
          amount_paid: number
          company_id: string
          created_at: string
          id: string
          package_id: string
          purchased_by_user_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          tokens_purchased: number
          updated_at: string
        }
        Insert: {
          amount_paid: number
          company_id: string
          created_at?: string
          id?: string
          package_id: string
          purchased_by_user_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          tokens_purchased: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          company_id?: string
          created_at?: string
          id?: string
          package_id?: string
          purchased_by_user_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          tokens_purchased?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_token_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          feature: string
          id: string
          model: string | null
          model_id_used: string | null
          provider_id: string | null
          request_id: string | null
          response_time_ms: number | null
          source: string
          success: boolean
          tokens_input: number
          tokens_output: number
          tokens_total: number
          user_id: string | null
          was_fallback: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          feature: string
          id?: string
          model?: string | null
          model_id_used?: string | null
          provider_id?: string | null
          request_id?: string | null
          response_time_ms?: number | null
          source?: string
          success?: boolean
          tokens_input?: number
          tokens_output?: number
          tokens_total?: number
          user_id?: string | null
          was_fallback?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          feature?: string
          id?: string
          model?: string | null
          model_id_used?: string | null
          provider_id?: string | null
          request_id?: string | null
          response_time_ms?: number | null
          source?: string
          success?: boolean
          tokens_input?: number
          tokens_output?: number
          tokens_total?: number
          user_id?: string | null
          was_fallback?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_model_id_used_fkey"
            columns: ["model_id_used"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          ativa: boolean
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          nome: string
          scopes: string[]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          nome: string
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          nome?: string
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          company_id: string | null
          created_at: string
          error: string | null
          id: string
          key_name: string | null
          method: string
          path: string
          status: number
        }
        Insert: {
          api_key_id?: string | null
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          key_name?: string | null
          method: string
          path: string
          status: number
        }
        Update: {
          api_key_id?: string | null
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          key_name?: string | null
          method?: string
          path?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_write_audit: {
        Row: {
          action: string
          api_key_id: string | null
          company_id: string
          created_at: string
          entity_id: string | null
          id: string
          key_name: string | null
          payload: Json | null
          resource: string
        }
        Insert: {
          action: string
          api_key_id?: string | null
          company_id: string
          created_at?: string
          entity_id?: string | null
          id?: string
          key_name?: string | null
          payload?: Json | null
          resource: string
        }
        Update: {
          action?: string
          api_key_id?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          key_name?: string | null
          payload?: Json | null
          resource?: string
        }
        Relationships: []
      }
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
          km_override_by: string | null
          km_override_reason: string | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
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
      cnpj_cache: {
        Row: {
          cnpj: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cnpj: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cnpj?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          expense_auto_approval_limits: Json
          fuel_auth_code_ttl_minutes: number
          group_id: string | null
          id: string
          is_exempt_from_trial: boolean
          logo_url: string | null
          maintenance_default_interval_km: number | null
          name: string
          neighborhood: string | null
          onboarding_dismissed_at: string | null
          phone: string | null
          require_invoice_for_categories: string[]
          state: string | null
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          expense_auto_approval_limits?: Json
          fuel_auth_code_ttl_minutes?: number
          group_id?: string | null
          id?: string
          is_exempt_from_trial?: boolean
          logo_url?: string | null
          maintenance_default_interval_km?: number | null
          name: string
          neighborhood?: string | null
          onboarding_dismissed_at?: string | null
          phone?: string | null
          require_invoice_for_categories?: string[]
          state?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          expense_auto_approval_limits?: Json
          fuel_auth_code_ttl_minutes?: number
          group_id?: string | null
          id?: string
          is_exempt_from_trial?: boolean
          logo_url?: string | null
          maintenance_default_interval_km?: number | null
          name?: string
          neighborhood?: string | null
          onboarding_dismissed_at?: string | null
          phone?: string | null
          require_invoice_for_categories?: string[]
          state?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
      company_payment_methods: {
        Row: {
          assigned_to_driver_id: string | null
          assigned_to_vehicle_id: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          card_brand: string | null
          card_expiry_month: number | null
          card_expiry_year: number | null
          card_holder_name: string | null
          card_last_four_digits: string | null
          card_limit: number | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          method_type: string
          name: string
          notes: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
          updated_by: string | null
          voucher_card_number: string | null
          voucher_monthly_credit: number | null
          voucher_provider: string | null
        }
        Insert: {
          assigned_to_driver_id?: string | null
          assigned_to_vehicle_id?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_holder_name?: string | null
          card_last_four_digits?: string | null
          card_limit?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          method_type: string
          name: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          updated_by?: string | null
          voucher_card_number?: string | null
          voucher_monthly_credit?: number | null
          voucher_provider?: string | null
        }
        Update: {
          assigned_to_driver_id?: string | null
          assigned_to_vehicle_id?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_holder_name?: string | null
          card_last_four_digits?: string | null
          card_limit?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          method_type?: string
          name?: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          updated_by?: string | null
          voucher_card_number?: string | null
          voucher_monthly_credit?: number | null
          voucher_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_payment_methods_assigned_to_driver_id_fkey"
            columns: ["assigned_to_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_methods_assigned_to_vehicle_id_fkey"
            columns: ["assigned_to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_methods_company_id_fkey"
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
      coupon_redemptions: {
        Row: {
          applied_type: string
          applied_value: Json
          cnpj_at_redemption: string | null
          company_id: string
          coupon_id: string
          id: string
          redeemed_at: string
        }
        Insert: {
          applied_type: string
          applied_value?: Json
          cnpj_at_redemption?: string | null
          company_id: string
          coupon_id: string
          id?: string
          redeemed_at?: string
        }
        Update: {
          applied_type?: string
          applied_value?: Json
          cnpj_at_redemption?: string | null
          company_id?: string
          coupon_id?: string
          id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_amount: number | null
          discount_months: number | null
          discount_percent: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          restrict_to_cnpj: string | null
          trial_days: number | null
          type: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_amount?: number | null
          discount_months?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          restrict_to_cnpj?: string | null
          trial_days?: number | null
          type: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_amount?: number | null
          discount_months?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          restrict_to_cnpj?: string | null
          trial_days?: number | null
          type?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      detran_calendar: {
        Row: {
          categoria: string
          created_at: string
          estado: string
          final_placa: number
          id: string
          mes_vencimento: number
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          estado: string
          final_placa: number
          id?: string
          mes_vencimento: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          estado?: string
          final_placa?: number
          id?: string
          mes_vencimento?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_extracted: Json
          ai_validation: Json
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      driver_notifications: {
        Row: {
          company_id: string
          created_at: string
          driver_user_id: string
          id: string
          message: string
          notification_type: string
          read_at: string | null
          related_id: string | null
          related_type: string | null
          title: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_user_id: string
          id?: string
          message: string
          notification_type: string
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_user_id?: string
          id?: string
          message?: string
          notification_type?: string
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "driver_notifications_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
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
          address_complement: string | null
          address_number: string | null
          assigned_vehicle_id: string | null
          auto_fuel_authorized: boolean
          birth_date: string | null
          branch_id: string | null
          cep: string | null
          city: string | null
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
          neighborhood: string | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          phone_verified_at: string | null
          photo_url: string | null
          state: string | null
          status: Database["public"]["Enums"]["driver_status"]
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          assigned_vehicle_id?: string | null
          auto_fuel_authorized?: boolean
          birth_date?: string | null
          branch_id?: string | null
          cep?: string | null
          city?: string | null
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
          neighborhood?: string | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          photo_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          assigned_vehicle_id?: string | null
          auto_fuel_authorized?: boolean
          birth_date?: string | null
          branch_id?: string | null
          cep?: string | null
          city?: string | null
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
          neighborhood?: string | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          photo_url?: string | null
          state?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fipe_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      first_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          approved_amount: number | null
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
          km_override_by: string | null
          km_override_reason: string | null
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
          approved_amount?: number | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
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
          approved_amount?: number | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
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
          km_override_by: string | null
          km_override_reason: string | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
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
      fuel_station_prices: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          fuel_type: string
          id: string
          notes: string | null
          price_date: string
          price_per_liter: number
          station_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          fuel_type: string
          id?: string
          notes?: string | null
          price_date?: string
          price_per_liter: number
          station_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          fuel_type?: string
          id?: string
          notes?: string | null
          price_date?: string
          price_per_liter?: number
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_station_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_station_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fuel_station_prices_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "fuel_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_station_users: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string
          password_hash: string
          role: string
          station_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name: string
          password_hash: string
          role?: string
          station_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string
          password_hash?: string
          role?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_station_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_station_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fuel_station_users_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "fuel_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_stations: {
        Row: {
          accepted_payment_methods: string[] | null
          active: boolean
          address: string | null
          address_complement: string | null
          address_number: string | null
          anp_register_number: string | null
          average_fuel_price_diesel: number | null
          average_fuel_price_etanol: number | null
          average_fuel_price_gasolina: number | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          brand: string | null
          cep: string | null
          city: string | null
          cnae_code: string | null
          cnpj: string | null
          cnpj_verified: boolean | null
          company_id: string
          contact_name: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          discount_pct_diesel: number | null
          discount_pct_etanol: number | null
          discount_pct_gasolina: number | null
          document_type: string | null
          documents_urls: Json | null
          fleet_card_providers: string[] | null
          fuel_types: string[]
          has_24h_operation: boolean | null
          has_automatic_reading: boolean | null
          has_car_wash: boolean | null
          has_convenience_store: boolean | null
          has_lubrification: boolean | null
          has_restaurant: boolean | null
          has_truck_lane: boolean | null
          id: string
          inactivated_at: string | null
          inactive_reason: string | null
          internal_notes: string | null
          invoice_type: string | null
          issues_invoice: boolean | null
          latitude: number | null
          longitude: number | null
          min_purchase_amount: number | null
          municipal_registration: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          operating_hours: Json | null
          payment_terms: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          preferred: boolean | null
          rating: number | null
          simples_nacional: boolean | null
          state: string | null
          state_registration: string | null
          supports_fleet_card: boolean | null
          tags: string[] | null
          total_amount: number | null
          total_fuelings: number | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          accepted_payment_methods?: string[] | null
          active?: boolean
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          anp_register_number?: string | null
          average_fuel_price_diesel?: number | null
          average_fuel_price_etanol?: number | null
          average_fuel_price_gasolina?: number | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          brand?: string | null
          cep?: string | null
          city?: string | null
          cnae_code?: string | null
          cnpj?: string | null
          cnpj_verified?: boolean | null
          company_id: string
          contact_name?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          discount_pct_diesel?: number | null
          discount_pct_etanol?: number | null
          discount_pct_gasolina?: number | null
          document_type?: string | null
          documents_urls?: Json | null
          fleet_card_providers?: string[] | null
          fuel_types?: string[]
          has_24h_operation?: boolean | null
          has_automatic_reading?: boolean | null
          has_car_wash?: boolean | null
          has_convenience_store?: boolean | null
          has_lubrification?: boolean | null
          has_restaurant?: boolean | null
          has_truck_lane?: boolean | null
          id?: string
          inactivated_at?: string | null
          inactive_reason?: string | null
          internal_notes?: string | null
          invoice_type?: string | null
          issues_invoice?: boolean | null
          latitude?: number | null
          longitude?: number | null
          min_purchase_amount?: number | null
          municipal_registration?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          operating_hours?: Json | null
          payment_terms?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred?: boolean | null
          rating?: number | null
          simples_nacional?: boolean | null
          state?: string | null
          state_registration?: string | null
          supports_fleet_card?: boolean | null
          tags?: string[] | null
          total_amount?: number | null
          total_fuelings?: number | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          accepted_payment_methods?: string[] | null
          active?: boolean
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          anp_register_number?: string | null
          average_fuel_price_diesel?: number | null
          average_fuel_price_etanol?: number | null
          average_fuel_price_gasolina?: number | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          brand?: string | null
          cep?: string | null
          city?: string | null
          cnae_code?: string | null
          cnpj?: string | null
          cnpj_verified?: boolean | null
          company_id?: string
          contact_name?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          discount_pct_diesel?: number | null
          discount_pct_etanol?: number | null
          discount_pct_gasolina?: number | null
          document_type?: string | null
          documents_urls?: Json | null
          fleet_card_providers?: string[] | null
          fuel_types?: string[]
          has_24h_operation?: boolean | null
          has_automatic_reading?: boolean | null
          has_car_wash?: boolean | null
          has_convenience_store?: boolean | null
          has_lubrification?: boolean | null
          has_restaurant?: boolean | null
          has_truck_lane?: boolean | null
          id?: string
          inactivated_at?: string | null
          inactive_reason?: string | null
          internal_notes?: string | null
          invoice_type?: string | null
          issues_invoice?: boolean | null
          latitude?: number | null
          longitude?: number | null
          min_purchase_amount?: number | null
          municipal_registration?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          operating_hours?: Json | null
          payment_terms?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred?: boolean | null
          rating?: number | null
          simples_nacional?: boolean | null
          state?: string | null
          state_registration?: string | null
          supports_fleet_card?: boolean | null
          tags?: string[] | null
          total_amount?: number | null
          total_fuelings?: number | null
          trade_name?: string | null
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
          address_complement: string | null
          address_number: string | null
          cep: string | null
          city: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          legal_name: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          possible_duplicate_of: string | null
          state: string | null
          susep: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          possible_duplicate_of?: string | null
          state?: string | null
          susep?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          possible_duplicate_of?: string | null
          state?: string | null
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
          {
            foreignKeyName: "insurance_brokers_possible_duplicate_of_fkey"
            columns: ["possible_duplicate_of"]
            isOneToOne: false
            referencedRelation: "insurance_brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          ai_extracted: Json
          broker_id: string | null
          company_id: string
          coverage_summary: string | null
          coverage_type: string | null
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
          coverage_type?: string | null
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
          coverage_type?: string | null
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
          individual_premium: number | null
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
          individual_premium?: number | null
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
          individual_premium?: number | null
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
      leads: {
        Row: {
          cal_booking_id: string | null
          cnpj: string | null
          converted_company_id: string | null
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          maior_dor: string | null
          nome: string | null
          notes: string | null
          origem: string
          quantidade_veiculos: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cal_booking_id?: string | null
          cnpj?: string | null
          converted_company_id?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          maior_dor?: string | null
          nome?: string | null
          notes?: string | null
          origem?: string
          quantidade_veiculos?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cal_booking_id?: string | null
          cnpj?: string | null
          converted_company_id?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          maior_dor?: string | null
          nome?: string | null
          notes?: string | null
          origem?: string
          quantidade_veiculos?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
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
          km_override_by: string | null
          km_override_reason: string | null
          labor_value: number
          maintenance_category: string | null
          next_service_at: string | null
          next_service_km: number | null
          notes: string | null
          parts: Json
          parts_value: number
          service_at: string
          service_provider_rating: number | null
          state: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          total_value: number
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
          vehicle_id: string
          warranty_until: string | null
          workshop_cnpj: string | null
          workshop_id: string | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
          labor_value?: number
          maintenance_category?: string | null
          next_service_at?: string | null
          next_service_km?: number | null
          notes?: string | null
          parts?: Json
          parts_value?: number
          service_at?: string
          service_provider_rating?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          total_value?: number
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id: string
          warranty_until?: string | null
          workshop_cnpj?: string | null
          workshop_id?: string | null
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
          km_override_by?: string | null
          km_override_reason?: string | null
          labor_value?: number
          maintenance_category?: string | null
          next_service_at?: string | null
          next_service_km?: number | null
          notes?: string | null
          parts?: Json
          parts_value?: number
          service_at?: string
          service_provider_rating?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          total_value?: number
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_id?: string
          warranty_until?: string | null
          workshop_cnpj?: string | null
          workshop_id?: string | null
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
      maintenance_requests: {
        Row: {
          audio_url: string | null
          company_id: string
          created_at: string
          driver_id: string | null
          driver_user_id: string
          estimated_cost: number | null
          gestor_notes: string | null
          id: string
          km_at_report: number | null
          maintenance_record_id: string | null
          photos_urls: string[]
          problem_category: string
          problem_description: string
          rejection_reason: string | null
          reported_latitude: number | null
          reported_location_text: string | null
          reported_longitude: number | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_date: string | null
          scheduled_workshop_id: string | null
          severity_self_assessment: string
          status: string
          updated_at: string
          vehicle_id: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          company_id: string
          created_at?: string
          driver_id?: string | null
          driver_user_id: string
          estimated_cost?: number | null
          gestor_notes?: string | null
          id?: string
          km_at_report?: number | null
          maintenance_record_id?: string | null
          photos_urls?: string[]
          problem_category: string
          problem_description: string
          rejection_reason?: string | null
          reported_latitude?: number | null
          reported_location_text?: string | null
          reported_longitude?: number | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          scheduled_workshop_id?: string | null
          severity_self_assessment: string
          status?: string
          updated_at?: string
          vehicle_id: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string | null
          driver_user_id?: string
          estimated_cost?: number | null
          gestor_notes?: string | null
          id?: string
          km_at_report?: number | null
          maintenance_record_id?: string | null
          photos_urls?: string[]
          problem_category?: string
          problem_description?: string
          rejection_reason?: string | null
          reported_latitude?: number | null
          reported_location_text?: string | null
          reported_longitude?: number | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          scheduled_workshop_id?: string | null
          severity_self_assessment?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_maintenance_record_id_fkey"
            columns: ["maintenance_record_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_scheduled_workshop_id_fkey"
            columns: ["scheduled_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_vehicle_id_fkey"
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
          scheduled_time: string | null
          scheduled_workshop_id: string | null
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
          scheduled_time?: string | null
          scheduled_workshop_id?: string | null
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
          scheduled_time?: string | null
          scheduled_workshop_id?: string | null
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
            foreignKeyName: "maintenance_schedules_scheduled_workshop_id_fkey"
            columns: ["scheduled_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
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
      maintenance_work_orders: {
        Row: {
          actual_amount_difference: number | null
          actual_amount_total: number | null
          after_photos_urls: string[]
          before_photos_urls: string[]
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          driver_id: string | null
          estimated_duration_hours: number | null
          execution_completed_at: string | null
          execution_started_at: string | null
          execution_status: string
          final_notes: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          km_at_completion: number | null
          km_at_scheduling: number | null
          km_at_start: number | null
          maintenance_record_id: string | null
          maintenance_request_id: string | null
          maintenance_schedule_id: string | null
          origin_type: string
          os_number: string | null
          parts_used: Json
          payment_due_date: string | null
          payment_method: string | null
          payment_paid_at: string | null
          payment_receipt_url: string | null
          payment_status: string
          priority: string
          problem_category: string[]
          quote_amount_labor: number | null
          quote_amount_other: number | null
          quote_amount_parts: number | null
          quote_amount_total: number | null
          quote_approval_notes: string | null
          quote_approved_at: string | null
          quote_approved_by: string | null
          quote_attachment_url: string | null
          quote_details: Json
          quote_notes: string | null
          quote_rejected_reason: string | null
          quote_sent_at: string | null
          quote_status: string
          quote_validity_days: number | null
          quote_warranty_days: number | null
          rated_at: string | null
          rated_by: string | null
          rating: number | null
          rating_comment: string | null
          scheduled_date: string
          scheduled_time: string | null
          services_performed: Json
          title: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
          warranty_until: string | null
          workshop_id: string
        }
        Insert: {
          actual_amount_difference?: number | null
          actual_amount_total?: number | null
          after_photos_urls?: string[]
          before_photos_urls?: string[]
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          estimated_duration_hours?: number | null
          execution_completed_at?: string | null
          execution_started_at?: string | null
          execution_status?: string
          final_notes?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          km_at_completion?: number | null
          km_at_scheduling?: number | null
          km_at_start?: number | null
          maintenance_record_id?: string | null
          maintenance_request_id?: string | null
          maintenance_schedule_id?: string | null
          origin_type: string
          os_number?: string | null
          parts_used?: Json
          payment_due_date?: string | null
          payment_method?: string | null
          payment_paid_at?: string | null
          payment_receipt_url?: string | null
          payment_status?: string
          priority?: string
          problem_category?: string[]
          quote_amount_labor?: number | null
          quote_amount_other?: number | null
          quote_amount_parts?: number | null
          quote_amount_total?: number | null
          quote_approval_notes?: string | null
          quote_approved_at?: string | null
          quote_approved_by?: string | null
          quote_attachment_url?: string | null
          quote_details?: Json
          quote_notes?: string | null
          quote_rejected_reason?: string | null
          quote_sent_at?: string | null
          quote_status?: string
          quote_validity_days?: number | null
          quote_warranty_days?: number | null
          rated_at?: string | null
          rated_by?: string | null
          rating?: number | null
          rating_comment?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          services_performed?: Json
          title: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
          warranty_until?: string | null
          workshop_id: string
        }
        Update: {
          actual_amount_difference?: number | null
          actual_amount_total?: number | null
          after_photos_urls?: string[]
          before_photos_urls?: string[]
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          estimated_duration_hours?: number | null
          execution_completed_at?: string | null
          execution_started_at?: string | null
          execution_status?: string
          final_notes?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          km_at_completion?: number | null
          km_at_scheduling?: number | null
          km_at_start?: number | null
          maintenance_record_id?: string | null
          maintenance_request_id?: string | null
          maintenance_schedule_id?: string | null
          origin_type?: string
          os_number?: string | null
          parts_used?: Json
          payment_due_date?: string | null
          payment_method?: string | null
          payment_paid_at?: string | null
          payment_receipt_url?: string | null
          payment_status?: string
          priority?: string
          problem_category?: string[]
          quote_amount_labor?: number | null
          quote_amount_other?: number | null
          quote_amount_parts?: number | null
          quote_amount_total?: number | null
          quote_approval_notes?: string | null
          quote_approved_at?: string | null
          quote_approved_by?: string | null
          quote_attachment_url?: string | null
          quote_details?: Json
          quote_notes?: string | null
          quote_rejected_reason?: string | null
          quote_sent_at?: string | null
          quote_status?: string
          quote_validity_days?: number | null
          quote_warranty_days?: number | null
          rated_at?: string | null
          rated_by?: string | null
          rating?: number | null
          rating_comment?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          services_performed?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
          warranty_until?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_maintenance_record_id_fkey"
            columns: ["maintenance_record_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_insurance_costs: {
        Row: {
          company_id: string
          created_at: string
          days_in_month_covered: number
          id: string
          individual_premium: number
          insurance_policy_id: string
          insurance_policy_vehicle_id: string
          monthly_cost: number
          policy_end_date: string
          policy_start_date: string
          reference_month: number
          reference_year: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days_in_month_covered: number
          id?: string
          individual_premium: number
          insurance_policy_id: string
          insurance_policy_vehicle_id: string
          monthly_cost: number
          policy_end_date: string
          policy_start_date: string
          reference_month: number
          reference_year: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days_in_month_covered?: number
          id?: string
          individual_premium?: number
          insurance_policy_id?: string
          insurance_policy_vehicle_id?: string
          monthly_cost?: number
          policy_end_date?: string
          policy_start_date?: string
          reference_month?: number
          reference_year?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_insurance_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_insurance_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "monthly_insurance_costs_insurance_policy_id_fkey"
            columns: ["insurance_policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_insurance_costs_insurance_policy_vehicle_id_fkey"
            columns: ["insurance_policy_vehicle_id"]
            isOneToOne: false
            referencedRelation: "insurance_policy_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_insurance_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invitations: {
        Row: {
          accepted_at: string | null
          attempts: number
          cancelled_at: string | null
          company_id: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          kind: string
          name: string
          partner_id: string
          partner_type: string
          resent_count: number
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          attempts?: number
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          kind?: string
          name: string
          partner_id: string
          partner_type: string
          resent_count?: number
          role?: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          attempts?: number
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          kind?: string
          name?: string
          partner_id?: string
          partner_type?: string
          resent_count?: number
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      pending_coupon_discounts: {
        Row: {
          company_id: string
          coupon_id: string
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          months_remaining: number
          updated_at: string
        }
        Insert: {
          company_id: string
          coupon_id: string
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          months_remaining?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          coupon_id?: string
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          months_remaining?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_coupon_discounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_coupon_discounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "pending_coupon_discounts_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
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
          stripe_price_id_annual: string | null
          tokens_monthly: number
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
          stripe_price_id_annual?: string | null
          tokens_monthly?: number
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
          stripe_price_id_annual?: string | null
          tokens_monthly?: number
          updated_at?: string
          vehicle_limit?: number | null
        }
        Relationships: []
      }
      policy_external_plates: {
        Row: {
          ai_plate: string
          company_id: string
          created_at: string
          id: string
          marked_at: string
          marked_by: string | null
          normalized_plate: string
          policy_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          ai_plate: string
          company_id: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          normalized_plate: string
          policy_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          ai_plate?: string
          company_id?: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          normalized_plate?: string
          policy_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_external_plates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_external_plates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "policy_external_plates_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
        ]
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
          trial_plan_snapshot: string | null
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
          trial_plan_snapshot?: string | null
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
          trial_plan_snapshot?: string | null
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
      suppliers: {
        Row: {
          address_complement: string | null
          address_number: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          blocked_reason: string | null
          city: string | null
          cnae_code: string | null
          cnpj_verified: boolean
          cofins: string | null
          company_id: string
          contact_name: string | null
          contact_role: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          delivery_days_avg: number | null
          discount_pct: number
          document_number: string | null
          document_type: string | null
          documents_urls: Json
          email: string | null
          icms_rate: number | null
          id: string
          invoice_type: string | null
          iss_rate: number | null
          issues_invoice: boolean
          latitude: number | null
          longitude: number | null
          minimum_order: number | null
          municipal_registration: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          pis: string | null
          pix_key: string | null
          pix_key_type: string | null
          preferred: boolean
          rating: number | null
          simples_nacional: boolean | null
          state: string | null
          state_registration: string | null
          status: string
          street: string | null
          supplier_category: string[]
          tags: string[]
          total_amount: number
          total_orders: number
          trade_name: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          blocked_reason?: string | null
          city?: string | null
          cnae_code?: string | null
          cnpj_verified?: boolean
          cofins?: string | null
          company_id: string
          contact_name?: string | null
          contact_role?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          delivery_days_avg?: number | null
          discount_pct?: number
          document_number?: string | null
          document_type?: string | null
          documents_urls?: Json
          email?: string | null
          icms_rate?: number | null
          id?: string
          invoice_type?: string | null
          iss_rate?: number | null
          issues_invoice?: boolean
          latitude?: number | null
          longitude?: number | null
          minimum_order?: number | null
          municipal_registration?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          pis?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred?: boolean
          rating?: number | null
          simples_nacional?: boolean | null
          state?: string | null
          state_registration?: string | null
          status?: string
          street?: string | null
          supplier_category?: string[]
          tags?: string[]
          total_amount?: number
          total_orders?: number
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          blocked_reason?: string | null
          city?: string | null
          cnae_code?: string | null
          cnpj_verified?: boolean
          cofins?: string | null
          company_id?: string
          contact_name?: string | null
          contact_role?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          delivery_days_avg?: number | null
          discount_pct?: number
          document_number?: string | null
          document_type?: string | null
          documents_urls?: Json
          email?: string | null
          icms_rate?: number | null
          id?: string
          invoice_type?: string | null
          iss_rate?: number | null
          issues_invoice?: boolean
          latitude?: number | null
          longitude?: number | null
          minimum_order?: number | null
          municipal_registration?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          pis?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          preferred?: boolean
          rating?: number | null
          simples_nacional?: boolean | null
          state?: string | null
          state_registration?: string | null
          status?: string
          street?: string | null
          supplier_category?: string[]
          tags?: string[]
          total_amount?: number
          total_orders?: number
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      traffic_fines: {
        Row: {
          additional_photos_urls: string[] | null
          ai_confidence: number | null
          ai_extracted: Json
          amount: number | null
          aviso_photo_url: string | null
          city: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount: number | null
          driver_id: string | null
          driver_indicated_at: string | null
          driver_indication_deadline: string | null
          driver_indication_method: string | null
          driver_responsibility_signed: boolean
          driver_responsibility_signed_at: string | null
          due_date: string | null
          equipment: string | null
          external_id: string | null
          external_source: string
          fine_code: string | null
          fine_type: string | null
          id: string
          infraction_date: string
          infraction_time: string | null
          last_sync_at: string | null
          license_points: number
          location: string | null
          notes: string | null
          notification_number: string | null
          notification_photo_url: string | null
          notification_received_date: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_receipt_url: string | null
          record_type: string
          recourse_deadline: string | null
          recourse_document_url: string | null
          recourse_filed_at: string | null
          recourse_notes: string | null
          recourse_result: string | null
          recourse_result_date: string | null
          severity: string | null
          state: string | null
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          additional_photos_urls?: string[] | null
          ai_confidence?: number | null
          ai_extracted?: Json
          amount?: number | null
          aviso_photo_url?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          driver_id?: string | null
          driver_indicated_at?: string | null
          driver_indication_deadline?: string | null
          driver_indication_method?: string | null
          driver_responsibility_signed?: boolean
          driver_responsibility_signed_at?: string | null
          due_date?: string | null
          equipment?: string | null
          external_id?: string | null
          external_source?: string
          fine_code?: string | null
          fine_type?: string | null
          id?: string
          infraction_date?: string
          infraction_time?: string | null
          last_sync_at?: string | null
          license_points?: number
          location?: string | null
          notes?: string | null
          notification_number?: string | null
          notification_photo_url?: string | null
          notification_received_date?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          record_type?: string
          recourse_deadline?: string | null
          recourse_document_url?: string | null
          recourse_filed_at?: string | null
          recourse_notes?: string | null
          recourse_result?: string | null
          recourse_result_date?: string | null
          severity?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          additional_photos_urls?: string[] | null
          ai_confidence?: number | null
          ai_extracted?: Json
          amount?: number | null
          aviso_photo_url?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          driver_id?: string | null
          driver_indicated_at?: string | null
          driver_indication_deadline?: string | null
          driver_indication_method?: string | null
          driver_responsibility_signed?: boolean
          driver_responsibility_signed_at?: string | null
          due_date?: string | null
          equipment?: string | null
          external_id?: string | null
          external_source?: string
          fine_code?: string | null
          fine_type?: string | null
          id?: string
          infraction_date?: string
          infraction_time?: string | null
          last_sync_at?: string | null
          license_points?: number
          location?: string | null
          notes?: string | null
          notification_number?: string | null
          notification_photo_url?: string | null
          notification_received_date?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_receipt_url?: string | null
          record_type?: string
          recourse_deadline?: string | null
          recourse_document_url?: string | null
          recourse_filed_at?: string | null
          recourse_notes?: string | null
          recourse_result?: string | null
          recourse_result_date?: string | null
          severity?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      trip_advances: {
        Row: {
          advance_date: string
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          driver_confirmation_method: string | null
          driver_confirmation_notes: string | null
          driver_confirmed_at: string | null
          driver_id: string
          driver_signature_url: string | null
          gestor_signature_url: string | null
          id: string
          notes: string | null
          payment_method_used: string
          receipt_number: string | null
          receipt_url: string | null
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          advance_date?: string
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          driver_confirmation_method?: string | null
          driver_confirmation_notes?: string | null
          driver_confirmed_at?: string | null
          driver_id: string
          driver_signature_url?: string | null
          gestor_signature_url?: string | null
          id?: string
          notes?: string | null
          payment_method_used?: string
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          driver_confirmation_method?: string | null
          driver_confirmation_notes?: string | null
          driver_confirmed_at?: string | null
          driver_id?: string
          driver_signature_url?: string | null
          gestor_signature_url?: string | null
          id?: string
          notes?: string | null
          payment_method_used?: string
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "trip_advances_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_advances_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_code_seq: {
        Row: {
          company_id: string
          last_number: number
          year: number
        }
        Insert: {
          company_id: string
          last_number?: number
          year: number
        }
        Update: {
          company_id?: string
          last_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_code_seq_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_code_seq_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          additional_photos_urls: string[]
          amount: number
          approved_by: string | null
          auto_approved: boolean
          city: string | null
          company_card_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          driver_id: string
          expense_category: string
          expense_date: string
          expense_time: string | null
          has_invoice: boolean
          id: string
          invoice_issued_at: string | null
          invoice_number: string | null
          invoice_type: string | null
          invoice_url: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          payment_method: string
          receipt_url: string
          reimbursement_adjusted_amount: number | null
          reimbursement_approved_at: string | null
          reimbursement_approved_by: string | null
          reimbursement_paid_at: string | null
          reimbursement_paid_method: string | null
          reimbursement_rejection_reason: string | null
          reimbursement_status: string
          requires_reimbursement: boolean
          state: string | null
          supplier_document: string | null
          supplier_name: string | null
          trip_id: string
          updated_at: string
          within_budget_limit: boolean | null
        }
        Insert: {
          additional_photos_urls?: string[]
          amount: number
          approved_by?: string | null
          auto_approved?: boolean
          city?: string | null
          company_card_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id: string
          expense_category: string
          expense_date: string
          expense_time?: string | null
          has_invoice?: boolean
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          invoice_type?: string | null
          invoice_url?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method: string
          receipt_url: string
          reimbursement_adjusted_amount?: number | null
          reimbursement_approved_at?: string | null
          reimbursement_approved_by?: string | null
          reimbursement_paid_at?: string | null
          reimbursement_paid_method?: string | null
          reimbursement_rejection_reason?: string | null
          reimbursement_status?: string
          requires_reimbursement?: boolean
          state?: string | null
          supplier_document?: string | null
          supplier_name?: string | null
          trip_id: string
          updated_at?: string
          within_budget_limit?: boolean | null
        }
        Update: {
          additional_photos_urls?: string[]
          amount?: number
          approved_by?: string | null
          auto_approved?: boolean
          city?: string | null
          company_card_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string
          expense_category?: string
          expense_date?: string
          expense_time?: string | null
          has_invoice?: boolean
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          invoice_type?: string | null
          invoice_url?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method?: string
          receipt_url?: string
          reimbursement_adjusted_amount?: number | null
          reimbursement_approved_at?: string | null
          reimbursement_approved_by?: string | null
          reimbursement_paid_at?: string | null
          reimbursement_paid_method?: string | null
          reimbursement_rejection_reason?: string | null
          reimbursement_status?: string
          requires_reimbursement?: boolean
          state?: string | null
          supplier_document?: string | null
          supplier_name?: string | null
          trip_id?: string
          updated_at?: string
          within_budget_limit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_company_card_id_fkey"
            columns: ["company_card_id"]
            isOneToOne: false
            referencedRelation: "company_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "trip_expenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_reimbursements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          driver_id: string
          expense_ids: string[]
          id: string
          notes: string | null
          paid_at: string | null
          paid_method: string | null
          payment_proof_url: string | null
          status: string
          total_amount: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          driver_id: string
          expense_ids?: string[]
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          payment_proof_url?: string | null
          status?: string
          total_amount: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string
          expense_ids?: string[]
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          payment_proof_url?: string | null
          status?: string
          total_amount?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_reimbursements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_reimbursements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "trip_reimbursements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_reimbursements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_end_at: string | null
          actual_km: number | null
          actual_start_at: string | null
          allowed_payment_method_ids: string[]
          balance_to_return: number
          budget_by_category: Json
          budget_total: number | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          destination_city: string | null
          destination_state: string | null
          driver_id: string | null
          estimated_km: number | null
          id: string
          km_at_end: number | null
          km_at_start: number | null
          notes: string | null
          origin_city: string | null
          origin_state: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string
          settlement_date: string | null
          settlement_notes: string | null
          status: string
          title: string
          total_advance_cash: number
          total_reimbursable: number
          total_spent_card: number
          total_spent_cash: number
          total_spent_other: number
          trip_code: string | null
          trip_type: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          waypoints: Json
        }
        Insert: {
          actual_end_at?: string | null
          actual_km?: number | null
          actual_start_at?: string | null
          allowed_payment_method_ids?: string[]
          balance_to_return?: number
          budget_by_category?: Json
          budget_total?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_city?: string | null
          destination_state?: string | null
          driver_id?: string | null
          estimated_km?: number | null
          id?: string
          km_at_end?: number | null
          km_at_start?: number | null
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date: string
          settlement_date?: string | null
          settlement_notes?: string | null
          status?: string
          title: string
          total_advance_cash?: number
          total_reimbursable?: number
          total_spent_card?: number
          total_spent_cash?: number
          total_spent_other?: number
          trip_code?: string | null
          trip_type?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          waypoints?: Json
        }
        Update: {
          actual_end_at?: string | null
          actual_km?: number | null
          actual_start_at?: string | null
          allowed_payment_method_ids?: string[]
          balance_to_return?: number
          budget_by_category?: Json
          budget_total?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_city?: string | null
          destination_state?: string | null
          driver_id?: string | null
          estimated_km?: number | null
          id?: string
          km_at_end?: number | null
          km_at_start?: number | null
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string
          settlement_date?: string | null
          settlement_notes?: string | null
          status?: string
          title?: string
          total_advance_cash?: number
          total_reimbursable?: number
          total_spent_card?: number
          total_spent_cash?: number
          total_spent_other?: number
          trip_code?: string | null
          trip_type?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
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
      vehicle_expenses: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          expense_category: string
          expense_date: string
          id: string
          paid: boolean
          receipt_url: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          expense_category: string
          expense_date?: string
          id?: string
          paid?: boolean
          receipt_url?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          expense_category?: string
          expense_date?: string
          id?: string
          paid?: boolean
          receipt_url?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_fipe_history: {
        Row: {
          company_id: string
          created_at: string
          depreciation_pct: number | null
          fipe_code: string | null
          fipe_value: number
          id: string
          queried_at: string
          queried_by: string | null
          reference_month: string | null
          source: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          depreciation_pct?: number | null
          fipe_code?: string | null
          fipe_value: number
          id?: string
          queried_at?: string
          queried_by?: string | null
          reference_month?: string | null
          source?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          depreciation_pct?: number | null
          fipe_code?: string | null
          fipe_value?: number
          id?: string
          queried_at?: string
          queried_by?: string | null
          reference_month?: string | null
          source?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fipe_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fipe_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "vehicle_fipe_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_incidents: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          driver_id: string | null
          id: string
          incident_date: string
          incident_type: string
          insurance_claimed: boolean
          km_at_incident: number | null
          location: string | null
          photos_urls: string[] | null
          police_report_number: string | null
          repair_cost: number | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          id?: string
          incident_date?: string
          incident_type: string
          insurance_claimed?: boolean
          km_at_incident?: number | null
          location?: string | null
          photos_urls?: string[] | null
          police_report_number?: string | null
          repair_cost?: number | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_id?: string | null
          id?: string
          incident_date?: string
          incident_type?: string
          insurance_claimed?: boolean
          km_at_incident?: number | null
          location?: string | null
          photos_urls?: string[] | null
          police_report_number?: string | null
          repair_cost?: number | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
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
      vehicle_policy_manual_matches: {
        Row: {
          ai_plate: string
          can_be_revoked: boolean
          company_id: string
          created_at: string
          id: string
          matched_at: string
          matched_by: string | null
          normalized_plate: string
          notes: string | null
          policy_id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          ai_plate: string
          can_be_revoked?: boolean
          company_id: string
          created_at?: string
          id?: string
          matched_at?: string
          matched_by?: string | null
          normalized_plate: string
          notes?: string | null
          policy_id: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          ai_plate?: string
          can_be_revoked?: boolean
          company_id?: string
          created_at?: string
          id?: string
          matched_at?: string
          matched_by?: string | null
          normalized_plate?: string
          notes?: string | null
          policy_id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_policy_manual_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_policy_manual_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "vehicle_policy_manual_matches_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_policy_manual_matches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
          consumption_tolerance_pct: number | null
          cost_center_id: string | null
          created_at: string
          crlv_city: string | null
          crlv_issue_date: string | null
          current_km: number
          documents: string[]
          expected_consumption_kml: number | null
          fipe_brand_code: string | null
          fipe_code: string | null
          fipe_model_code: string | null
          fipe_reference_month: string | null
          fipe_value: number | null
          fipe_value_updated_at: string | null
          fipe_year_code: string | null
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
          licensing_uf: string | null
          licensing_year: number | null
          model: string
          normalized_plate: string | null
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
          consumption_tolerance_pct?: number | null
          cost_center_id?: string | null
          created_at?: string
          crlv_city?: string | null
          crlv_issue_date?: string | null
          current_km?: number
          documents?: string[]
          expected_consumption_kml?: number | null
          fipe_brand_code?: string | null
          fipe_code?: string | null
          fipe_model_code?: string | null
          fipe_reference_month?: string | null
          fipe_value?: number | null
          fipe_value_updated_at?: string | null
          fipe_year_code?: string | null
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
          licensing_uf?: string | null
          licensing_year?: number | null
          model: string
          normalized_plate?: string | null
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
          consumption_tolerance_pct?: number | null
          cost_center_id?: string | null
          created_at?: string
          crlv_city?: string | null
          crlv_issue_date?: string | null
          current_km?: number
          documents?: string[]
          expected_consumption_kml?: number | null
          fipe_brand_code?: string | null
          fipe_code?: string | null
          fipe_model_code?: string | null
          fipe_reference_month?: string | null
          fipe_value?: number | null
          fipe_value_updated_at?: string | null
          fipe_year_code?: string | null
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
          licensing_uf?: string | null
          licensing_year?: number | null
          model?: string
          normalized_plate?: string | null
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
      work_order_messages: {
        Row: {
          attachments_urls: string[]
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_role: string
          work_order_id: string
          workshop_id: string
        }
        Insert: {
          attachments_urls?: string[]
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_role: string
          work_order_id: string
          workshop_id: string
        }
        Update: {
          attachments_urls?: string[]
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_role?: string
          work_order_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "work_order_messages_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "maintenance_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_messages_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_sequences: {
        Row: {
          company_id: string
          last_number: number
          year: number
        }
        Insert: {
          company_id: string
          last_number?: number
          year: number
        }
        Update: {
          company_id?: string
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      workshop_users: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          invite_accepted_at: string | null
          invite_sent_at: string | null
          invite_token: string | null
          is_active: boolean
          last_login_at: string | null
          name: string
          password_hash: string | null
          password_set_at: string | null
          role: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          is_active?: boolean
          last_login_at?: string | null
          name: string
          password_hash?: string | null
          password_set_at?: string | null
          role?: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          is_active?: boolean
          last_login_at?: string | null
          name?: string
          password_hash?: string | null
          password_set_at?: string | null
          role?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_usage"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "workshop_users_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address_complement: string | null
          address_number: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          blocked_reason: string | null
          city: string | null
          cnae_code: string | null
          cnpj_verified: boolean
          cofins: string | null
          company_id: string
          contact_name: string | null
          contact_role: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          discount_pct: number
          document_number: string | null
          document_type: string | null
          documents_urls: Json
          email: string | null
          has_portal_access: boolean
          icms_rate: number | null
          id: string
          invoice_type: string | null
          iss_rate: number | null
          issues_invoice: boolean
          latitude: number | null
          longitude: number | null
          municipal_registration: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          pis: string | null
          pix_key: string | null
          pix_key_type: string | null
          portal_activated_at: string | null
          portal_settings: Json
          preferred: boolean
          rating: number | null
          simples_nacional: boolean | null
          specialties: string[]
          state: string | null
          state_registration: string | null
          status: string
          street: string | null
          tags: string[]
          total_amount: number
          total_orders: number
          trade_name: string | null
          updated_at: string
          updated_by: string | null
          warranty_days: number
          website: string | null
          whatsapp: string | null
          workshop_type: string[]
          zip_code: string | null
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          blocked_reason?: string | null
          city?: string | null
          cnae_code?: string | null
          cnpj_verified?: boolean
          cofins?: string | null
          company_id: string
          contact_name?: string | null
          contact_role?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          discount_pct?: number
          document_number?: string | null
          document_type?: string | null
          documents_urls?: Json
          email?: string | null
          has_portal_access?: boolean
          icms_rate?: number | null
          id?: string
          invoice_type?: string | null
          iss_rate?: number | null
          issues_invoice?: boolean
          latitude?: number | null
          longitude?: number | null
          municipal_registration?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          pis?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          portal_activated_at?: string | null
          portal_settings?: Json
          preferred?: boolean
          rating?: number | null
          simples_nacional?: boolean | null
          specialties?: string[]
          state?: string | null
          state_registration?: string | null
          status?: string
          street?: string | null
          tags?: string[]
          total_amount?: number
          total_orders?: number
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          warranty_days?: number
          website?: string | null
          whatsapp?: string | null
          workshop_type?: string[]
          zip_code?: string | null
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          blocked_reason?: string | null
          city?: string | null
          cnae_code?: string | null
          cnpj_verified?: boolean
          cofins?: string | null
          company_id?: string
          contact_name?: string | null
          contact_role?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          discount_pct?: number
          document_number?: string | null
          document_type?: string | null
          documents_urls?: Json
          email?: string | null
          has_portal_access?: boolean
          icms_rate?: number | null
          id?: string
          invoice_type?: string | null
          iss_rate?: number | null
          issues_invoice?: boolean
          latitude?: number | null
          longitude?: number | null
          municipal_registration?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          pis?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          portal_activated_at?: string | null
          portal_settings?: Json
          preferred?: boolean
          rating?: number | null
          simples_nacional?: boolean | null
          specialties?: string[]
          state?: string | null
          state_registration?: string | null
          status?: string
          street?: string | null
          tags?: string[]
          total_amount?: number
          total_orders?: number
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
          warranty_days?: number
          website?: string | null
          whatsapp?: string | null
          workshop_type?: string[]
          zip_code?: string | null
        }
        Relationships: []
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
      add_extra_tokens: {
        Args: { _company_id: string; _tokens: number }
        Returns: undefined
      }
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
      auto_link_ai_policies: {
        Args: { _company_id: string }
        Returns: {
          linked_count: number
          synced_vehicles: string[]
        }[]
      }
      bootstrap_company: {
        Args: { _company_name: string; _full_name: string }
        Returns: string
      }
      bootstrap_company_v2:
        | {
            Args: {
              _cnpj?: string
              _company_name: string
              _contact_name?: string
              _email?: string
              _full_name: string
              _phone?: string
            }
            Returns: string
          }
        | {
            Args: {
              _cnpj?: string
              _company_name: string
              _contact_name?: string
              _email?: string
              _full_name: string
              _phone?: string
              _trial_plan_slug?: string
            }
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
      check_ai_token_balance: {
        Args: { _company_id: string }
        Returns: {
          extra_balance: number
          plan_remaining: number
          total_available: number
        }[]
      }
      confirm_authorization_by_station: {
        Args: {
          _code: string
          _km_at_fueling?: number
          _liters: number
          _receipt_number: string
          _receipt_url?: string
          _station_id: string
          _total_value: number
        }
        Returns: string
      }
      consume_ai_tokens:
        | {
            Args: {
              _company_id: string
              _error?: string
              _feature: string
              _model?: string
              _success?: boolean
              _tokens_input?: number
              _tokens_output?: number
              _tokens_used: number
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _company_id: string
              _error?: string
              _feature: string
              _model?: string
              _request_id?: string
              _success?: boolean
              _tokens_input?: number
              _tokens_output?: number
              _tokens_used: number
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _company_id: string
              _error?: string
              _feature: string
              _model?: string
              _model_id_used?: string
              _provider_id?: string
              _request_id?: string
              _response_time_ms?: number
              _success?: boolean
              _tokens_input?: number
              _tokens_output?: number
              _tokens_used: number
              _user_id: string
              _was_fallback?: boolean
            }
            Returns: Json
          }
      dashboard_get_summary: { Args: { p_company_id: string }; Returns: Json }
      dedupe_insurance_brokers: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      dedupe_insurance_policies: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_fuel_auth_code: { Args: never; Returns: string }
      get_company_vehicle_limit: {
        Args: { _company_id: string }
        Returns: number
      }
      get_driver_calendar_events: {
        Args: {
          p_driver_user_id: string
          p_end_date: string
          p_start_date: string
          p_vehicle_id: string
        }
        Returns: Json
      }
      get_my_acquisition_state: {
        Args: never
        Returns: {
          company_id: string
          has_company: boolean
          is_active: boolean
          is_blocked: boolean
          is_exempt: boolean
          subscription_status: string
          trial_days_remaining: number
          trial_ends_at: string
        }[]
      }
      get_routing_for_feature: {
        Args: { _feature: string }
        Returns: {
          estimated_tokens: number
          fallback_model_code: string
          fallback_model_id: string
          fallback_model_type: string
          fallback_provider_code: string
          fallback_provider_endpoint: string
          fallback_provider_id: string
          fallback_provider_secret: string
          feature: string
          primary_model_code: string
          primary_model_id: string
          primary_model_type: string
          primary_provider_code: string
          primary_provider_endpoint: string
          primary_provider_id: string
          primary_provider_secret: string
        }[]
      }
      get_trial_days_remaining: {
        Args: { p_company_id: string }
        Returns: number
      }
      has_enough_ai_tokens: {
        Args: { _company_id: string; _required: number }
        Returns: boolean
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
      is_ai_policy: { Args: { _policy_id: string }; Returns: boolean }
      is_company_blocked: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_trial_active: { Args: { p_company_id: string }; Returns: boolean }
      is_trip_driver: {
        Args: { _driver_id: string; _user_id: string }
        Returns: boolean
      }
      is_workshop_user: { Args: { _workshop_id: string }; Returns: boolean }
      log_km_override: {
        Args: {
          _company_id: string
          _km_new: number
          _km_old: number
          _reason: string
          _record_id: string
          _table: string
          _user_id: string
        }
        Returns: undefined
      }
      match_policies_for_vehicle: {
        Args: { _vehicle_id: string }
        Returns: {
          match_by: string
          policy_id: string
        }[]
      }
      match_vehicles_for_ai_plate: {
        Args: {
          _chassis?: string
          _company_id: string
          _plate: string
          _renavam?: string
        }
        Returns: {
          match_by: string
          vehicle_id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      norm_broker_name: { Args: { p: string }; Returns: string }
      norm_digits: { Args: { p: string }; Returns: string }
      normalize_plate: { Args: { p: string }; Returns: string }
      preview_coupon: {
        Args: { p_cnpj?: string; p_code: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_insurance_monthly_costs: {
        Args: { p_policy_id?: string }
        Returns: undefined
      }
      recompute_vehicle_maintenance_status: {
        Args: { _vehicle_id: string }
        Returns: undefined
      }
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
      redeem_coupon: {
        Args: { p_code: string; p_company_id: string }
        Returns: Json
      }
      regenerate_authorization_code: {
        Args: { _authorization_id: string }
        Returns: {
          authorization_code: string
          expires_at: string
        }[]
      }
      reset_monthly_plan_tokens: { Args: never; Returns: number }
      seed_default_role_permissions: {
        Args: { _company_id: string }
        Returns: undefined
      }
      set_company_onboarding_dismissed: {
        Args: { p_company_id: string; p_dismissed?: boolean }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_vehicle_insurance_fields: {
        Args: { _vehicle_ids: string[] }
        Returns: undefined
      }
      update_fines_auto_status: { Args: never; Returns: undefined }
      upsert_insurance_broker: {
        Args: { p_company_id: string; p_data: Json }
        Returns: string
      }
      upsert_insurance_policy: {
        Args: { p_company_id: string; p_data: Json }
        Returns: string
      }
      validate_vehicle_km: {
        Args: {
          _new_km: number
          _override: boolean
          _override_reason: string
          _source: string
          _vehicle_id: string
        }
        Returns: number
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
        | "consumo_abaixo_esperado"
        | "consumo_acima_esperado"
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
        | "trial"
        | "expirada"
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
        "consumo_abaixo_esperado",
        "consumo_acima_esperado",
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
        "trial",
        "expirada",
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
