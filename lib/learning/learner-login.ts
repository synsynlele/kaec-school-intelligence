import { learnerLoginDomain, schoolLoginEmail } from "./school-login";

export { learnerLoginDomain };

export function resolveLearnerLogin(login: string) {
  const normalized = login.trim().toLowerCase();
  if (/^ksi-[a-f0-9]{18}$/.test(normalized)) return `${normalized}@${learnerLoginDomain}`;
  return schoolLoginEmail(normalized, learnerLoginDomain) ?? login.trim();
}
