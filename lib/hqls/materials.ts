import type { GeneratedHqlsLesson } from "./engine";

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const kinds = "picture-word cards|picture word cards|picture cards|word cards|sentence cards|scenario cards|words|sentences|examples|scenarios|cards|passages";

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
        // "Card 1: sentence cards" labels an existing item; 1 is not a quantity.
        if (/^\d+$/.test(match[1]) && /\b(?:card|word|sentence|example|scenario|passage|item)\s*$/i.test(before)) continue;
        if (!/^\s+(?:below|provided|listed|shown|above)\b/i.test(after) &&
          !/\b(?:give|use|reuse|reusing|revisit|read|sort|compare|study|show|distribute|classify)\b[^.!?\n]{0,90}$/i.test(before)) continue;
        const expected = /^\d+$/.test(match[1]) ? Number(match[1]) : numberWords.indexOf(match[1].toLowerCase());
        const kind = match[2].toLowerCase();
        const subset = /\b(?:choose|select|pick|reuse|revisit|model)\b[^.!?\n]{0,90}$/i.test(before) ||
          /^\s+(?:from|out of|of the)\b/i.test(after);
        const referenceText = [text, stage.experience, ...stage.teacherPrompts, ...stage.learnerActions].join("\n");
        const namedStages = [...referenceText.matchAll(/\bstage\s+(\d)\b/gi)].map((ref) => Number(ref[1]));
        if (/\b(?:first (?:trial|attempt)|trial\s*1)\b/i.test(referenceText)) namedStages.push(4);
        const earlier = lesson.stages.filter((item) => namedStages.includes(item.stageNumber) && item.stageNumber < stage.stageNumber);
        const implicitReuse = /\b(?:same|again|reuse|reusing|revisit|earlier|previous|original)\b/i.test(text);
        const impliedEarlier = !earlier.length && implicitReuse ? lesson.stages.filter((item) => item.stageNumber < stage.stageNumber) : [];

        const materialTexts = [stage.experience, ...(stage.stageNumber === 5 ? [stage.teachingContent] : []), ...earlier.flatMap((item) => [item.experience, ...(item.stageNumber === 5 ? [item.teachingContent] : [])]), ...impliedEarlier.map((item) => item.experience)];
        const headingKind = kind === "cards" ? "(?:picture[- ]word cards|picture cards|word cards|sentence cards|scenario cards|word-only cards|cards)"
          : kind === "word cards" ? "(?:word cards|word-only cards|cards)"
          : /picture[- ]word cards/.test(kind) ? "(?:picture[- ]word cards|cards)"
          : /cards$/.test(kind) ? `(?:${kind}|cards)` : kind;
        const heading = new RegExp(`(?<!sentence )(?<!scenario )(?<!word )(?<!picture )(?<!picture-word )\\b(?:#{1,4}\\s*)?(?:\\*\\*)?(?:materials\\s*[-—:]\\s*)?${headingKind}(?:\\s+per\\s+(?:pair|group|team|learner|child))?(?:\\s*\\(\\d+\\))?(?:\\*\\*)?[ \t]*:[ \t]*(.*)$`, "im");
        let found = false;
        let hasRecognisedHeading = false;
        let validImpliedSources = 0;
        for (const source of materialTexts) {
          const header = heading.exec(source);
          if (!header) continue;
          hasRecognisedHeading = true;
          const headerCount = header[0].match(/\((\d+)\)/);
          const listedCount = headerCount ? Number(headerCount[1]) : expected;
          if (listedCount !== expected && !(subset && listedCount >= expected)) continue;
          // Inline numbering is presentation-equivalent to separate lines.
          // Only a whitespace-delimited item marker starts a new entry.
          const tail = (header[1] + "\n" + source.slice(header.index + header[0].length))
            .replace(/[ \t]+(?=\d+[.)][ \t]+)/g, "\n");
          const entries: { position: number; value: string }[] = [];
          for (const line of tail.split(/\r?\n/)) {
            if (!line.trim() && !entries.length) continue;
            const entry = line.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/);
            const bullet = line.match(/^\s*[-*•]\s+(.+?)\s*$/);
            if (!entry && !bullet) break;
            entries.push({ position: entry ? Number(entry[1]) : entries.length + 1, value: entry ? entry[2] : bullet![1] });
          }
          found = entries.length === listedCount && entries.every((entry, index) => entry.position === index + 1 && !/\b(?:etc\.?|tbd|placeholder|insert here)\b|\.\.\.|…/i.test(entry.value));
          // Repeated words can be intentional practice materials, not omissions.
          if (!entries.length && /^(?:words|word cards)$/.test(kind)) {
            const values = header[1].split(/[,;]/).map((value) => value.trim()).filter(Boolean);
            found = values.length === listedCount && values.every((value) =>
              /^[\p{L}\p{M}'’\-]+$/u.test(value) && !/^(?:etc|tbd|placeholder)$/i.test(value));
          }
          if (found && impliedEarlier.some((item) => item.experience === source)) {
            validImpliedSources++;
            found = false;
          } else if (found) break;
        }
        if (!found && validImpliedSources === 1) found = true;
        // An unknown layout is not evidence that materials are absent. Defer
        // plausible complete content to the semantic reviewer, with a visible note.
        const alternativeContent = !hasRecognisedHeading && materialTexts.some((source) => {
          const lines = source.split(/\r?\n/);
          let count = 0;
          for (const line of lines) {
            const entry = line.match(/^\s*(?:\d+[.)]|[-*•])\s+(.+)$/);
            if (entry && !/\b(?:tbd|placeholder|etc)\b|\.\.\.|…/i.test(entry[1]) &&
              !/^(?:write|sort|discuss|agree|explain|choose|reflect|label|produce|work|give|ask)\b/i.test(entry[1])) count++;
            else count = 0;
            if (count === expected) return true;
          }
          const quotes = [...source.matchAll(/["“]([^"“”\n]+)["”]/g)];
          return quotes.length === expected && quotes.every((quote) =>
            !/\b(?:tbd|placeholder|etc)\b|\.\.\.|…/i.test(quote[1]));
        });
        if (!found && alternativeContent) {
          issues.push({ stageNumber: stage.stageNumber, category: "teacher_guidance", evidence: match[0], evidenceMatch: "layout_uncertain",
            correction: `The ${expected} ${kind} appear in an alternative layout. Confirm the intended set when preparing; a specific heading or numbering style is optional.` });
          continue;
        }

        if (!found) {
          issues.push({ stageNumber: stage.stageNumber, category: "task_integrity", evidence: match[0], evidenceMatch: "exact",
            correction: `The checker could not locate the promised ${expected} ${kind}. Supply their actual content or clearly identify an earlier complete set and any selected entries. Inline lists, bullets and numbered lists are valid; no particular heading or repeated copy is required. Do not substitute placeholders or teacher-only answers for essential learner material.` });
        }
      }
    }
  }
  return issues.filter((issue, index) => issues.findIndex((other) => other.stageNumber === issue.stageNumber && other.evidence === issue.evidence) === index);
}
