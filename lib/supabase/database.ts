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
  get_learning_result_review: { Args: { source_id: string }; Returns: Json };
  change_learning_result_review: {
    Args: { source_id: string; expected_revision: number; next_action: string; correction_note?: string };
    Returns: undefined;
  };
  publish_learning_result_with_comments: {
    Args: { source_id: string; expected_revision: number; comments: Json };
    Returns: undefined;
  };
  set_school_staff_status: { Args: { school_id: string; staff_id: string; expected_status: string; new_status: string }; Returns: undefined };
  restart_learning_parent_activation: { Args: { school_id: string; account_id: string }; Returns: boolean };
  get_learning_family_setup: { Args: { school_id: string }; Returns: Json };
  update_learning_parent: { Args: { school_id: string; account_id: string; parent_name: string; learner_ids: string[] }; Returns: undefined };
  register_learning_parent: { Args: { school_id: string; parent_id: string; parent_name: string; learner_ids: string[] }; Returns: undefined };
  revoke_learning_parent: { Args: { school_id: string; account_id: string }; Returns: undefined };
  activate_learning_parent: { Args: { account_id: string }; Returns: boolean };
  get_my_learning_parent_status: { Args: Record<PropertyKey, never>; Returns: string | null };
  get_my_parent_learning_results: { Args: Record<PropertyKey, never>; Returns: Json };
  learning_term_report_preview: { Args: { school_id: string; target_learner: string; school_session: string; school_term: string }; Returns: Json };
  restart_learning_cbt: { Args: { source_id: string; learner_id: string }; Returns: undefined };
  get_learning_subject_gradebook: { Args: SubjectGradebookScope; Returns: Json };
  save_learning_subject_gradebook: { Args: SubjectGradebookScope & { target_subject: string; new_sheet: Json; previous_sheet: Json }; Returns: undefined };
  approve_learning_subject_gradebook_with_resumption: { Args: SubjectGradebookScope & { reviewed_sheet: Json; next_resumption_date: string | null }; Returns: number };
  approve_learning_subject_gradebook: { Args: SubjectGradebookScope & { reviewed_sheet: Json }; Returns: number };
  get_learning_broadsheet_period: { Args: { school_id: string; target_class: string; school_session: string; school_term: string; report_kind: string }; Returns: Json };
  save_learning_broadsheet_period: { Args: { school_id: string; target_class: string; school_session: string; school_term: string; report_kind: string; selected_sources: Json; previous_sources: Json }; Returns: undefined };
  publish_learning_class_batch: { Args: { school_id: string; school_session: string; school_term: string; report_kind: string; reviewed_classes: Json; mastery_cutoff: number }; Returns: number };
  publish_learning_class_reports: { Args: { school_id: string; target_class: string; school_session: string; school_term: string; report_kind: string; expected_sources: Json; mastery_cutoff?: number }; Returns: number };
  withdraw_learning_class_reports: { Args: { school_id: string; target_class: string; school_session: string; school_term: string; report_kind: string; reason: string }; Returns: number };
  get_published_learning_class_reports: { Args: { school_id: string; target_class: string; school_session: string; school_term: string; report_kind: string }; Returns: Json };
  get_my_learner_term_reports: { Args: { report_id?: string }; Returns: Json };
  preview_learning_class_broadsheet: { Args: { school_id: string; target_class: string; school_session: string; school_term: string }; Returns: Json };
  get_learning_subject_enrolments: { Args: { school_id: string; target_class: string; school_session: string }; Returns: Json };
  save_learning_subject_enrolment: { Args: { school_id: string; target_class: string; school_session: string; learner_ids: string[]; selected_subject_ids: string[] }; Returns: undefined };
  withdraw_learning_term_report: { Args: { school_id: string; report_id: string; reason: string }; Returns: undefined };
  publish_learning_term_report: { Args: { school_id: string; target_learner: string; school_session: string; school_term: string; report_kind: string; selected_ids: string[] }; Returns: string };
  get_my_parent_term_reports: { Args: { report_id?: string }; Returns: Json };
  get_my_parent_learning_diagnoses: { Args: { diagnosis_id?: string }; Returns: Json };
  get_my_parent_learning_report: { Args: { assignment_id: string; target_learner: string }; Returns: Json };
  save_learning_passport_photo: { Args: { school_id: string; target_learner: string; photo_jpeg: string | null }; Returns: undefined };
  get_my_learning_result_report: { Args: { assignment_id: string }; Returns: Json };
  get_my_published_learning_results: { Args: Record<PropertyKey, never>; Returns: Json };
  get_learning_score_sheet: { Args: { source_id: string }; Returns: Json };
  save_learning_paper_scores: {
    Args: {
      source_id: string;
      learner_id: string;
      expected_revision: number;
      subjective_score: number | null;
      critical_thinking_score: number | null;
      project_score: number | null;
    };
    Returns: number;
  };
  schedule_learning_cbt: { Args: { source_id: string; opens_at: string; closes_at: string }; Returns: string };
  create_learning_project: {
    Args: {
      school_id: string;
      target_class: string;
      target_subject: string;
      project_title: string;
      academic_session: string;
      school_term: string;
      maximum: number;
    };
    Returns: string;
  };
  save_learning_marks: {
    Args: {
      source_id: string; learner_id: string; expected_revision: number;
      subjective_score: number | null; critical_thinking_score: number | null; project_score: number | null;
      excused_sections: string[];
    };
    Returns: number;
  };
  open_learning_score_sheet: { Args: { source_id: string }; Returns: string };
  get_learning_cbt_staff_status: { Args: { source_id: string }; Returns: Json };
  get_learning_cbt_item_insights: { Args: { source_id: string }; Returns: Json };
  list_learning_objective_exams: { Args: { school_id: string; search_text: string; page_offset: number }; Returns: Json };
  list_learning_assessments: { Args: { search_text: string; school_id: string; page_offset: number }; Returns: Json };
  assign_learning_cbt: { Args: { source_id: string }; Returns: string };
  get_learning_cbts: { Args: { target_id?: string }; Returns: Json };
  submit_learning_cbt: { Args: { target_id: string; responses: Json }; Returns: Json };
  get_platform_school_overview: {
    Args: Record<PropertyKey, never>;
    Returns: Json;
  };
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
  get_academic_resource_catalog: {
    Args: {
      target_workspace_id: string;
      target_class_level?: string | null;
      target_subject?: string | null;
      target_term?: string | null;
    };
    Returns: Json;
  };
  replace_scheme_class_extraction: {
    Args: {
      target_document_id: string;
      target_class_level: string;
      target_entries: Json;
      target_extraction_note?: string | null;
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

export type SubjectGradebookScope = { school_id: string; target_class: string; school_session: string; school_term: string; report_period: string };
