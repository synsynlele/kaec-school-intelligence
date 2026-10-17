# KSI sign-up confirmation email: operational repair

Status: **app-side transparency and resend prepared; live email delivery remains unverified until production Supabase is inspected**

## Critical finding

The KSI `components/auth/auth-form.tsx` used to announce “Account created. Check your email” when `supabase.auth.signUp()` returned no session. This response does not prove email delivery. Supabase intentionally obscures some already-registered accounts to prevent email enumeration.

The correct fix has **two parts**:
1. App-side: do not claim delivery, provide a resend confirmation action, show a useful error on server rejection, and preserve school membership security.
2. Infrastructure: establish **custom SMTP** on **KSI's production Supabase project** and verify live authentication emails to addresses that are not members of the Supabase organization.

Supabase documentation: https://supabase.com/docs/guides/auth/auth-smtp. Default Supabase SMTP is testing-only, restricts recipient addresses to organisation team members, and is rate-limited; it must not be relied upon for public signup.

## Locate the right environment (important)

- KSI's dedicated Supabase project is historically identified as `zaoxfjbiizargeclnzmo`, from `docs/STAGE_1_RUNTIME_VERIFICATION.md`.
- **First compare** that project with the current production `NEXT_PUBLIC_SUPABASE_URL` configuration. Do not change settings on any other KAEC Supabase project.
- At the time this runbook was written the connected Supabase account **did not list or allow access to KSI's production Supabase project**. Auth logs, SMTP settings and live test verification therefore remain unproven; reconnect the owner/team organisation for this project before making claims.

## Diagnose first, do not guess

On the *confirmed KSI project* in https://supabase.com/dashboard:

1. Go to **Authentication → Users**. Use the precise email used during the failed test to inspect `auth.users` status: did it get created; is `email_confirmed_at` null; is this an old account or a Google-only identity? Do not post the password, tokens, full user records or logs publicly.
2. Open **Authentication → Logs / Auth Logs** at the precise time of that signup. Check any `/signup` event, sent-email event and errors such as `Email address not authorized`, `email rate limit exceeded`, SMTP rejection, invalid redirect URL or missing confirmations. Keep raw logs private.
3. Open **Authentication → SMTP Settings**. Determine whether the project is still using Supabase's built-in SMTP. If yes, that is a likely cause of emails never arriving for public users.
4. Check **Authentication → Providers → Email** for email signup and confirmation settings. **Keep email confirmation enabled**. Check Auth URL Configuration: site URL should be `https://www.ksi.name.ng` and allow `https://www.ksi.name.ng/auth/callback` (and any other intentional production callback route).
5. Check the recipient's Spam/Junk and other filtered folders, and whether email is being bounced or dropped by the configured provider. Do not repeatedly attempt signup just to diagnose; the rate limit can hide the root cause.

## Permanent delivery configuration

1. Configure an authenticated production-grade provider that supports SMTP: Resend SMTP, Brevo, Postmark or another suitable provider. Choose based on delivery and cost, not additional Vercel/Supabase upgrades.
2. Verify a domain KAEC owns, including the provider's SPF/DKIM records and DMARC policy. Use a properly authorised sender such as `no-reply@<verified-kaec-domain>`. **Never use `kaecng@gmail.com` as a From address unless the service actually authorises it.** `kaecng@gmail.com` remains the public support contact/reply-to address.
3. Enter SMTP host, port, username, password, verified sender address and sender name under Supabase Authentication → SMTP Settings for the **production KSI project**. Keep secrets in the provider/Supabase dashboard, not GitHub or chat.
4. Review Auth email rate limits appropriate for the service and configure account-signup anti-abuse controls (e.g. CAPTCHA), without disabling confirmations or weakening tenant RLS.
5. Send a confirmation email to a new disposable external email address, outside the Supabase project team. Complete the confirmation link, sign in and sign out, then sign in again; verify the user is still correctly limited to school onboarding until authorised by a school.
6. Exercise **Resend confirmation email** from KSI. Confirm mail arrives, links return to the correct `/auth/callback` path, and the user reaches `/auth/resolve`.
7. Verify password-based signup and Google sign-in separately; a working Google OAuth flow does **not** establish email/password delivery health.

## Google Play reviewer acceptance

- Create a dedicated KSI Demo School with fake-only classes/learners.
- Create a **verified email/password** Google Play reviewer account, assign an active teacher or suitable demonstration role in this demo school through normal governance.
- From a clean Android installation, test sign-in (NOT sign-up), lesson generation, assessment, diagnosis, logout/relogin and school workspace access.
- In Play Console → App content → App access, supply tested credentials and role path **privately**; do not put reviewer passwords in repo, logs, screenshots or ordinary chat.
- Ask for Google Play reconsideration/review only once all credentials and membership are tested. The KSI Play rejection for incorrect login details does **not** by itself prove the email provider is healthy or unhealthy.

## Acceptance gates

- [ ] Confirm Supabase KSI project ID and that it matches the live app
- [ ] Verify actual signup attempt and email delivery error from Auth Logs
- [ ] Confirm custom SMTP is configured and sender domain verified
- [ ] Receive confirmation in a real external email inbox
- [ ] Test resend and confirmation redirects end-to-end
- [ ] Test email/password sign-in and authorised school membership
- [ ] Test Google Play reviewer demo account from a fresh Android app
- [ ] Only then confirm root cause resolved

Avoid performing any unverified database mutations or disabling email confirmation to force a passing test.
