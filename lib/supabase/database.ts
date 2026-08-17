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
  academic_session: string;
  term: string;
};
type DiagnosisInsert = GeneratedDiagnosisTable["Insert"] & {
  concise_diagnosis?: string;
  academic_session?: string;
  term?: string;
};
type DiagnosisUpdate = GeneratedDiagnosisTable["Update"] & {
  concise_diagnosis?: string;
  academic_session?: string;
  term?: string;
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

type InterventionHandoffRow = {
  id: string;
  workspace_id: string;
  diagnosis_id: string;
  student_id: string;
  created_by: string;
  status: string;
  priority_growth_target: string;
  evidence_basis: string;
  school_intervention: Json;
  parent_intervention: Json;
  timeframe: string;
  success_indicator: string;
  review_date: string | null;
  next_learning_adjustment: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  next_lesson_id: string | null;
  created_at: string;
  updated_at: string;
};

type InterventionHandoffInsert = {
  id?: string;
  workspace_id: string;
  diagnosis_id: string;
  student_id: string;
  created_by: string;
  status?: string;
  priority_growth_target?: string;
  evidence_basis?: string;
  school_intervention?: Json;
  parent_intervention?: Json;
  timeframe?: string;
  success_indicator?: string;
  review_date?: string | null;
  next_learning_adjustment?: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  next_lesson_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type InterventionHandoffUpdate = Partial<InterventionHandoffInsert>;

type InterventionHandoffTable = {
  Row: InterventionHandoffRow;
  Insert: InterventionHandoffInsert;
  Update: InterventionHandoffUpdate;
  Relationships: [];
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
  intervention_handoffs: InterventionHandoffTable;
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
  set_diagnosis_report_context: {
    Args: {
      target_diagnosis_id: string;
      target_academic_session: string;
      target_term: string;
    };
    Returns: DiagnosisRow;
  };
  archive_diagnosis: {
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
  get_scheme_review_access: {
    Args: Record<PropertyKey, never>;
    Returns: boolean;
  };
  get_scheme_review_console: {
    Args: { target_workspace_id: string };
    Returns: Json;
  };
  get_scheme_review_page: {
    Args: {
      target_workspace_id: string;
      target_document_id?: string | null;
      target_status?: string;
      target_class_level?: string | null;
      target_term?: string | null;
      target_limit?: number;
      target_offset?: number;
    };
    Returns: Json;
  };
  update_scheme_entry: {
    Args: {
      target_entry_id: string;
      target_patch: Json;
    };
    Returns: Json;
  };
  review_scheme_entry: {
    Args: {
      target_entry_id: string;
      target_status: string;
      target_review_note?: string | null;
    };
    Returns: Json;
  };
  review_scheme_entries_bulk: {
    Args: {
      target_entry_ids: string[];
      target_status: string;
      target_review_note?: string | null;
    };
    Returns: Json;
  };
  promote_scheme_entry: {
    Args: { target_entry_id: string };
    Returns: Json;
  };
  promote_scheme_entries_bulk: {
    Args: { target_entry_ids: string[] };
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
