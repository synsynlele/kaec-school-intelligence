import type { GeneratedHqlsLesson } from "./engine";

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const kinds = "word cards|sentence cards|scenario cards|words|sentences|examples|scenarios|cards|passages";

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(textValues);
  return [];
}

// Only explicit supplied-list promises qualify. Never count ordinary prose,
// numbered task outputs or teacher-only answers as learner material.
export function checkPromisedMaterials(lesson: GeneratedHqlsLesson) {
  const issues: { stageNumber: number; category: string; evidence: string; correction: string; evidenceMatch: string }[] = [];
  for (const stage of lesson.stages) {
    const texts = textValues(stage);
    const promise = new RegExp(`\\b(\\d{1,3}|${numberWords.slice(1).join("|")})\\s+(${kinds})\\b`, "gi");
    for (const text of texts) {
      for (const match of text.matchAll(promise)) {
        const before = text.slice(0, match.index);
        const after = text.slice(match.index + match[0].length);
        if (!/^\s+(?:below|provided|listed|shown|above)\b/i.test(after) &&
          !/\b(?:give|use|read|sort|compare|study|show|distribute|classify)\b[^.!?\n]{0,90}$/i.test(before)) continue;
        const expected = /^\d+$/.test(match[1]) ? Number(match[1]) : numberWords.indexOf(match[1].toLowerCase());
        const kind = match[2].toLowerCase();
        const reference = text.match(/\b(?:from|in|see)\s+stage\s+(\d)\b/i);
        const earlier = reference ? lesson.stages.find((item) => item.stageNumber === Number(reference[1]) && item.stageNumber < stage.stageNumber) : undefined;
        const materialTexts = [stage.experience, ...(stage.stageNumber === 5 ? [stage.teachingContent] : []), ...(earlier ? [earlier.experience] : [])];
        const heading = new RegExp(`^\\s*(?:#{1,4}\\s*)?(?:\\*\\*)?(?:materials\\s*[-—:]\\s*)?${kind}(?:\\s*\\(\\d+\\))?(?:\\*\\*)?[ \t]*:[ \t]*(.*)$`, "im");
        let found = false;
        for (const source of materialTexts) {
          const header = heading.exec(source);
          if (!header) continue;
          const headerCount = header[0].match(/\((\d+)\)/);
          if (headerCount && Number(headerCount[1]) !== expected) continue;
          const tail = source.slice(header.index + header[0].length);
          const entries: { position: number; value: string }[] = [];
          for (const line of tail.split(/\r?\n/)) {
            if (!line.trim() && !entries.length) continue;
            const entry = line.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/);
            if (!entry) break;
            entries.push({ position: Number(entry[1]), value: entry[2] });
          }
          found = entries.length === expected && entries.every((entry, index) => entry.position === index + 1 && !/\b(?:etc\.?|tbd|placeholder|insert here)\b|\.\.\.|…/i.test(entry.value));
          if (found && /^(?:words|word cards)$/.test(kind)) {
            found = new Set(entries.map((entry) => entry.value.trim().toLowerCase())).size === expected;
          }
          if (found) break;
        }
        if (!found) {
          issues.push({ stageNumber: stage.stageNumber, category: "task_integrity", evidence: match[0], evidenceMatch: "exact",
            correction: `Supply exactly ${expected} actual ${kind} in this stage's experience under '${kind} (${expected}):', numbered 1 through ${expected}, one complete entry per line. Do not count task instructions, placeholders or answers as materials. If reusing an earlier stage, name its stage number and ensure its complete numbered material list exists.` });
        }
      }
    }
  }
  return issues.filter((issue, index) => issues.findIndex((other) => other.stageNumber === issue.stageNumber && other.evidence === issue.evidence) === index);
}
