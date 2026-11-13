# Supabase provider setup notes

Checked 25 October 2026 for the Growity Development Preview. Do not use these notes as authorization to access production data.

## API key handling

The supplied public key is a Supabase `sb_publishable_…` key. Supabase documents publishable keys as browser-safe, low-privilege keys and secret keys as server-only, elevated credentials. New publishable and secret keys are not JWTs; Supabase instructs callers to put them in the `apikey` header only. Sending one as `Authorization: Bearer …` can make the gateway attempt JWT validation and return 401. Growity's Supabase clients therefore use a fetch wrapper that removes only the exact non-JWT project-key bearer while retaining real signed-in user JWTs. [1] [2]

The configured URL was found to contain the standard `/rest/v1/` endpoint suffix rather than only the project origin. Growity normalizes that one recognized suffix only for a `*.supabase.co` host; unrelated non-root paths, URL credentials, queries, fragments, and non-HTTPS remote URLs fail closed. The Supabase Auth settings endpoint responded HTTP 200. A deliberately invalid email request using `shouldCreateUser: false` was rejected with HTTP 422, confirming that the Auth endpoint was reached through the public-key header wrapper; no user or email was created/sent. The REST root returned HTTP 401 with the supplied public key, so Data API access remains unverified. No table query, database write, or real OTP request was made.

## Email OTP setup

Supabase's default Auth SMTP is limited to sending only to addresses belonging to the project's organization team and currently lists a two-message-per-hour limit; it is intended for non-production testing. General public OTP delivery requires a custom SMTP provider and a verified sender address. [3]

The existing Growity email integration uses Resend for protection-alert messages. Resend's official Supabase instructions require a Resend API key and verified domain, with SMTP host `smtp.resend.com`, port `465`, username `resend`, and the API key as the SMTP password; Supabase also requires a sender email and name. The Auth SMTP settings live in the Supabase Dashboard; the app's `RESEND_API_KEY` variable does not configure them automatically. [6]

Supabase's email template must include `{{ .Token }}` to send the six-digit OTP rather than a magic link. Growity verifies a submitted email code with the `email` OTP type. [4] [5]

**Not yet verified:** custom SMTP host, credentials, and sender have not been configured; no email was sent. Email OTP delivery should remain described as unverified until the Supabase project/key pair is confirmed, the email template is checked, and the selected SMTP provider is configured. The user must provide any mail-provider secret through a secure input flow, never chat or source control.

## Live audit — 8 November 2026

The managed runtime now contains the current Supabase URL, matching publishable key, matching server-only secret key, and both Turnstile keys through the protected secret flow. The Supabase Auth settings endpoint resolves with HTTP 200. A deliberately invalid no-send OTP preflight reached the active Auth project and returned `otp_disabled`; it did not create a user or send mail. A zero-row service-role REST probe reached the database gateway but returned `public.profiles` not found, confirming that the Growity migrations have not yet been executed in this project. The ordered migration package and SQL Editor instructions are in [`supabase/MIGRATION_RUNBOOK.md`](../supabase/MIGRATION_RUNBOOK.md). Custom SMTP and the numeric `{{ .Token }}` template remain dashboard-level configuration and are not controlled by application environment variables.

## Sources

[1]: https://supabase.com/docs/guides/getting-started/api-keys "API keys"
[2]: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys "Migrating to publishable and secret API keys"
[3]: https://supabase.com/docs/guides/auth/auth-smtp "Send emails with custom SMTP"
[4]: https://supabase.com/docs/guides/auth/auth-email-templates "Email templates"
[5]: https://supabase.com/docs/guides/auth/auth-email-passwordless "Passwordless email sign-in"
[6]: https://resend.com/docs/send-with-supabase-smtp "Send emails using Supabase with SMTP"
