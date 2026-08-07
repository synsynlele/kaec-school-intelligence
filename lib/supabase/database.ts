import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database as GeneratedDatabase,
  Json,
} from "@/lib/supabase/database.types";

type DiagnosisRow =
  GeneratedDatabase["public"]["Tables"]["diagnoses"]["Row"];

type FinalStage1Functions = GeneratedDatabase["public"]["Functions"] & {
  create_hqls_lesson_draft: {
    Args: {
      target_workspace_id: string;
      target_title: string;
      target_topic: string;
      target_objective: string;
      target_age_range?: string | null;
      target_duration_minutes?: number | null;
      target_class_id?: string | null;
      target_subject_id?: string | null;
      target_source_context?: Json;
    };
    Returns: string;
  };
  review_diagnosis: {
    Args: { target_diagnosis_id: string };
    Returns: DiagnosisRow;
  };
  finalise_diagnosis: {
    Args: { target_diagnosis_id: string };
    Returns: DiagnosisRow;
  };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions"> & {
    Functions: FinalStage1Functions;
  };
};

export type KsiSupabaseClient = SupabaseClient<Database>;
