import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssessmentItemType,
  KaecCriticalThinkingExperienceType,
} from "@/lib/domain/assessment";
import type {
  Database as GeneratedDatabase,
  Json,
} from "@/lib/supabase/database.types";

type GeneratedDiagnosisTable =
  GeneratedDatabase["public"]["Tables"]["diagnoses"];
type DiagnosisRow = GeneratedDiagnosisTable["Row"] & {
  concise_diagnosis: string;
};
type DiagnosisInsert = GeneratedDiagnosisTable["Insert"] & {
  concise_diagnosis?: string;
};
type DiagnosisUpdate = GeneratedDiagnosisTable["Update"] & {
  concise_diagnosis?: string;
};

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
  "assessment_items" | "diagnoses"
> & {
  assessment_items: Omit<
    GeneratedDatabase["public"]["Tables"]["assessment_items"],
    "Row"
  > & {
    Row: AssessmentItemRow;
  };
  diagnoses: Omit<GeneratedDiagnosisTable, "Row" | "Insert" | "Update"> & {
    Row: DiagnosisRow;
    Insert: DiagnosisInsert;
    Update: DiagnosisUpdate;
  };
};

type ArchivedSavedWorkRow = {
  artifact_type: string;
  artifact_id: string;
  title: string;
  updated_at: string;
  dependency_count: number;
  can_manage: boolean;
  can_permanently_delete: boolean;
};

type FinalStageFunctions = Omit<
  GeneratedDatabase["public"]["Functions"],
  "review_diagnosis" | "finalise_diagnosis"
> & {
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
  list_archived_saved_work: {
    Args: { target_workspace_id: string };
    Returns: ArchivedSavedWorkRow[];
  };
  manage_saved_artifact: {
    Args: {
      target_artifact_type: string;
      target_artifact_id: string;
      target_action: string;
    };
    Returns: Json;
  };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions" | "Tables"> & {
    Tables: FinalStageTables;
    Functions: FinalStageFunctions;
  };
};

export type KsiSupabaseClient = SupabaseClient<Database>;
