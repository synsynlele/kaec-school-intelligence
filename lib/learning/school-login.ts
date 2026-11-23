export const learnerLoginDomain = "students.ksi.name.ng";
export const parentLoginDomain = "parents.ksi.name.ng";

export function schoolLoginEmail(username: string, domain: string): string | null {
  const value = username.trim().toLowerCase();
  if (value.length > 58 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*@[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(value)
    || value.endsWith(`@${learnerLoginDomain}`) || value.endsWith(`@${parentLoginDomain}`)) return null;
  return `login+${value.replace("@", "+")}@${domain}`;
}

export function schoolLoginUsername(email: string, domain: string): string {
  const suffix = `@${domain}`;
  if (!email.endsWith(suffix)) return email;
  const local = email.slice(0, -suffix.length);
  if (local.startsWith("login+")) return local.slice(6).replace("+", "@");
  return domain === learnerLoginDomain ? local : email;
}

export function resolveParentLogin(username: string): string {
  const value = username.trim().toLowerCase();
  return schoolLoginEmail(value, parentLoginDomain) ?? value;
}
