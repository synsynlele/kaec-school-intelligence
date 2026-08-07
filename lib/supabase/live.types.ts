import type { Database, Json } from "@/lib/supabase/database.types";

type PublicSchema = Database["public"];
type DiagnosisRow = PublicSchema["Tables"]["diagnoses"]["Row"];

/**
 * Final Stage 1 RPC signatures verified against the live dedicated KSI Supabase
 * project after migrations 001–011. The table schema remains represented by
 * database.types.ts; this extension closes the final generated-function drift.
 */
export type KsiDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: PublicSchema["Functions"] & {
      create_hqls_lesson_draft: {
        Args: {
          target_age_range?: string;
          target_class_id?: string;
          target_duration_minutes?: number;
          target_objective: string;
          target_source_context?: Json;
          target_subject_id?: string;
          target_title: string;
          target_topic: string;
          target_workspace_id: string;
        };
        Returns: string;
      };
      review_diagnosis: {
        Args: { target_diagnosis_id: string };
        Returns: DiagnosisRow;
        SetofOptions: {
          from: "*";
          to: "diagnoses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finalise_diagnosis: {
        Args: { target_diagnosis_id: string };
        Returns: DiagnosisRow;
        SetofOptions: {
          from: "*";
          to: "diagnoses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
  };
};
