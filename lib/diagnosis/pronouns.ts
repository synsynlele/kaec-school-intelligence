import type { GeneratedDiagnosis } from "@/lib/diagnosis/engine";

export const STUDENT_PRONOUN_PREFERENCES = ["name_only", "she_her", "he_him", "they_them"] as const;
export type StudentPronounPreference = (typeof STUDENT_PRONOUN_PREFERENCES)[number];

export function studentPronounPreference(value: unknown): StudentPronounPreference {
  return typeof value === "string" && (STUDENT_PRONOUN_PREFERENCES as readonly string[]).includes(value)
    ? value as StudentPronounPreference
    : "name_only";
}

export function diagnosisPronounInstruction(value: unknown): string {
  switch (studentPronounPreference(value)) {
    case "she_her": return "The school's student record specifies she/her pronouns for this learner. Use she/her correctly, or say the learner. Never guess he/him from a name or from teacher-input mistakes.";
    case "he_him": return "The school's student record specifies he/him pronouns for this learner. Use he/him correctly, or say the learner. Never guess she/her from a name or from teacher-input mistakes.";
    case "they_them": return "The school's student record specifies they/them pronouns for this learner. Use they/them correctly, or say the learner. Do not introduce he/him or she/her.";
    default: return "The student's pronouns have not been recorded. Do not infer gender from name, class, handwriting or teacher wording. Consistently say the learner or the student's name; do not use he/him or she/her.";
  }
}

function keepCase(original: string, replacement: string) {
  return original[0] === original[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}

/**
 * Guardrail for residual wrong pronouns in AI-authored learner-centred prose.
 * Preserve saved/raw teacher observations; only harmonise generated narratives.
 * Neutral name-based language is safe even when preferences are unavailable.
 */
export function alignDiagnosisNarrative(text: string, value: unknown): string {
  const preference = studentPronounPreference(value);
  const neutral = preference === "name_only" || preference === "they_them";
  return text.replace(/\b(himself|herself|hers|his|him|he|her|she)\b/gi, (raw, _, index, full: string) => {
    const pronoun = raw.toLowerCase();
    const remainder = full.slice(index + raw.length);
    const followingWord = /^\s+[a-zA-Z]+/.test(remainder);
    const possessiveHer = /^\s+(?:work|learning|progress|effort|growth|behaviour|behavior|performance|skills|ability|confidence|responsibilities|strengths|challenges|participation|improvement|development|understanding|capacity|needs|goals|conduct|attention|classwork|homework|achievement|response|responses|reflection|writing|reading|comprehension|communication|interest|peers|teacher|parents|family)\b/i.test(remainder);
    let replacement = raw;
    if (neutral) {
      if (pronoun === "his" || pronoun === "hers" || (pronoun === "her" && possessiveHer)) replacement = "the learner's";
      else if (pronoun === "himself" || pronoun === "herself") replacement = "the learner";
      else replacement = "the learner";
    } else if (preference === "she_her" && ["he","him","his","himself"].includes(pronoun)) {
      replacement = pronoun === "he" ? "she" : pronoun === "him" ? "her" : pronoun === "his" ? (followingWord ? "her" : "hers") : "herself";
    } else if (preference === "he_him" && ["she","her","hers","herself"].includes(pronoun)) {
      replacement = pronoun === "she" ? "he" : pronoun === "her" ? (possessiveHer ? "his" : "him") : pronoun === "hers" ? "his" : "himself";
    }
    return keepCase(raw, replacement);
  });
}

export function alignDiagnosisPronouns(diagnosis: GeneratedDiagnosis, preference: unknown): GeneratedDiagnosis {
  const align = (value: string) => alignDiagnosisNarrative(value, preference);
  return {
    ...diagnosis,
    observedEvidence: diagnosis.observedEvidence.map((item) => ({ ...item, statement: align(item.statement) })),
    detectedPatterns: diagnosis.detectedPatterns.map((item) => ({ ...item, statement: align(item.statement) })),
    possibleInterpretations: diagnosis.possibleInterpretations.map((item) => ({
      ...item, statement: align(item.statement), uncertaintyNote: align(item.uncertaintyNote),
    })),
    academicSkillStrengths: diagnosis.academicSkillStrengths.map((item) => ({ ...item, statement: align(item.statement) })),
    academicSkillChallenges: diagnosis.academicSkillChallenges.map((item) => ({ ...item, statement: align(item.statement) })),
    characterStrengths: diagnosis.characterStrengths.map((item) => ({ ...item, statement: align(item.statement) })),
    characterChallenges: diagnosis.characterChallenges.map((item) => ({ ...item, statement: align(item.statement) })),
    conciseDiagnosis: align(diagnosis.conciseDiagnosis),
    schoolAcademicActions: diagnosis.schoolAcademicActions.map((item) => ({ ...item, action: align(item.action) })),
    parentAcademicActions: diagnosis.parentAcademicActions.map((item) => ({ ...item, action: align(item.action) })),
    schoolCharacterActions: diagnosis.schoolCharacterActions.map((item) => ({ ...item, action: align(item.action) })),
    parentCharacterActions: diagnosis.parentCharacterActions.map((item) => ({ ...item, action: align(item.action) })),
    builderGrowthDirection: align(diagnosis.builderGrowthDirection),
    encouragementNote: align(diagnosis.encouragementNote),
    evidenceLimitations: diagnosis.evidenceLimitations.map(align),
  };
}
