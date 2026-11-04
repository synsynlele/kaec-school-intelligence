import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import {
  alignDiagnosisNarrative,
  alignDiagnosisPronouns,
  diagnosisPronounInstruction,
  studentPronounPreference,
} from "../lib/diagnosis/pronouns";
import { createDiagnosisDocx } from "../lib/docx/diagnosis-docx";
import type { GeneratedDiagnosis } from "../lib/diagnosis/engine";

assert.equal(studentPronounPreference(null), "name_only");
assert.equal(studentPronounPreference("invalid"), "name_only");
assert.equal(studentPronounPreference("she_her"), "she_her");
assert(diagnosisPronounInstruction(null).includes("Do not infer gender"));
assert(diagnosisPronounInstruction("she_her").includes("she/her"));
assert(diagnosisPronounInstruction("he_him").includes("he/him"));

assert.equal(alignDiagnosisNarrative("He has improved his work. She knows her strengths.", "name_only"),
  "The learner has improved the learner's work. The learner knows the learner's strengths.");
assert.equal(alignDiagnosisNarrative("He has improved his work.", "she_her"), "She has improved her work.");
assert.equal(alignDiagnosisNarrative("She has improved her work.", "he_him"), "He has improved his work.");
assert.equal(alignDiagnosisNarrative("She has improved her work.", "they_them"),
  "The learner has improved the learner's work.");

const diagnosis: GeneratedDiagnosis = {
  observedEvidence: [{ id:"ev1", source:"teacher_observation", domain:"academic", statement:"He completed his exercise.", metric:"Teacher observation" }],
  detectedPatterns: [{ statement:"He is progressing.", evidenceIds:["ev1"], confidence:"medium" }],
  possibleInterpretations: [{ statement:"He may need support.", evidenceIds:["ev1"], confidence:"medium", uncertaintyNote:"His growth needs monitoring." }],
  academicSkillStrengths: [{ domain:"academic", statement:"His reading is better.", evidenceIds:["ev1"] }],
  academicSkillChallenges: [{ domain:"academic", statement:"He needs practice.", evidenceIds:["ev1"] }],
  characterStrengths: [{ statement:"He listens.", evidenceIds:["ev1"] }],
  characterChallenges: [],
  conciseDiagnosis:"He shows progress in his reading & comprehension.",
  schoolAcademicActions:[{ action:"Support his reading.", timeframe:"Next 2 weeks", evidenceIds:["ev1"] }],
  parentAcademicActions:[{ action:"Check his reading.", timeframe:"Weekly", evidenceIds:["ev1"] }],
  schoolCharacterActions:[],
  parentCharacterActions:[],
  builderGrowthDirection:"He can lead.",
  encouragementNote:"His growth matters.",
  evidenceLimitations:["His scores are not yet available."],
};
const corrected = alignDiagnosisPronouns(diagnosis, "she_her");
assert.equal(corrected.conciseDiagnosis,"She shows progress in her reading & comprehension.");
assert.equal(corrected.academicSkillStrengths[0].statement,"Her reading is better.");
assert.equal(corrected.observedEvidence[0].id,"ev1","Do not change evidence IDs.");
assert.equal(diagnosis.conciseDiagnosis,"He shows progress in his reading & comprehension.","Do not mutate source diagnosis.");

const docInput = {
  workspaceName:"École KAEC & Friends",
  brandLogoJpegBase64:"",
  hasSchoolLogo:false,
  studentName:"Amara & Co <Test>",
  className:"JSS 2",
  academicSession:"2026/2027",
  term:"FIRST TERM",
  diagnosisMode:"quick_teacher",
  assessmentTitle:"<Mathematics>",
  diagnosis:corrected,
  reviewedAt:"2026-11-03T12:00:00Z",
  finalisedAt:"2026-11-04T12:00:00Z",
};
const bytes = createDiagnosisDocx(docInput);
assert(bytes.length > 1200, "Word export must contain a real packaged document.");
assert.equal(Buffer.from(bytes).readUInt32LE(0),0x04034b50,"DOCX must be a ZIP archive.");
function unzipFile(zip: Uint8Array, target: string): string {
  const buf = Buffer.from(zip); let off = 0;
  while (off < buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const packed = buf.readUInt32LE(off + 18);
    const nameLength = buf.readUInt16LE(off + 26);
    const extraLength = buf.readUInt16LE(off + 28);
    const name = buf.subarray(off + 30, off + 30 + nameLength).toString("utf8");
    const start = off + 30 + nameLength + extraLength;
    if (name === target) return inflateRawSync(buf.subarray(start, start + packed)).toString("utf8");
    off = start + packed;
  }
  throw new Error("Missing DOCX part: "+target);
}
const xml = unzipFile(bytes,"word/document.xml");
const types = unzipFile(bytes,"[Content_Types].xml");
assert(xml.includes("Amara &amp; Co &lt;Test&gt;"),"Word export escapes learner data.");
assert(xml.includes("École KAEC &amp; Friends"),"Word retains Unicode school name.");
for(const phrase of ["STUDENT DIAGNOSIS", "ACADEMIC / SKILL STRENGTHS", "CHARACTER CHALLENGES", "AGREED GROWTH ACTION PLAN", "SUPPORTING OBSERVATIONS", "HUMAN REVIEW", "She shows progress", "The learner"]) {
  assert(xml.includes(phrase), "Missing Word report content: "+phrase);
}
assert(types.includes("wordprocessingml.document.main+xml"));
assert.throws(()=>createDiagnosisDocx({...docInput, finalisedAt:""}), /approval/);
assert.throws(()=>createDiagnosisDocx({...docInput, term:""}), /Term/);

const setup = readFileSync("components/workspace/academic-setup-client.tsx","utf8");
const api = readFileSync("app/api/diagnosis/route.ts","utf8");
const route = readFileSync("app/api/diagnosis/pdf/route.ts","utf8");
const result = readFileSync("components/diagnosis/diagnosis-result-client.tsx","utf8");
const migration = readFileSync("supabase/migrations/076_diagnosis_student_pronouns.sql","utf8");
assert(setup.includes('pronoun_preference: studentPronouns') && setup.includes('pronoun_preference: editing.pronounPreference'));
assert(setup.includes("pronounReady"), "UI must hide unavailable schema settings rather than fail on old deployments.");
assert(api.includes("alignDiagnosisPronouns(") && api.includes("student.pronoun_preference"));
assert(route.includes('format === "docx"') && route.includes("createDiagnosisDocx"));
assert(route.includes('!diagnosis.reviewed_at') && route.includes('!diagnosis.finalised_at'));
assert(result.includes('downloadReport("docx")'), "Result must expose Word download.");
assert(migration.includes("default 'name_only'") && migration.includes("students_pronoun_preference_allowed"));
console.log("Diagnosis pronoun consistency and approved PDF/Word download verifications passed.");
