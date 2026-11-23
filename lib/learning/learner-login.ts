export const learnerLoginDomain = "students.ksi.name.ng";

export function resolveLearnerLogin(login: string) {
  const normalized = login.trim().toLowerCase();
  return /^ksi-[a-f0-9]{18}$/.test(normalized) ? `${normalized}@${learnerLoginDomain}` : login.trim();
}
