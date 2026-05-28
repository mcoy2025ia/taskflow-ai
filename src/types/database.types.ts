// Tipos generados manualmente desde supabase/migrations/ (001–010).
// Regenerar con: npx supabase gen types typescript --local > src/types/database.types.ts
//
// GenericTable (postgrest-js) requiere Relationships: GenericRelationship[]
// — incluidas las FK reales para que los joins de select() sean type-safe.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high'
          position: number
          due_date: string | null
          created_at: string
          updated_at: string
          project_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          position?: number
          due_date?: string | null
          created_at?: string
          updated_at?: string
          project_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          position?: number
          due_date?: string | null
          created_at?: string
          updated_at?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      task_embeddings: {
        Row: {
          id: string
          task_id: string
          user_id: string
          embedding: string
          content_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          embedding: string
          content_hash: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          embedding?: string
          content_hash?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_embeddings_task_id_fkey'
            columns: ['task_id']
            isOneToOne: true
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          }
        ]
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          start_date: string
          delivery_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          start_date: string
          delivery_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          start_date?: string
          delivery_date?: string
          created_at?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          id: string
          project_id: string
          name: string
          total: number
          done: number
          color: string
          sort_order: number
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          total?: number
          done?: number
          color?: string
          sort_order?: number
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          total?: number
          done?: number
          color?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'project_phases_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      project_members: {
        Row: {
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          joined_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          joined_at?: string
        }
        Update: {
          project_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer'
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      task_assignments: {
        Row: {
          task_id: string
          user_id: string
          assigned_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          assigned_at?: string
        }
        Update: {
          task_id?: string
          user_id?: string
          assigned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_assignments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          }
        ]
      }
      comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          }
        ]
      }
      activity_log: {
        Row: {
          id: string
          project_id: string
          user_id: string
          action: string
          payload: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          action: string
          payload?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          action?: string
          payload?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      pending_invitations: {
        Row: {
          id: string
          project_id: string
          invited_by: string
          email: string
          role: 'editor' | 'viewer'
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          invited_by: string
          email: string
          role: 'editor' | 'viewer'
          token: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          invited_by?: string
          email?: string
          role?: 'editor' | 'viewer'
          token?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pending_invitations_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'chat_sessions'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      search_tasks_by_embedding: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
        }
        Returns: Array<{
          task_id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high'
          similarity: number
        }>
      }
      upsert_task_embedding: {
        Args: {
          p_task_id: string
          p_user_id: string
          p_embedding: string
          p_content_hash: string
        }
        Returns: undefined
      }
      is_project_member: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_project_editor: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      get_project_member_profiles: {
        Args: { p_project_id: string }
        Returns: Array<{
          user_id: string
          full_name: string
          avatar_url: string | null
          role: string
        }>
      }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: Array<{
          invitation_id: string
          project_id: string
          project_name: string
          role: string
          invited_email: string
          expires_at: string
          accepted_at: string | null
        }>
      }
      accept_invitation: {
        Args: { p_token: string }
        Returns: string
      }
    }
    Enums: {
      task_status: 'todo' | 'in_progress' | 'done'
      task_priority: 'low' | 'medium' | 'high'
    }
    CompositeTypes: Record<string, never>
  }
}
