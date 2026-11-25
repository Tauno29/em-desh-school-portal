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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          attendanceDate: string
          createdAt: string
          id: number
          learnerId: number
          note: string | null
          status: string
        }
        Insert: {
          attendanceDate: string
          createdAt?: string
          id?: number
          learnerId: number
          note?: string | null
          status: string
        }
        Update: {
          attendanceDate?: string
          createdAt?: string
          id?: number
          learnerId?: number
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_learnerId_fkey"
            columns: ["learnerId"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          createdAt: string
          id: number
          name: string
        }
        Insert: {
          createdAt?: string
          id?: number
          name: string
        }
        Update: {
          createdAt?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      fee_structures: {
        Row: {
          academicYear: string
          developmentFund: string
          grade1to3: string
          hostelBoarding: string
          id: number
          kindergarten: string
          prePrimary: string
          registrationFee: string
          updatedAt: string
        }
        Insert: {
          academicYear: string
          developmentFund: string
          grade1to3: string
          hostelBoarding: string
          id?: number
          kindergarten: string
          prePrimary: string
          registrationFee: string
          updatedAt?: string
        }
        Update: {
          academicYear?: string
          developmentFund?: string
          grade1to3?: string
          hostelBoarding?: string
          id?: number
          kindergarten?: string
          prePrimary?: string
          registrationFee?: string
          updatedAt?: string
        }
        Relationships: []
      }
      gallery_asset_visibility: {
        Row: {
          hiddenAt: string
          imageUrl: string
        }
        Insert: {
          hiddenAt?: string
          imageUrl: string
        }
        Update: {
          hiddenAt?: string
          imageUrl?: string
        }
        Relationships: []
      }
      gallery_media: {
        Row: {
          category: string
          createdAt: string
          id: number
          imageUrl: string
          title: string
        }
        Insert: {
          category: string
          createdAt?: string
          id?: number
          imageUrl: string
          title: string
        }
        Update: {
          category?: string
          createdAt?: string
          id?: number
          imageUrl?: string
          title?: string
        }
        Relationships: []
      }
      learner_portal_records: {
        Row: {
          behaviorNotes: string
          learnerId: number
          term1Report: string
          term2Report: string
          term3Report: string
          updatedAt: string
        }
        Insert: {
          behaviorNotes?: string
          learnerId: number
          term1Report?: string
          term2Report?: string
          term3Report?: string
          updatedAt?: string
        }
        Update: {
          behaviorNotes?: string
          learnerId?: number
          term1Report?: string
          term2Report?: string
          term3Report?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_portal_records_learnerId_fkey"
            columns: ["learnerId"]
            isOneToOne: true
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          classId: number | null
          className: string
          createdAt: string
          fullName: string
          id: number
          parentAccountId: number | null
          parentPinHash: string | null
          studentId: string | null
          subjects: string | null
          surname: string
          teacher: string | null
          updatedAt: string
        }
        Insert: {
          classId?: number | null
          className: string
          createdAt?: string
          fullName: string
          id?: number
          parentAccountId?: number | null
          parentPinHash?: string | null
          studentId?: string | null
          subjects?: string | null
          surname: string
          teacher?: string | null
          updatedAt?: string
        }
        Update: {
          classId?: number | null
          className?: string
          createdAt?: string
          fullName?: string
          id?: number
          parentAccountId?: number | null
          parentPinHash?: string | null
          studentId?: string | null
          subjects?: string | null
          surname?: string
          teacher?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "learners_classId_fkey"
            columns: ["classId"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_parentAccountId_fkey"
            columns: ["parentAccountId"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_account_learners: {
        Row: {
          createdAt: string
          learnerId: number
          parentAccountId: number
        }
        Insert: {
          createdAt?: string
          learnerId: number
          parentAccountId: number
        }
        Update: {
          createdAt?: string
          learnerId?: number
          parentAccountId?: number
        }
        Relationships: [
          {
            foreignKeyName: "parent_account_learners_learnerId_fkey"
            columns: ["learnerId"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_account_learners_parentAccountId_fkey"
            columns: ["parentAccountId"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_accounts: {
        Row: {
          accessCodeHash: string
          active: number
          createdAt: string
          id: number
          parentEmail: string | null
          parentName: string
          updatedAt: string
          username: string
        }
        Insert: {
          accessCodeHash: string
          active?: number
          createdAt?: string
          id?: number
          parentEmail?: string | null
          parentName: string
          updatedAt?: string
          username: string
        }
        Update: {
          accessCodeHash?: string
          active?: number
          createdAt?: string
          id?: number
          parentEmail?: string | null
          parentName?: string
          updatedAt?: string
          username?: string
        }
        Relationships: []
      }
      performance_entries: {
        Row: {
          activityName: string
          activityType: string
          createdAt: string
          id: number
          learnerId: number
          marks: number
          performedAt: string
          totalMarks: number
        }
        Insert: {
          activityName: string
          activityType: string
          createdAt?: string
          id?: number
          learnerId: number
          marks: number
          performedAt?: string
          totalMarks: number
        }
        Update: {
          activityName?: string
          activityType?: string
          createdAt?: string
          id?: number
          learnerId?: number
          marks?: number
          performedAt?: string
          totalMarks?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_entries_learnerId_fkey"
            columns: ["learnerId"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      school_application_forms: {
        Row: {
          child_name: string
          created_at: string
          details: Json
          form_type: string
          id: string
          photo_path: string | null
          wants_hostel: boolean
        }
        Insert: {
          child_name: string
          created_at?: string
          details?: Json
          form_type: string
          id?: string
          photo_path?: string | null
          wants_hostel?: boolean
        }
        Update: {
          child_name?: string
          created_at?: string
          details?: Json
          form_type?: string
          id?: string
          photo_path?: string | null
          wants_hostel?: boolean
        }
        Relationships: []
      }
      school_applications: {
        Row: {
          created_at: string
          father_name: string
          father_occupation: string
          father_phone: string
          first_name: string
          grade: string
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          id: string
          last_name: string
          message: string
          mother_name: string
          mother_occupation: string
          mother_phone: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          father_name?: string
          father_occupation?: string
          father_phone?: string
          first_name: string
          grade: string
          guardian_email?: string
          guardian_name: string
          guardian_phone?: string
          id?: string
          last_name: string
          message: string
          mother_name?: string
          mother_occupation?: string
          mother_phone?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          father_name?: string
          father_occupation?: string
          father_phone?: string
          first_name?: string
          grade?: string
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          id?: string
          last_name?: string
          message?: string
          mother_name?: string
          mother_occupation?: string
          mother_phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_behavior_records: {
        Row: {
          created_at: string
          id: string
          learner_id: string
          note: string
          recorded_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          learner_id: string
          note: string
          recorded_on: string
        }
        Update: {
          created_at?: string
          id?: string
          learner_id?: string
          note?: string
          recorded_on?: string
        }
        Relationships: []
      }
      school_contact_info: {
        Row: {
          email: string
          id: number
          location: string
          nextTermDate: string
          phone: string
          postalBox: string
          registrationNumber: string
          updatedAt: string
          whatsapp: string
        }
        Insert: {
          email: string
          id?: number
          location: string
          nextTermDate: string
          phone: string
          postalBox: string
          registrationNumber: string
          updatedAt?: string
          whatsapp: string
        }
        Update: {
          email?: string
          id?: number
          location?: string
          nextTermDate?: string
          phone?: string
          postalBox?: string
          registrationNumber?: string
          updatedAt?: string
          whatsapp?: string
        }
        Relationships: []
      }
      school_gallery_images: {
        Row: {
          caption: string
          content_type: string
          created_at: string
          homepage_order: number
          homepage_role: string
          id: string
          object_path: string
          size_bytes: number
          status: string
        }
        Insert: {
          caption?: string
          content_type: string
          created_at?: string
          homepage_order?: number
          homepage_role?: string
          id?: string
          object_path: string
          size_bytes: number
          status?: string
        }
        Update: {
          caption?: string
          content_type?: string
          created_at?: string
          homepage_order?: number
          homepage_role?: string
          id?: string
          object_path?: string
          size_bytes?: number
          status?: string
        }
        Relationships: []
      }
      school_learners: {
        Row: {
          class_name: string
          created_at: string
          first_name: string
          grade: string
          guardian_name: string
          guardian_phone: string
          id: string
          last_name: string
          pin_hash: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_name?: string
          created_at?: string
          first_name: string
          grade: string
          guardian_name: string
          guardian_phone?: string
          id?: string
          last_name: string
          pin_hash: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          first_name?: string
          grade?: string
          guardian_name?: string
          guardian_phone?: string
          id?: string
          last_name?: string
          pin_hash?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_login_throttle: {
        Row: {
          failed_attempts: number
          locked_until: string
          throttle_key: string
          updated_at: string
        }
        Insert: {
          failed_attempts: number
          locked_until: string
          throttle_key: string
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string
          throttle_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_report_cards: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          learner_id: string
          object_path: string
          size_bytes: number
          status: string
          term: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          id?: string
          learner_id: string
          object_path: string
          size_bytes: number
          status?: string
          term?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          id?: string
          learner_id?: string
          object_path?: string
          size_bytes?: number
          status?: string
          term?: string
        }
        Relationships: []
      }
      school_sessions: {
        Row: {
          created_at: string
          expires_at: string
          learner_id: string | null
          role: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          learner_id?: string | null
          role: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          learner_id?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: []
      }
      school_site_settings: {
        Row: {
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_test_results: {
        Row: {
          created_at: string
          id: string
          learner_id: string
          recorded_on: string
          score: number
          subject: string
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          learner_id: string
          recorded_on: string
          score: number
          subject: string
          term?: string
        }
        Update: {
          created_at?: string
          id?: string
          learner_id?: string
          recorded_on?: string
          score?: number
          subject?: string
          term?: string
        }
        Relationships: []
      }
      site_alert_config: {
        Row: {
          buttonLabel: string
          destination: string
          enabled: number
          id: number
          message: string
          updatedAt: string
        }
        Insert: {
          buttonLabel: string
          destination: string
          enabled?: number
          id?: number
          message: string
          updatedAt?: string
        }
        Update: {
          buttonLabel?: string
          destination?: string
          enabled?: number
          id?: number
          message?: string
          updatedAt?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          body: string
          contentKey: string
          id: number
          published: number
          title: string
          updatedAt: string
          updatedBy: number | null
        }
        Insert: {
          body: string
          contentKey: string
          id?: number
          published?: number
          title: string
          updatedAt?: string
          updatedBy?: number | null
        }
        Update: {
          body?: string
          contentKey?: string
          id?: number
          published?: number
          title?: string
          updatedAt?: string
          updatedBy?: number | null
        }
        Relationships: []
      }
      urgent_update_reads: {
        Row: {
          parentAccountId: number
          readAt: string
          updateId: number
        }
        Insert: {
          parentAccountId: number
          readAt?: string
          updateId: number
        }
        Update: {
          parentAccountId?: number
          readAt?: string
          updateId?: number
        }
        Relationships: [
          {
            foreignKeyName: "urgent_update_reads_parentAccountId_fkey"
            columns: ["parentAccountId"]
            isOneToOne: false
            referencedRelation: "parent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urgent_update_reads_updateId_fkey"
            columns: ["updateId"]
            isOneToOne: false
            referencedRelation: "urgent_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      urgent_updates: {
        Row: {
          body: string
          createdAt: string
          expiresAt: string | null
          id: number
          isPublished: number
          title: string
        }
        Insert: {
          body: string
          createdAt?: string
          expiresAt?: string | null
          id?: number
          isPublished?: number
          title: string
        }
        Update: {
          body?: string
          createdAt?: string
          expiresAt?: string | null
          id?: number
          isPublished?: number
          title?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
