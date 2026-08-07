export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_runs: {
        Row: {
          artifact_id: string | null
          artifact_type: string | null
          completed_at: string | null
          engine: string
          engine_version: string
          error_code: string | null
          id: string
          initiated_by: string
          input_summary: Json
          model: string | null
          prompt_version: string
          provider: string | null
          started_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          artifact_id?: string | null
          artifact_type?: string | null
          completed_at?: string | null
          engine: string
          engine_version: string
          error_code?: string | null
          id?: string
          initiated_by: string
          input_summary?: Json
          model?: string | null
          prompt_version: string
          provider?: string | null
          started_at?: string
          status: string
          workspace_id: string
        }
        Update: {
          artifact_id?: string | null
          artifact_type?: string | null
          completed_at?: string | null
          engine?: string
          engine_version?: string
          error_code?: string | null
          id?: string
          initiated_by?: string
          input_summary?: Json
          model?: string | null
          prompt_version?: string
          provider?: string | null
          started_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_resource_links: {
        Row: {
          artifact_id: string
          artifact_type: string
          created_at: string
          created_by: string
          purpose: string
          resource_id: string
          workspace_id: string
        }
        Insert: {
          artifact_id: string
          artifact_type: string
          created_at?: string
          created_by: string
          purpose?: string
          resource_id: string
          workspace_id: string
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          created_at?: string
          created_by?: string
          purpose?: string
          resource_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_resource_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_resource_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_resource_same_workspace_fk"
            columns: ["resource_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      artifact_versions: {
        Row: {
          artifact_id: string
          artifact_type: string
          created_at: string
          created_by: string
          engine_version: string | null
          id: string
          origin: string
          prompt_version: string | null
          snapshot: Json
          version_number: number
          workspace_id: string
        }
        Insert: {
          artifact_id: string
          artifact_type: string
          created_at?: string
          created_by: string
          engine_version?: string | null
          id?: string
          origin: string
          prompt_version?: string | null
          snapshot: Json
          version_number: number
          workspace_id: string
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          created_at?: string
          created_by?: string
          engine_version?: string | null
          id?: string
          origin?: string
          prompt_version?: string | null
          snapshot?: Json
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          answer_key: Json | null
          assessment_id: string
          content: Json
          created_at: string
          critical_thinking_type: string | null
          difficulty: string | null
          id: string
          item_type: string
          marking_guide: Json | null
          marks: number | null
          metadata: Json
          objective: string | null
          position: number
          topic: string | null
          updated_at: string
        }
        Insert: {
          answer_key?: Json | null
          assessment_id: string
          content?: Json
          created_at?: string
          critical_thinking_type?: string | null
          difficulty?: string | null
          id?: string
          item_type: string
          marking_guide?: Json | null
          marks?: number | null
          metadata?: Json
          objective?: string | null
          position: number
          topic?: string | null
          updated_at?: string
        }
        Update: {
          answer_key?: Json | null
          assessment_id?: string
          content?: Json
          created_at?: string
          critical_thinking_type?: string | null
          difficulty?: string | null
          id?: string
          item_type?: string
          marking_guide?: Json | null
          marks?: number | null
          metadata?: Json
          objective?: string | null
          position?: number
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_mode: string
          blueprint: Json
          class_id: string | null
          created_at: string
          created_by: string
          engine_version: string | null
          id: string
          prompt_version: string | null
          source_context: Json
          source_lesson_id: string | null
          status: string
          subject_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assessment_mode: string
          blueprint?: Json
          class_id?: string | null
          created_at?: string
          created_by: string
          engine_version?: string | null
          id?: string
          prompt_version?: string | null
          source_context?: Json
          source_lesson_id?: string | null
          status?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assessment_mode?: string
          blueprint?: Json
          class_id?: string | null
          created_at?: string
          created_by?: string
          engine_version?: string | null
          id?: string
          prompt_version?: string | null
          source_context?: Json
          source_lesson_id?: string | null
          status?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_class_same_workspace_fk"
            columns: ["class_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "assessments_lesson_same_workspace_fk"
            columns: ["source_lesson_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "assessments_source_lesson_id_fkey"
            columns: ["source_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_same_workspace_fk"
            columns: ["subject_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "assessments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_session: string | null
          active: boolean
          age_range: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          academic_session?: string | null
          active?: boolean
          age_range?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          academic_session?: string | null
          active?: boolean
          age_range?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnoses: {
        Row: {
          academic_challenges: Json
          academic_strengths: Json
          assessment_id: string | null
          builder_growth_direction: string | null
          character_challenges: Json
          character_strengths: Json
          created_at: string
          created_by: string
          detected_patterns: Json
          diagnosis_mode: string
          encouragement_note: string | null
          engine_version: string | null
          evidence_limitations: Json
          finalised_at: string | null
          finalised_by: string | null
          id: string
          observed_evidence: Json
          parent_academic_actions: Json
          parent_character_actions: Json
          possible_interpretations: Json
          prompt_version: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_academic_actions: Json
          school_character_actions: Json
          status: string
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          academic_challenges?: Json
          academic_strengths?: Json
          assessment_id?: string | null
          builder_growth_direction?: string | null
          character_challenges?: Json
          character_strengths?: Json
          created_at?: string
          created_by: string
          detected_patterns?: Json
          diagnosis_mode: string
          encouragement_note?: string | null
          engine_version?: string | null
          evidence_limitations?: Json
          finalised_at?: string | null
          finalised_by?: string | null
          id?: string
          observed_evidence?: Json
          parent_academic_actions?: Json
          parent_character_actions?: Json
          possible_interpretations?: Json
          prompt_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_academic_actions?: Json
          school_character_actions?: Json
          status?: string
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          academic_challenges?: Json
          academic_strengths?: Json
          assessment_id?: string | null
          builder_growth_direction?: string | null
          character_challenges?: Json
          character_strengths?: Json
          created_at?: string
          created_by?: string
          detected_patterns?: Json
          diagnosis_mode?: string
          encouragement_note?: string | null
          engine_version?: string | null
          evidence_limitations?: Json
          finalised_at?: string | null
          finalised_by?: string | null
          id?: string
          observed_evidence?: Json
          parent_academic_actions?: Json
          parent_character_actions?: Json
          possible_interpretations?: Json
          prompt_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_academic_actions?: Json
          school_character_actions?: Json
          status?: string
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_assessment_same_workspace_fk"
            columns: ["assessment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "diagnoses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_student_same_workspace_fk"
            columns: ["student_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "diagnoses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_feedback: {
        Row: {
          ai_run_id: string | null
          artifact_id: string
          artifact_type: string
          comment: string | null
          created_at: string
          created_by: string
          id: string
          rating: string
          workspace_id: string
        }
        Insert: {
          ai_run_id?: string | null
          artifact_id: string
          artifact_type: string
          comment?: string | null
          created_at?: string
          created_by: string
          id?: string
          rating: string
          workspace_id: string
        }
        Update: {
          ai_run_id?: string | null
          artifact_id?: string
          artifact_type?: string
          comment?: string | null
          created_at?: string
          created_by?: string
          id?: string
          rating?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_ai_run_same_workspace_fk"
            columns: ["ai_run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "generation_feedback_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hqls_fidelity_checks: {
        Row: {
          check_origin: string
          checked_by: string | null
          created_at: string
          engine_version: string | null
          evidence: Json
          id: string
          lesson_id: string
          passed: boolean
          score: number | null
          violations: Json
          workspace_id: string
        }
        Insert: {
          check_origin?: string
          checked_by?: string | null
          created_at?: string
          engine_version?: string | null
          evidence?: Json
          id?: string
          lesson_id: string
          passed: boolean
          score?: number | null
          violations?: Json
          workspace_id: string
        }
        Update: {
          check_origin?: string
          checked_by?: string | null
          created_at?: string
          engine_version?: string | null
          evidence?: Json
          id?: string
          lesson_id?: string
          passed?: boolean
          score?: number | null
          violations?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidelity_lesson_same_workspace_fk"
            columns: ["lesson_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "hqls_fidelity_checks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hqls_fidelity_checks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_stages: {
        Row: {
          content: Json
          created_at: string
          id: string
          lesson_id: string
          stage_key: string
          stage_number: number
          updated_at: string
          validation: Json
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          lesson_id: string
          stage_key: string
          stage_number: number
          updated_at?: string
          validation?: Json
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          lesson_id?: string
          stage_key?: string
          stage_number?: number
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lesson_stages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          age_range: string | null
          class_id: string | null
          created_at: string
          created_by: string
          duration_minutes: number | null
          engine_version: string | null
          id: string
          objective: string
          prompt_version: string | null
          source_context: Json
          status: string
          subject_id: string | null
          title: string
          topic: string
          updated_at: string
          validation_summary: Json
          workspace_id: string
        }
        Insert: {
          age_range?: string | null
          class_id?: string | null
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          engine_version?: string | null
          id?: string
          objective: string
          prompt_version?: string | null
          source_context?: Json
          status?: string
          subject_id?: string | null
          title: string
          topic: string
          updated_at?: string
          validation_summary?: Json
          workspace_id: string
        }
        Update: {
          age_range?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          engine_version?: string | null
          id?: string
          objective?: string
          prompt_version?: string | null
          source_context?: Json
          status?: string
          subject_id?: string | null
          title?: string
          topic?: string
          updated_at?: string
          validation_summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_class_same_workspace_fk"
            columns: ["class_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_same_workspace_fk"
            columns: ["subject_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "lessons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_workspace_id: string | null
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_workspace_fk"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          created_by: string
          extracted_text: string | null
          id: string
          metadata: Json
          mime_type: string | null
          resource_type: string
          status: string
          storage_path: string | null
          title: string
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          extracted_text?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          resource_type: string
          status?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          extracted_text?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          resource_type?: string
          status?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      student_evidence: {
        Row: {
          assessment_id: string | null
          assessment_item_id: string | null
          content: Json
          created_at: string
          evidence_type: string
          id: string
          numeric_value: number | null
          recorded_at: string
          recorded_by: string
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assessment_id?: string | null
          assessment_item_id?: string | null
          content?: Json
          created_at?: string
          evidence_type: string
          id?: string
          numeric_value?: number | null
          recorded_at?: string
          recorded_by: string
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assessment_id?: string | null
          assessment_item_id?: string | null
          content?: Json
          created_at?: string
          evidence_type?: string
          id?: string
          numeric_value?: number | null
          recorded_at?: string
          recorded_by?: string
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_assessment_same_workspace_fk"
            columns: ["assessment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "evidence_item_same_assessment_fk"
            columns: ["assessment_item_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id", "assessment_id"]
          },
          {
            foreignKeyName: "evidence_student_same_workspace_fk"
            columns: ["student_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "student_evidence_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evidence_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evidence_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          class_id: string | null
          created_at: string
          created_by: string
          display_name: string
          external_reference: string | null
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          created_by: string
          display_name: string
          external_reference?: string | null
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          external_reference?: string | null
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_same_workspace_fk"
            columns: ["class_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "students_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          slug: string | null
          updated_at: string
          workspace_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          slug?: string | null
          updated_at?: string
          workspace_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string | null
          updated_at?: string
          workspace_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_artifact_version: {
        Args: {
          target_artifact_id: string
          target_artifact_type: string
          target_engine_version?: string
          target_origin: string
          target_prompt_version?: string
          target_snapshot: Json
          target_workspace_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
