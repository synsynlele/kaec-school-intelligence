import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssessmentItemType,
  KaecCriticalThinkingExperienceType,
} from "@/lib/domain/assessment";
import type {
  Database as GeneratedDatabase,
  Json,
} from "@/lib/supabase/database.types";

type DiagnosisRow =
  GeneratedDatabase["public"]["Tables"]["diagnoses"]["Row"];
type HqlsFidelityCheckRow =
  GeneratedDatabase["public"]["Tables"]["hqls_fidelity_checks"]["Row"];

type AssessmentItemRow = Omit<
  GeneratedDatabase["public"]["Tables"]["assessment_items"]["Row"],
  "item_type" | "critical_thinking_type"
> & {
  item_type: AssessmentItemType;
  critical_thinking_type: KaecCriticalThinkingExperienceType | null;
};

type FinalStageTables = Omit<
  GeneratedDatabase["public"]["Tables"],
  "assessment_items"
> & {
  assessment_items: Omit<
    GeneratedDatabase["public"]["Tables"]["assessment_items"],
    "Row"
  > & {
    Row: AssessmentItemRow;
  };
};

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
  record_hqls_system_fidelity_check: {
    Args: {
      target_lesson_id: string;
      target_passed: boolean;
      target_score: number | null;
      target_violations: Json;
      target_evidence: Json;
      target_engine_version: string;
    };
    Returns: HqlsFidelityCheckRow;
  };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions" | "Tables"> & {
    Tables: FinalStageTables;
    Functions: FinalStage1Functions;
  };
};

export type KsiSupabaseClient = SupabaseClient<Database>;
