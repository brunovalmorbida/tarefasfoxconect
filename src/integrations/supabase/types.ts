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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      board_columns: {
        Row: {
          board_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          description: string | null
          driver_id: string
          driver_user_id: string | null
          id: string
          km_reported: number | null
          needs_maintenance: boolean | null
          status: string
          task_id: string | null
          tools_description: string | null
          tools_ok: boolean | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          description?: string | null
          driver_id: string
          driver_user_id?: string | null
          id?: string
          km_reported?: number | null
          needs_maintenance?: boolean | null
          status?: string
          task_id?: string | null
          tools_description?: string | null
          tools_ok?: boolean | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          description?: string | null
          driver_id?: string
          driver_user_id?: string | null
          id?: string
          km_reported?: number | null
          needs_maintenance?: boolean | null
          status?: string
          task_id?: string | null
          tools_description?: string | null
          tools_ok?: boolean | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_checkins_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_checkins_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_documents: {
        Row: {
          created_at: string
          created_by: string
          document_date: string | null
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          maintenance_id: string | null
          notes: string | null
          supplier: string | null
          title: string
          updated_at: string
          vehicle_id: string
          warranty_expiry: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          document_date?: string | null
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          maintenance_id?: string | null
          notes?: string | null
          supplier?: string | null
          title: string
          updated_at?: string
          vehicle_id: string
          warranty_expiry?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          document_date?: string | null
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          maintenance_id?: string | null
          notes?: string | null
          supplier?: string | null
          title?: string
          updated_at?: string
          vehicle_id?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_documents_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "fleet_maintenances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_drivers: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          id: string
          job_title: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          id?: string
          job_title?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          id?: string
          job_title?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_maintenances: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          km_at_maintenance: number | null
          maintenance_date: string
          maintenance_type: string
          notes: string | null
          status: string
          supplier: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          km_at_maintenance?: number | null
          maintenance_date?: string
          maintenance_type?: string
          notes?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          km_at_maintenance?: number | null
          maintenance_date?: string
          maintenance_type?: string
          notes?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_maintenances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_settings: {
        Row: {
          auto_checkin_enabled: boolean
          checkin_day: number
          checkin_message_template: string | null
          checkin_time: string
          created_at: string
          default_assignee_id: string | null
          default_board_id: string | null
          default_task_deadline_days: number
          id: string
          updated_at: string
          warranty_alerts_enabled: boolean
        }
        Insert: {
          auto_checkin_enabled?: boolean
          checkin_day?: number
          checkin_message_template?: string | null
          checkin_time?: string
          created_at?: string
          default_assignee_id?: string | null
          default_board_id?: string | null
          default_task_deadline_days?: number
          id?: string
          updated_at?: string
          warranty_alerts_enabled?: boolean
        }
        Update: {
          auto_checkin_enabled?: boolean
          checkin_day?: number
          checkin_message_template?: string | null
          checkin_time?: string
          created_at?: string
          default_assignee_id?: string | null
          default_board_id?: string | null
          default_task_deadline_days?: number
          id?: string
          updated_at?: string
          warranty_alerts_enabled?: boolean
        }
        Relationships: []
      }
      fleet_vehicles: {
        Row: {
          brand: string | null
          city: string | null
          created_at: string
          created_by: string
          current_km: number | null
          driver_id: string | null
          driver_user_id: string | null
          id: string
          model: string | null
          name: string
          notes: string | null
          plate: string
          status: string
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          city?: string | null
          created_at?: string
          created_by: string
          current_km?: number | null
          driver_id?: string | null
          driver_user_id?: string | null
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          plate: string
          status?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          current_km?: number | null
          driver_id?: string | null
          driver_user_id?: string | null
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          plate?: string
          status?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_config: {
        Row: {
          access_token: string | null
          connected_by: string | null
          connected_email: string | null
          created_at: string | null
          folder_mapping: Json | null
          id: string
          is_connected: boolean | null
          refresh_token: string | null
          root_folder_id: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          connected_by?: string | null
          connected_email?: string | null
          created_at?: string | null
          folder_mapping?: Json | null
          id?: string
          is_connected?: boolean | null
          refresh_token?: string | null
          root_folder_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          connected_by?: string | null
          connected_email?: string | null
          created_at?: string | null
          folder_mapping?: Json | null
          id?: string
          is_connected?: boolean | null
          refresh_token?: string | null
          root_folder_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      product_catalog: {
        Row: {
          category_id: string | null
          created_at: string
          default_estimated_value: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_estimated_value?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_estimated_value?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_active: boolean
          job_title: string | null
          name: string
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          name?: string
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      purchase_list_items: {
        Row: {
          actual_value: number | null
          category: string
          created_at: string
          description: string | null
          estimated_value: number | null
          id: string
          list_id: string
          name: string
          quantity: number
          status: Database["public"]["Enums"]["purchase_status"]
        }
        Insert: {
          actual_value?: number | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          id?: string
          list_id: string
          name: string
          quantity?: number
          status?: Database["public"]["Enums"]["purchase_status"]
        }
        Update: {
          actual_value?: number | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          id?: string
          list_id?: string
          name?: string
          quantity?: number
          status?: Database["public"]["Enums"]["purchase_status"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "purchase_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_lists: {
        Row: {
          buyer_id: string | null
          created_at: string
          id: string
          purchase_notes: string | null
          purchased_at: string | null
          receive_notes: string | null
          received_at: string | null
          received_by: string | null
          requested_by: string
          status: Database["public"]["Enums"]["purchase_status"]
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["purchase_urgency"]
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          id?: string
          purchase_notes?: string | null
          purchased_at?: string | null
          receive_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["purchase_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["purchase_urgency"]
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          id?: string
          purchase_notes?: string | null
          purchased_at?: string | null
          receive_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["purchase_urgency"]
        }
        Relationships: []
      }
      purchase_notification_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notify_user_ids: string[]
          reminder_days: number | null
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_user_ids?: string[]
          reminder_days?: number | null
          stage: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_user_ids?: string[]
          reminder_days?: number | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_task_boards: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          created_by: string
          frequency_type: string
          id: string
          name: string
          team_id: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          created_by: string
          frequency_type: string
          id?: string
          name: string
          team_id: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string
          frequency_type?: string
          id?: string
          name?: string
          team_id?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_task_completions: {
        Row: {
          completed_at: string
          completed_by: string
          id: string
          period_start: string
          recurring_task_id: string
        }
        Insert: {
          completed_at?: string
          completed_by: string
          id?: string
          period_start: string
          recurring_task_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string
          id?: string
          period_start?: string
          recurring_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_completions_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          board_id: string | null
          created_at: string
          created_by: string
          description: string | null
          frequency: string
          id: string
          month_day: number | null
          position: number
          scheduled_time: string | null
          team_id: string
          title: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          frequency: string
          id?: string
          month_day?: number | null
          position?: number
          scheduled_time?: string | null
          team_id: string
          title: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          board_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          frequency?: string
          id?: string
          month_day?: number | null
          position?: number
          scheduled_time?: string | null
          team_id?: string
          title?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "recurring_task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      social_auto_goals: {
        Row: {
          auto_create: boolean
          category_id: string
          created_at: string
          created_by: string
          default_assigned_to: string | null
          id: string
          target_count: number
          updated_at: string
        }
        Insert: {
          auto_create?: boolean
          category_id: string
          created_at?: string
          created_by: string
          default_assigned_to?: string | null
          id?: string
          target_count?: number
          updated_at?: string
        }
        Update: {
          auto_create?: boolean
          category_id?: string
          created_at?: string
          created_by?: string
          default_assigned_to?: string | null
          id?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_auto_goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "social_content_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      social_goals: {
        Row: {
          category_id: string
          created_at: string
          created_by: string
          id: string
          target_count: number
          updated_at: string
          week_start: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by: string
          id?: string
          target_count?: number
          updated_at?: string
          week_start: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string
          id?: string
          target_count?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "social_content_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_task_proofs: {
        Row: {
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          source: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          source?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          source?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_task_proofs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "social_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      social_tasks: {
        Row: {
          assigned_to: string | null
          category_id: string
          completed_at: string | null
          completed_by: string | null
          content_strategy_type: string | null
          created_at: string
          created_by: string
          description: string | null
          drive_folder_url: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          pipeline_status: string
          post_link: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category_id: string
          completed_at?: string | null
          completed_by?: string | null
          content_strategy_type?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          pipeline_status?: string
          post_link?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category_id?: string
          completed_at?: string | null
          completed_by?: string | null
          content_strategy_type?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          pipeline_status?: string
          post_link?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "social_content_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "social_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_completed: boolean
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_completed?: boolean
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_completed?: boolean
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          column_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          labels: string[] | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          scheduled_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          column_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          scheduled_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          column_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          scheduled_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_be_buyer: boolean
          can_manage_boards: boolean
          can_manage_columns: boolean
          can_manage_fleet: boolean
          can_manage_purchases: boolean
          can_manage_recurring_tasks: boolean
          can_manage_social: boolean
          can_manage_tasks: boolean
          can_view_fleet: boolean
          can_view_purchases: boolean
          can_view_social: boolean
          created_at: string
          id: string
          is_driver: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_be_buyer?: boolean
          can_manage_boards?: boolean
          can_manage_columns?: boolean
          can_manage_fleet?: boolean
          can_manage_purchases?: boolean
          can_manage_recurring_tasks?: boolean
          can_manage_social?: boolean
          can_manage_tasks?: boolean
          can_view_fleet?: boolean
          can_view_purchases?: boolean
          can_view_social?: boolean
          created_at?: string
          id?: string
          is_driver?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_be_buyer?: boolean
          can_manage_boards?: boolean
          can_manage_columns?: boolean
          can_manage_fleet?: boolean
          can_manage_purchases?: boolean
          can_manage_recurring_tasks?: boolean
          can_manage_social?: boolean
          can_manage_tasks?: boolean
          can_view_fleet?: boolean
          can_view_purchases?: boolean
          can_view_social?: boolean
          created_at?: string
          id?: string
          is_driver?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_team_visibility: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_team_visibility_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          phone: string
          role: string
          tool_args: Json | null
          tool_name: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone: string
          role: string
          tool_args?: Json | null
          tool_name?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
          tool_args?: Json | null
          tool_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      zapi_config: {
        Row: {
          client_token: string | null
          created_at: string
          id: string
          instance_id: string
          is_active: boolean
          token: string
          updated_at: string
        }
        Insert: {
          client_token?: string | null
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean
          token: string
          updated_at?: string
        }
        Update: {
          client_token?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_id_from_board: { Args: { _board_id: string }; Returns: string }
      get_team_id_from_column: { Args: { _column_id: string }; Returns: string }
      get_team_id_from_task: { Args: { _task_id: string }; Returns: string }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_team_visibility: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_app_admin: { Args: never; Returns: boolean }
      is_team_admin: { Args: { _team_id: string }; Returns: boolean }
      is_team_member: { Args: { _team_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      purchase_category:
        | "office"
        | "cleaning"
        | "technology"
        | "maintenance"
        | "food"
        | "other"
      purchase_status: "pending" | "purchased" | "received"
      purchase_urgency: "low" | "medium" | "high" | "urgent"
      task_priority: "low" | "medium" | "high" | "urgent"
      team_role: "admin" | "member"
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
      app_role: ["admin", "user"],
      purchase_category: [
        "office",
        "cleaning",
        "technology",
        "maintenance",
        "food",
        "other",
      ],
      purchase_status: ["pending", "purchased", "received"],
      purchase_urgency: ["low", "medium", "high", "urgent"],
      task_priority: ["low", "medium", "high", "urgent"],
      team_role: ["admin", "member"],
    },
  },
} as const
