"use client";

import { useEffect } from "react";

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function SchemePrefillBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "scheme") return;

    const values = {
      subject: params.get("subject")?.trim() ?? "",
      topic: params.get("topic")?.trim() ?? "",
      classLevel: params.get("classLevel")?.trim() ?? "",
      objective: params.get("objective")?.trim() ?? "",
    };
    if (!values.subject && !values.topic && !values.classLevel && !values.objective) return;

    let attempts = 0;
    const apply = () => {
      attempts += 1;
      const subject = document.querySelector<HTMLInputElement>('input[placeholder="English Language"]');
      const topic = document.querySelector<HTMLInputElement>('input[placeholder="Parts of speech"]');
      const classLevel = document.querySelector<HTMLInputElement>('input[placeholder="JSS 1"]');
      const objective = document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="By the end of the lesson"]');

      if (subject && values.subject) setInputValue(subject, values.subject);
      if (topic && values.topic) setInputValue(topic, values.topic);
      if (classLevel && values.classLevel) setInputValue(classLevel, values.classLevel);
      if (objective && values.objective) setInputValue(objective, values.objective);

      const complete = Boolean(subject && topic && classLevel && objective);
      if (!complete && attempts < 30) window.setTimeout(apply, 100);
      if (complete) {
        document.querySelector('form')?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    window.setTimeout(apply, 0);
  }, []);

  return null;
}
