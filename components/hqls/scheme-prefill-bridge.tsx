"use client";

import { useEffect } from "react";

function setControlValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function normaliseLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function selectOptionByLabel(element: HTMLSelectElement, label: string) {
  const target = normaliseLabel(label);
  const option = Array.from(element.options).find(
    (item) => normaliseLabel(item.textContent ?? "") === target,
  );
  if (option) setControlValue(element, option.value);
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
      const subject = document.querySelector<HTMLSelectElement>("#hqls-subject");
      const topic = document.querySelector<HTMLInputElement>('input[placeholder="Parts of speech"]');
      const classLevel = document.querySelector<HTMLSelectElement>("#hqls-class");
      const objective = document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="By the end of the lesson"]');

      if (subject && values.subject) selectOptionByLabel(subject, values.subject);
      if (topic && values.topic) setControlValue(topic, values.topic);
      if (classLevel && values.classLevel) selectOptionByLabel(classLevel, values.classLevel);
      if (objective && values.objective) setControlValue(objective, values.objective);

      const complete = Boolean(subject && topic && classLevel && objective);
      if (!complete && attempts < 30) window.setTimeout(apply, 100);
      if (complete) {
        document.querySelector("form")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    };

    window.setTimeout(apply, 0);
  }, []);

  return null;
}
