const TEMPORARY_CLASS_PREFIX =
  /^(entering|incoming|prospective|prospective-entry|newly-admitted)\b/i;

export function isTemporaryClassLabel(value: string) {
  return TEMPORARY_CLASS_PREFIX.test(value.trim());
}

export function classNameValidationMessage(value: string) {
  const name = value.trim();
  if (!name) return "Enter the actual class name.";

  if (isTemporaryClassLabel(name)) {
    const suggested = name.replace(TEMPORARY_CLASS_PREFIX, "").trim();
    return suggested
      ? `Use the actual class name "${suggested}" instead of the temporary label "${name}".`
      : "Use the actual operational class name, not an entering/incoming/prospective label.";
  }

  return null;
}
