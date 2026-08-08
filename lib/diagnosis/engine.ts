import type { DiagnosisMode } from "@/lib/domain/diagnosis";

export const DIAGNOSIS_ENGINE_VERSION = "DIAGNOSIS_ENGINE_v1.0";
export const DIAGNOSIS_PROMPT_VERSION = "DIAGNOSIS_PROMPT_v1.0";
export const DIAGNOSIS_QUALITY_VERSION = "KAEC_DIAGNOSIS_QUALITY_v1.0";

export const DIAGNOSIS_DOMAINS = ["academic", "skill", "character"] as const;
export type DiagnosisDomain = (typeof DIAGNOSIS_DOMAINS)[number];
export type DiagnosisConfidence = "low" | "medium" | "high";
export type DiagnosisEvidenceSource =
  | "assessment_score"
  | "assessment_item"
  | "teacher_observation"
  | "reflection";

export type DiagnosisEvidencePacket = {
  id: string;
  source: DiagnosisEvidenceSource;
  domain: DiagnosisDomain;
  statement: string;
  metric: string;
};

export type DiagnosisGenerationContext = {
  studentName: string;
  className: string;
  mode: DiagnosisMode;
  assessmentTitle: string;
  evidence: DiagnosisEvidencePacket[];
};

export type DiagnosisFinding = {
  statement: string;
  evidenceIds: string[];
  confidence: DiagnosisConfidence;
};

export type DiagnosisInterpretation = DiagnosisFinding & {
  uncertaintyNote: string;
};

export type DiagnosisStrengthChallenge = {
  domain: "academic" | "skill";
  statement: string;
  evidenceIds: string[];
};

export type DiagnosisCharacterFinding = {
  statement: string;
  evidenceIds: string[];
};

export type DiagnosisAction = {
  action: string;
  evidenceIds: string[];
  timeframe: string;
};

export type GeneratedDiagnosis = {
  observedEvidence: DiagnosisEvidencePacket[];
  detectedPatterns: DiagnosisFinding[];
  possibleInterpretations: DiagnosisInterpretation[];
  academicSkillStrengths: DiagnosisStrengthChallenge[];
  academicSkillChallenges: DiagnosisStrengthChallenge[];
  characterStrengths: DiagnosisCharacterFinding[];
  characterChallenges: DiagnosisCharacterFinding[];
  conciseDiagnosis: string;
  schoolAcademicActions: DiagnosisAction[];
  parentAcademicActions: DiagnosisAction[];
  schoolCharacterActions: DiagnosisAction[];
  parentCharacterActions: DiagnosisAction[];
  builderGrowthDirection: string;
  encouragementNote: string;
  evidenceLimitations: string[];
};

export type DiagnosisValidationViolation = {
  code: string;
  message: string;
};

export type DiagnosisValidation = {
  passed: boolean;
  score: number;
  qualityVersion: string;
  violations: DiagnosisValidationViolation[];
  evidence: string[];
};

const confidenceSchema = { type: "string", enum: ["low", "medium", "high"] };
const domainSchema = { type: "string", enum: [...DIAGNOSIS_DOMAINS] };
const stringArray = { type: "array", items: { type: "string" } };

export const DIAGNOSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    observedEvidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: {
            type: "string",
            enum: [
              "assessment_score",
              "assessment_item",
              "teacher_observation",
              "reflection",
            ],
          },
          domain: domainSchema,
          statement: { type: "string" },
          metric: { type: "string" },
        },
      },
    },
    detectedPatterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceIds: stringArray,
          confidence: confidenceSchema,
        },
      },
    },
    possibleInterpretations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceIds: stringArray,
          confidence: confidenceSchema,
          uncertaintyNote: { type: "string" },
        },
      },
    },
    academicSkillStrengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          domain: { type: "string", enum: ["academic", "skill"] },
          statement: { type: "string" },
          evidenceIds: stringArray,
        },
      },
    },
    academicSkillChallenges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          domain: { type: "string", enum: ["academic", "skill"] },
          statement: { type: "string" },
          evidenceIds: stringArray,
        },
      },
    },
    characterStrengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceIds: stringArray,
        },
      },
    },
    characterChallenges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceIds: stringArray,
        },
      },
    },
    conciseDiagnosis: { type: "string" },
    schoolAcademicActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          evidenceIds: stringArray,
          timeframe: { type: "string" },
        },
      },
    },
    parentAcademicActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          evidenceIds: stringArray,
          timeframe: { type: "string" },
        },
      },
    },
    schoolCharacterActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          evidenceIds: stringArray,
          timeframe: { type: "string" },
        },
      },
    },
    parentCharacterActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          evidenceIds: stringArray,
          timeframe: { type: "string" },
        },
      },
    },
    builderGrowthDirection: { type: "string" },
    encouragementNote: { type: "string" },
    evidenceLimitations: stringArray,
  },
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function confidence(value: unknown): DiagnosisConfidence {
  return value === "low" || value === "high" ? value : "medium";
}

function domain(value: unknown): DiagnosisDomain {
  return DIAGNOSIS_DOMAINS.includes(value as DiagnosisDomain)
    ? (value as DiagnosisDomain)
    : "academic";
}

function finding(value: unknown): DiagnosisFinding {
  const row = record(value) ?? {};
  return {
    statement: string(row.statement),
    evidenceIds: strings(row.evidenceIds),
    confidence: confidence(row.confidence),
  };
}

function interpretation(value: unknown): DiagnosisInterpretation {
  const row = record(value) ?? {};
  return { ...finding(row), uncertaintyNote: string(row.uncertaintyNote) };
}

function strengthChallenge(value: unknown): DiagnosisStrengthChallenge {
  const row = record(value) ?? {};
  return {
    domain: row.domain === "skill" ? "skill" : "academic",
    statement: string(row.statement),
    evidenceIds: strings(row.evidenceIds),
  };
}

function characterFinding(value: unknown): DiagnosisCharacterFinding {
  const row = record(value) ?? {};
  return { statement: string(row.statement), evidenceIds: strings(row.evidenceIds) };
}

function action(value: unknown): DiagnosisAction {
  const row = record(value) ?? {};
  return {
    action: string(row.action),
    evidenceIds: strings(row.evidenceIds),
    timeframe: string(row.timeframe),
  };
}

function mapArray<T>(value: unknown, mapper: (item: unknown) => T) {
  return Array.isArray(value) ? value.map(mapper) : [];
}

export function parseGeneratedDiagnosis(value: unknown): GeneratedDiagnosis {
  const row = record(value);
  if (!row) throw new Error("Diagnosis output is not a structured object.");
  return {
    observedEvidence: mapArray(row.observedEvidence, (item) => {
      const evidence = record(item) ?? {};
      const source = string(evidence.source) as DiagnosisEvidenceSource;
      return {
        id: string(evidence.id),
        source: ["assessment_score", "assessment_item", "teacher_observation", "reflection"].includes(source)
          ? source
          : "teacher_observation",
        domain: domain(evidence.domain),
        statement: string(evidence.statement),
        metric: string(evidence.metric),
      };
    }),
    detectedPatterns: mapArray(row.detectedPatterns, finding),
    possibleInterpretations: mapArray(row.possibleInterpretations, interpretation),
    academicSkillStrengths: mapArray(row.academicSkillStrengths, strengthChallenge),
    academicSkillChallenges: mapArray(row.academicSkillChallenges, strengthChallenge),
    characterStrengths: mapArray(row.characterStrengths, characterFinding),
    characterChallenges: mapArray(row.characterChallenges, characterFinding),
    conciseDiagnosis: string(row.conciseDiagnosis),
    schoolAcademicActions: mapArray(row.schoolAcademicActions, action),
    parentAcademicActions: mapArray(row.parentAcademicActions, action),
    schoolCharacterActions: mapArray(row.schoolCharacterActions, action),
    parentCharacterActions: mapArray(row.parentCharacterActions, action),
    builderGrowthDirection: string(row.builderGrowthDirection),
    encouragementNote: string(row.encouragementNote),
    evidenceLimitations: strings(row.evidenceLimitations),
  };
}

const prohibitedClinical = /\b(adhd|autis(m|tic)|dyslexi(a|c)|dyscalculi(a|c)|bipolar|depress(ion|ed)|psychiatric|psychological disorder|clinical diagnosis|personality disorder|syndrome|intelligence quotient|\biq\b)\b/i;
const harmfulLabels = /\b(lazy|stupid|dull|hopeless|bad child|weak student|unintelligent|stubborn by nature)\b/i;
const causalCertainty = /\b(definitely|certainly|proves that|the cause is|caused by|must be because|clearly suffers from)\b/i;
const tentativeLanguage = /\b(may|might|could|possibly|possible|suggests?|appears?|may indicate|could indicate)\b/i;

function validateReferences(
  ids: string[],
  validIds: Set<string>,
  label: string,
  violations: DiagnosisValidationViolation[],
) {
  if (!ids.length) {
    violations.push({ code: "MISSING_EVIDENCE_LINK", message: `${label} must cite at least one evidence record.` });
    return;
  }
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length) {
    violations.push({ code: "UNKNOWN_EVIDENCE_LINK", message: `${label} cites evidence that was not supplied to the diagnosis engine.` });
  }
}

function validateTextSafety(text: string, label: string, violations: DiagnosisValidationViolation[]) {
  if (prohibitedClinical.test(text)) {
    violations.push({ code: "CLINICAL_LABEL", message: `${label} contains a medical/psychiatric/psychological conclusion outside KSI's scope.` });
  }
  if (harmfulLabels.test(text)) {
    violations.push({ code: "HARMFUL_LABEL", message: `${label} labels the learner rather than describing evidence and growth.` });
  }
}

export function validateDiagnosis(
  diagnosis: GeneratedDiagnosis,
  suppliedEvidence: DiagnosisEvidencePacket[],
): DiagnosisValidation {
  const violations: DiagnosisValidationViolation[] = [];
  const validIds = new Set(suppliedEvidence.map((item) => item.id));
  const outputIds = new Set(diagnosis.observedEvidence.map((item) => item.id));

  for (const evidence of suppliedEvidence) {
    if (!outputIds.has(evidence.id)) {
      violations.push({ code: "DROPPED_EVIDENCE", message: `Observed evidence ${evidence.id} was omitted from the diagnosis.` });
    }
  }
  for (const observed of diagnosis.observedEvidence) {
    if (!validIds.has(observed.id)) {
      violations.push({ code: "INVENTED_EVIDENCE", message: "Diagnosis contains observed evidence that was not supplied by KSI." });
    }
    validateTextSafety(observed.statement, "Observed evidence", violations);
  }

  diagnosis.detectedPatterns.forEach((item, index) => {
    if (item.statement.length < 20) violations.push({ code: "SHALLOW_PATTERN", message: `Pattern ${index + 1} is too vague to be useful.` });
    validateReferences(item.evidenceIds, validIds, `Pattern ${index + 1}`, violations);
    validateTextSafety(item.statement, `Pattern ${index + 1}`, violations);
  });

  diagnosis.possibleInterpretations.forEach((item, index) => {
    validateReferences(item.evidenceIds, validIds, `Possible interpretation ${index + 1}`, violations);
    if (item.statement.length < 20 || !tentativeLanguage.test(`${item.statement} ${item.uncertaintyNote}`)) {
      violations.push({ code: "UNQUALIFIED_INTERPRETATION", message: `Possible interpretation ${index + 1} must remain explicitly tentative.` });
    }
    if (item.uncertaintyNote.length < 15) violations.push({ code: "MISSING_UNCERTAINTY", message: `Possible interpretation ${index + 1} must explain its uncertainty.` });
    if (causalCertainty.test(item.statement)) violations.push({ code: "UNSUPPORTED_CAUSAL_CERTAINTY", message: `Possible interpretation ${index + 1} states an unsupported cause too certainly.` });
    validateTextSafety(`${item.statement} ${item.uncertaintyNote}`, `Possible interpretation ${index + 1}`, violations);
  });

  const evidenceDomain = (target: DiagnosisDomain) => suppliedEvidence.some((item) => item.domain === target);
  const allStrengthChallenge = [
    ...diagnosis.academicSkillStrengths,
    ...diagnosis.academicSkillChallenges,
  ];
  allStrengthChallenge.forEach((item, index) => {
    validateReferences(item.evidenceIds, validIds, `Academics/skills finding ${index + 1}`, violations);
    if (!evidenceDomain(item.domain) && !/insufficient evidence/i.test(item.statement)) {
      violations.push({ code: "UNSUPPORTED_DOMAIN_FINDING", message: `A ${item.domain} finding was stated without ${item.domain} evidence.` });
    }
    validateTextSafety(item.statement, `Academics/skills finding ${index + 1}`, violations);
  });

  [...diagnosis.characterStrengths, ...diagnosis.characterChallenges].forEach((item, index) => {
    validateReferences(item.evidenceIds, validIds, `Character finding ${index + 1}`, violations);
    if (!evidenceDomain("character") && !/insufficient evidence/i.test(item.statement)) {
      violations.push({ code: "UNSUPPORTED_CHARACTER_FINDING", message: "Character conclusions require actual character evidence." });
    }
    validateTextSafety(item.statement, `Character finding ${index + 1}`, violations);
  });

  const actionGroups = [
    ["School Academics/Skills", diagnosis.schoolAcademicActions],
    ["Parent Academics/Skills", diagnosis.parentAcademicActions],
    ["School Character", diagnosis.schoolCharacterActions],
    ["Parent Character", diagnosis.parentCharacterActions],
  ] as const;
  actionGroups.forEach(([label, actions]) => {
    actions.forEach((item, index) => {
      if (item.action.length < 18 || item.timeframe.length < 3) {
        violations.push({ code: "VAGUE_ACTION", message: `${label} action ${index + 1} must be specific and time-bounded.` });
      }
      validateReferences(item.evidenceIds, validIds, `${label} action ${index + 1}`, violations);
      validateTextSafety(item.action, `${label} action ${index + 1}`, violations);
    });
  });

  if (diagnosis.conciseDiagnosis.length < 40) violations.push({ code: "SHALLOW_DIAGNOSIS", message: "Concise diagnosis is too shallow to guide action." });
  if (causalCertainty.test(diagnosis.conciseDiagnosis)) violations.push({ code: "UNSUPPORTED_CERTAINTY", message: "Concise diagnosis contains unsupported causal certainty." });
  validateTextSafety(diagnosis.conciseDiagnosis, "Concise diagnosis", violations);

  if (diagnosis.builderGrowthDirection.length < 25) violations.push({ code: "SHALLOW_BUILDER_DIRECTION", message: "Builder Growth Direction must give a meaningful next-growth direction." });
  if (diagnosis.encouragementNote.length < 20) violations.push({ code: "SHALLOW_ENCOURAGEMENT", message: "Encouragement Note must be meaningful and respectful." });
  validateTextSafety(`${diagnosis.builderGrowthDirection} ${diagnosis.encouragementNote}`, "Parent-facing growth content", violations);

  if (!diagnosis.evidenceLimitations.length || diagnosis.evidenceLimitations.some((item) => item.length < 12)) {
    violations.push({ code: "MISSING_EVIDENCE_LIMITATIONS", message: "Diagnosis must state clear evidence limitations." });
  }

  const absentDomains = DIAGNOSIS_DOMAINS.filter((target) => !evidenceDomain(target));
  for (const absent of absentDomains) {
    const limitations = diagnosis.evidenceLimitations.join(" ");
    if (!new RegExp(`insufficient evidence.*${absent}|${absent}.*insufficient evidence`, "i").test(limitations)) {
      violations.push({ code: "INSUFFICIENT_EVIDENCE_NOT_STATED", message: `The diagnosis has no ${absent} evidence and must explicitly state Insufficient Evidence for that domain.` });
    }
  }

  const score = Math.max(0, 100 - violations.length * 8);
  return {
    passed: violations.length === 0,
    score,
    qualityVersion: DIAGNOSIS_QUALITY_VERSION,
    violations,
    evidence: violations.length
      ? []
      : [
          "Observed evidence is traceable to supplied student evidence.",
          "Patterns and interpretations preserve evidence links, confidence and uncertainty.",
          "Clinical/psychological labels and unsupported causal certainty are excluded.",
          "School/parent actions are specific, evidence-linked and time-bounded.",
          "Evidence limitations and insufficient-evidence boundaries are explicit.",
        ],
  };
}

function evidenceText(context: DiagnosisGenerationContext) {
  return context.evidence
    .map((item) => `- ID ${item.id} | ${item.source} | ${item.domain} | ${item.statement}${item.metric ? ` | ${item.metric}` : ""}`)
    .join("\n");
}

export function buildDiagnosisSystemInstruction() {
  return `You are the KAEC Student Diagnosis Intelligence engine. This is educational/student-development diagnosis only, never medical, psychiatric or psychological diagnosis. Preserve the reasoning hierarchy Observed Evidence -> Detected Pattern -> Possible Interpretation -> Recommended Action. Never invent evidence. Never label a learner's worth, personality or condition. Treat each teacher input as raw professional evidence that must be understood, translated and explained rather than echoed. Convert brief, informal or non-technical teacher wording into clear educational language that explains what the observation means for the learner's present performance, demonstrated capability, support need or next growth priority. Preserve the factual meaning and evidence ID, but do not quote, copy or merely repeat the teacher's wording. Interpretations must remain tentative and evidence-linked. If a domain lacks adequate evidence, state Insufficient Evidence. Parent-facing language must be respectful, precise, readable and growth-oriented. Actions must be specific, feasible and time-bounded. Return only the required structured schema.`;
}

export function buildDiagnosisPrompt(context: DiagnosisGenerationContext) {
  return `Generate a KAEC Student Diagnosis draft.

Student: ${context.studentName}
Class: ${context.className}
Mode: ${context.mode}
Assessment: ${context.assessmentTitle || "Not used in this mode"}

AUTHORISED OBSERVED EVIDENCE — use these exact IDs and do not invent any evidence:
${evidenceText(context)}

Professional interpretation standard:
Every teacher input is RAW EVIDENCE, not finished report language. The output must add professional educational value. For each teacher observation, identify what the factual observation shows about current academic/skill performance, demonstrated strength, behavioural functioning, support need, or practical growth direction. Explain that meaning in fresh professional language. Do not quote the teacher, copy the wording, or pad the same statement with phrases such as "the teacher observed". Preserve facts exactly; improve the explanation, not the facts. Never invent motives, hidden causes, diagnoses or unsupported traits.

Example of the required transformation:
Teacher input: "good in maths"
Poor output: "The learner is good in maths."
Professional output: "The learner demonstrates a comparatively secure grasp of mathematical tasks, providing a useful academic strength that can be leveraged while weaker subject areas are being developed."

Teacher input: "loses temper easily"
Poor output: "The learner loses his temper easily."
Professional output: "The learner currently shows difficulty maintaining emotional regulation when frustrated or challenged, indicating a need for consistent self-management routines and guided practice in responding calmly."

Rules:
1. observedEvidence must include every supplied evidence item using the exact ID/source/domain, but its statement must professionally translate the observation into clear, factual educational language rather than repeat the original wording.
2. Every teacher_observation must be meaningfully processed beyond observedEvidence into the analysis: connect it to at least one appropriate pattern, possible interpretation, strength/challenge, or recommended action using its evidence ID. No teacher input may be ignored or left as an unexplained quotation.
3. Patterns must describe evidence-backed recurrence/relationship, cite evidence IDs and carry confidence. A single observation may support a finding, but do not manufacture recurrence when recurrence is not evidenced.
4. Possible interpretations are hypotheses only. Use may/might/could/possibly/suggests/appears and explain uncertainty.
5. Do not diagnose ADHD, autism, dyslexia, depression, disorders, personality, intelligence or any clinical/psychological condition.
6. Do not call the learner lazy, dull, weak, stubborn by nature, unintelligent or similar. Convert judgemental teacher wording into observable, developmental language without preserving the label.
7. Academic/skill/character strengths and challenges must do more than rename the teacher input: explain the educational significance of the evidence and cite supporting evidence IDs. If a domain has no evidence, do not create a strength/challenge for it; state "Insufficient Evidence for <domain> ..." in evidenceLimitations.
8. School and parent actions must be derived from the professionally interpreted need, cite evidence IDs and include a realistic timeframe such as "next 2 weeks", "three times weekly", or "before the next assessment".
9. conciseDiagnosis must synthesise the meaning across the evidence into a professional explanation of the learner's current growth picture. It must not become a list of teacher statements and must not claim hidden causes.
10. Builder Growth Direction should show the next capability/responsibility direction without ranking worth.
11. Encouragement Note should be warm, specific and grounded in demonstrated potential/evidence, while still adding insight rather than repeating strengths word-for-word.
12. Include at least one Evidence Limitation even with strong evidence, because this diagnosis reflects a bounded evidence window.
13. Prefer concise, natural professional prose over jargon. The parent should understand why each observation matters and what should happen next.`;
}

export function buildDiagnosisRepairPrompt(
  context: DiagnosisGenerationContext,
  diagnosis: GeneratedDiagnosis,
  validation: DiagnosisValidation,
) {
  return `${buildDiagnosisPrompt(context)}

The previous structured draft failed independent KAEC validation. Repair every issue below while preserving factual evidence exactly and applying the professional interpretation standard to every teacher input.

VALIDATION ISSUES:
${validation.violations.map((item) => `- ${item.code}: ${item.message}`).join("\n")}

PREVIOUS DRAFT:
${JSON.stringify(diagnosis)}`;
}
