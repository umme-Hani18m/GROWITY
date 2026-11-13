# Growity — Implementation and design plan

## Product scope and implementation approach

Build Growity as a child-safety-first informational and case-management website, not an adoption agency and not a mobile app. The project follows the user's specified Next.js App Router, strict TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/private Storage, Zod validation, and translation-file approach, with Vercel documented as the deployment target. Server Components are the default; client code is limited to interactive controls. Public information and role portals are separated, and no production accounts or real case data are created in this sandbox.

All role-specific server operations must validate input on the server, check authenticated role and ownership, use parameterized Supabase queries under RLS, and write audit events for sensitive record reads and changes. PostgreSQL migrations will create the requested entities, constraints, indexes, append-only event/audit tables, explicit table grants, deny-by-default RLS, and private storage policies. A helper that derives trusted role context from protected authentication claims is preferable to trusting user-editable profile values. Service-role access is server-only and narrowly reserved for operations that cannot be performed safely under a user JWT; ordinary application queries use the authenticated user's session. The private storage flow validates file size/type and records before it offers signed URLs with a 60-second expiry. Emergency email alerts must not include complaint text or personal details. Any integration that cannot be safely verified without real provider configuration remains unavailable rather than silently falling back to insecure behavior.

The deliverable includes public and role entry pages, information/policy pages, the foster-interest flow, portal interface and guarded server actions, Supabase migrations and fake seed data, translation assets, environment template, setup README, access-control checklist, and explicit assumptions/unfinished items. No actual child records, realistic credentials, photos, document samples, testimonials, or AI-generated art are used. The legal retention duration remains unset for lawyer review; policy copy is marked draft. The site is not published as a live child-data service in this task.

## Project structure

- `src/app/`: App Router pages, layouts, route handlers, and server actions; public pages and role-specific interfaces.
- `src/components/`: shared navigation, Childline banner, collapsible page explainer, law panel, quick exit, forms, status displays, and slideshow controls.
- `src/lib/`: server-only Supabase clients, safe environment validation, Zod schemas, auth/role/ownership guards, audit helpers, upload validation, and application constants.
- `messages/en.json`, `messages/hi.json`: all enabled user-facing text; keys kept structurally aligned. Language registry lists all requested languages, with only English/Hindi enabled. RTL layout support is prepared for Urdu, Kashmiri, and Sindhi without enabling unreviewed translations.
- `supabase/migrations/`: ordered PostgreSQL schema, RLS/grant policies, private storage configuration, and secure helper functions.
- `supabase/seed.sql`: obviously fake, non-identifying sample data only.
- `docs/`: setup/deployment instructions, exact environment variable inventory, assumptions, and a 20+ case access-control checklist.
- `public/manus-routes.json`: route manifest kept in sync with the actual page routes.

## Design direction

- **Design Movement:** A restrained civic-service editorial style, closer to a clear public-information desk than a child-themed app.
- **Core Principles:** Safety before conversion; plain language over institutional jargon; relevant information only; calm, accessible rhythm on small screens.
- **Color Philosophy:** Pure white `#FFFFFF` is the page ground. Deep green `#1F5C4A` anchors trusted actions, slate text preserves legibility, soft blue-green panels distinguish support information, and marigold `#E9A23B` is reserved for focus and meaningful attention. Remove beige/skin-like background fills; keep the palette flat with no dark mode or gradients.
- **Layout Paradigm:** Editorial, left-aligned page flow with fewer sections, clear role-first pathways, and a compact collapsed related-law line that links to the complete legal reference only when relevant. The homepage does not repeat the full law list or glossary.
- **Signature Elements:** A precise geometric route/wayfinding mark (no leaf or childlike illustration); adult, neutral wordmark typography; short, page-specific law references and visible Childline access.
- **Interaction Philosophy:** Put “Learn more” details within each Child, Parent, NGO, and Team path. Keep the homepage scannable, state what each login path does, and never reveal sensitive information unexpectedly. Quick Exit remains prominent and immediate.
- **Animation:** No decorative motion or parallax. The homepage slideshow may advance every six seconds only when motion is allowed, with pause/play and previous/next controls; it stops for `prefers-reduced-motion`. Expand/collapse remains brief and becomes immediate under reduced motion.
- **Typography System:** Use a professional neutral sans-serif (Inter with system and Noto script fallbacks), restrained weights and tracking, a 16px minimum body size, and a clear heading hierarchy. Avoid rounded display styles and excessively heavy weights. Right-to-left direction is applied for Urdu, Kashmiri, and Sindhi when enabled.
- **Brand Essence:** A clear, careful service guide for children, families, NGOs, and child-protection teams—credible, calm, direct.
- **Brand Voice:** Direct, kind, and non-judgmental; explain the next step and never promise an outcome. Examples: “You can ask for help here.” “Growity shares information and records; official adoption decisions happen through the legal process.”
- **Wordmark & Logo:** Replace the rejected sprout/leaf mark with a restrained geometric wayfinding/G mark and a mature wordmark. Use no third-party logo, child imagery, or partner claim.
- **Signature Brand Color:** Deep evergreen `#1F5C4A`.

## Material constraints

The Supabase project, SMTP/OTP provider, CAPTCHA provider, emergency email service, caseworker onboarding process, and independent security/legal review are not provisioned by this repository. Configuration templates and integration points can be supplied, but those external resources must not be represented as already connected or production-ready. The 4-digit child PIN requirement needs carefully rate-limited server-side handling and in-person reset; staff MFA and adult OTP also depend on Supabase Auth/provider configuration. Privacy-critical paths must fail closed when configuration is missing. Public policy pages use concise service-purpose and not-legal-advice statements; legal review remains an operational launch prerequisite, not a public “draft pending review” banner. Photographs may be used only when supplied by the user and cleared for licensing/model-release requirements; no AI or stock photos are used.

## User-requested refinements (25 October 2026)

- Show only laws relevant to a particular page/portal in a short collapsed disclosure; keep the complete reference and glossary on the dedicated Laws page. Remove the homepage care/protection explainer block and place role-specific Learn more content inside each Child, Parent, NGO, and Growity Team entry.
- Replace the disliked leaf/sprout brand mark and rounded Nunito style; use a restrained geometric wordmark and professional typography. Change cream/beige/skinish page surfaces to white and neutral white-gray.
- Remove visible “DRAFT, pending legal review” labels from Terms, Privacy, and Child Safety pages without implying legal certification; retain the legal-review blocker in internal setup/release documentation.
- Add an NGO volunteering pathway for verified organizations and universities: supervised entertainment/group activities, mentoring, cleaning drives, and other youth-oriented social activities; keep volunteers away from child case records and require host oversight/safeguarding checks. Participation points/certificates may be recorded for verified attendance; academic credit is determined by the volunteer’s institution and must not be promised by Growity.
- Explain in one child-friendly sentence that the child’s caseworker provides the short code and 4-digit PIN in person.
- Parent/adult OTP email depends on configured Supabase Auth email delivery. Current project environment has no Supabase, Turnstile, rate-limit, or PIN credentials; obtain these only through the secure project input card and do not claim live email delivery until configured and tested.
- The expected user-supplied PDF is not present in the current workspace. Keep the slideshow placeholders until the PDF is reuploaded and its images/usage rights are verified; never substitute stock or AI imagery.


## Round 2 implementation plan — 25 October 2026

### Safety and data model

Preserve deny-by-default RLS, private Storage, consent capture, append-only audit logging, Quick Exit, no caste/creed fields, no child browsing, and no AI-generated or substitute photos. Add idempotent migrations after `202610240011` for: child onboarding requests containing only the minimum safe intake fields; adult after-care identity-verification requests with separate `in_care_18_plus` and `adopted_18_plus` pathways; verified-email gating for adult codes; demo-only seed expansion and cleanup. Public request forms write through server-only, rate-limited actions; staff reads and completion updates require an MFA-verified caseworker or the appropriate staff role.

### Auth and role flows

Child onboarding creates no login. A caseworker later creates the child Auth user, derives the password from the child id, PIN, and `CHILD_PIN_PEPPER`, shows the random PIN exactly once, records consent/audit data, and marks the request complete. Successful child PIN login lands on an existing localized child home/dashboard route. Adult applicants receive the same neutral response whether or not an email matches a staff-verified request; only verified records may request an OTP. Parent, NGO, and adult flows use explicit email, consent, Turnstile when configured, six-digit verification, resend countdown, and actionable error states. Staff sign-in adds TOTP enrollment before the existing AAL2 verification gate.

### Interface and assets

Replace the Home-only header with a keyboard-accessible Get started menu, Help/FAQ, language picker, and responsive mobile menu while retaining the Childline bar and four homepage role tiles. Replace the current geometric mark with an original flat SVG mascot/wordmark and expose the mark as favicon with accessible text. Keep slideshow controls and reduced-motion behavior; import only the user-supplied PDF photographs after the PDF is available and rights/model-release confirmation is received. Missing photos remain grey “Photo coming soon” placeholders.

### Delivery boundary

Run strict TypeScript and production build checks. Publish only after the user confirms the selected supplied photographs are rights-cleared and suitable for use. The current workspace contains no PDF, so the slideshow photo import and final publication remain blocked until re-upload/confirmation.
