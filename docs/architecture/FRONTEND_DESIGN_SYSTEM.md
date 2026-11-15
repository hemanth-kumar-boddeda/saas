# CreatorFlow — Frontend Design System

Status: **Proposed**. The canonical route table for all **27 screens** is **§3** and is normative — it supersedes any other route notation in the companion documents (`SYSTEM_COMPONENT_ARCHITECTURE.md` §5 defers here). Stack: Next.js 14 App Router (verified `client/`), RTK Query (verified `client/redux`), cookie sessions (no tokens in JS).

---

## 1. Global application shell

Three nested shells, one per route group:

| Shell | Route group | Contains |
|---|---|---|
| **Public shell** | `(public)` | minimal header (logo, Sign in, Get started), footer, legal links |
| **Auth shell** | `(auth)` | centered card, no navigation, no workspace context |
| **App shell** | `(app)` | persistent left rail + top bar + content slot + toast/realtime layer |

App shell anatomy:

```
┌──────────┬──────────────────────────────────────────────┐
│          │ Top bar: breadcrumb · search · notifications │
│ Left     ├──────────────────────────────────────────────┤
│ rail     │                                              │
│ (nav)    │  Content slot (route segment renders here)   │
│          │                                              │
│          ├──────────────────────────────────────────────┤
│          │ Realtime status pill · toast stack           │
└──────────┴──────────────────────────────────────────────┘
```

- **Workspace switcher** sits at the top of the rail (all memberships, current = bold).
- The rail collapses to an icon rail ≤ 1024 px and to a drawer ≤ 768 px.
- Route-group layout files: `app/(app)/layout.tsx` (shell), `app/(app)/workspaces/[wsId]/layout.tsx` (membership guard + workspace context provider), `app/(app)/workspaces/[wsId]/projects/[projectId]/layout.tsx` (project shell), `…/review/[versionId]/layout.tsx` (review workspace shell — player + panel layout).
- **Server components** scaffold data/SEO pages; **client components** own player, editors, realtime, forms (`SYSTEM_COMPONENT_ARCHITECTURE.md` §5).
- **Tenant boundary:** the `/workspaces/[wsId]/…` segment — **not** `/workspace/[wsId]`.

## 2. Navigation & routing

- App Router route groups: `(public)`, `(auth)`, `(app)` (normative grouping per `SYSTEM_COMPONENT_ARCHITECTURE.md` §5).
- Left-rail primary nav (member): Dashboard · Projects · Assets · Uploads · AI Studio · Thumbnails · Publishing · Calendar · Notifications · Settings.
- Breadcrumbs: `Workspace / Project / Version` — built from route params, never from client state.
- Guard layers: layout-level membership check (server) → 404/403 view; client guards are cosmetic only (verified lesson: `client/app/hooks/adminProtected.tsx:11-18`).
- Unauthenticated deep links redirect to `/signin?next=…`; a 401 from any RTK Query mutation triggers the re-login path (toast + redirect), never a silent retry loop.

## 3. Canonical route table — 27 screens (normative)

Roles: **viewer** = read-only (cannot comment — OD-03), **editor** = create/comment/prepare packages, **admin/owner** = approve/execute/billing. API paths are from `API_CONTRACT_AND_MODULES.md` §3.

| # | Screen | Route | Purpose | Roles | Key components | API dependencies |
|---|---|---|---|---|---|---|
| **1** | **Dashboard** | `/workspaces/[wsId]` | Priority overview: projects by review state, processing progress, pending approvals, notifications | member | `StatCard`, `ProjectTable`, `ProcessingFeed`, `ApprovalQueue` | `GET /workspaces/:wsId/projects`, `GET …/notifications`, `GET …/usage` (admin+), socket `processing.progress` |
| **2** | **Project workspace** | `/workspaces/[wsId]/projects/[projectId]` | Project hub: versions, members, assets, package status, roll-up review state | member | `ProjectHeader`, `VersionList`, `MemberStrip`, `PackageStatusCard` | `GET …/projects/:id`, `GET …/versions`, `GET …/publish-packages`, `GET …/revisions` |
| **3** | **Video review** | `/workspaces/[wsId]/projects/[projectId]/review/[versionId]` | Frame-accurate player + review actions (submit/withdraw/approve/request-changes) | member (actions gated) | `ReviewPlayer` (HLS.js), `ReviewActionBar`, `ApprovalDialog`, `VersionBadge` | `GET …/versions/:id/playback`, `POST …/versions/:id/submit`, `POST …/approve`, `POST …/request-changes`, `POST …/withdraw`, socket `approval.decided` |
| **4** | **Timestamped comments** | `/workspaces/[wsId]/projects/[projectId]/review/[versionId]/comments` | Comment board for one version: timeline markers, threads, filters, resolve | member (write = editor+) | `CommentTimeline`, `CommentThread`, `CommentComposer`, `RangeMarker` | `GET …/versions/:id/comments`, `POST …/comments`, `PATCH …/comments/:id`, `POST …/comments/:id/replies`, socket `comment.created` |
| **5** | **Version history** | `/workspaces/[wsId]/projects/[projectId]/versions` | All versions with processing/review state, revision links, diffs of metadata | member | `VersionTimeline`, `RevisionLink`, `StateChip`, `RestoreInfo` | `GET …/projects/:id/versions`, `GET …/projects/:id/revisions`, `POST …/versions/:id/revisions` |
| **6** | **AI Creator Studio** | `/workspaces/[wsId]/projects/[projectId]/ai` | Run and apply AI tasks (titles, description, chapters, SEO, transcript, translate) per version | editor+ | `TaskLauncher`, `JobProgressList`, `OutputCompare`, `ApplyOverrideButton` | `POST …/ai/jobs`, `GET …/ai/jobs/:id`, `GET …/ai/jobs/:id/output`, `POST …/ai/outputs/:id/apply`, `GET …/ai/costs` (admin+), socket `ai.job.updated` |
| **7** | **Thumbnail Studio** | `/workspaces/[wsId]/projects/[projectId]/thumbnails` | Concepts → renders → 1280×720 exports; select one per variant | editor+ | `ConceptGrid`, `RenderPreview`, `VariantSelector`, `ExportDialog` | `GET …/projects/:id/thumbnails`, `POST …/thumbnail-concepts`, `POST …/:id/select`, `POST …/:id/render`, `POST …/thumbnails/:id/export` |
| **8** | **Publishing Studio** | `/workspaces/[wsId]/projects/[projectId]/publish` | Assemble package from approved version → validate → enqueue job → progress | editor prepares; owner/admin executes | `PackageEditor`, `ValidateChecklist`, `JobTimeline`, `QuotaMeter` | `POST/GET/PATCH …/publish-packages`, `POST …/:id/validate`, `POST …/publish-jobs`, `GET …/publish-jobs/:id`, `POST …/:id/retry`, `GET …/youtube/quota`, socket `publish.progress` |
| 9 | Sign in | `/signin` | Email/password + Google OIDC entry | public | `AuthCard`, `SocialButton`, `PasswordField` | `POST /auth/login`, `GET /auth/oauth/:provider/start` |
| 10 | Register | `/signup` | Create account | public | `AuthCard`, `PasswordField` | `POST /auth/register` |
| 11 | Email verification | `/verify-email` | Enter/confirm activation token (target: 32-byte link, not 4-digit code) | public | `TokenInput`, `ResendButton` | `POST /auth/verify-email` |
| 12 | Forgot password | `/forgot-password` | Request reset (enumeration-safe) | public | `AuthCard` | `POST /auth/forgot-password` |
| 13 | Reset password | `/reset-password` | Set new password; revokes sessions | public | `PasswordField`, `StrengthMeter` | `POST /auth/reset-password` |
| 14 | Profile & security | `/settings/profile` | Name/avatar, password change, active session list + revoke | any authed | `ProfileForm`, `SessionList`, `DangerZone` | `GET /me`, `PATCH /me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` |
| 15 | Workspace settings | `/workspaces/[wsId]/settings` | Name, slug, plan settings (`keep_sources`, quotas display) | admin+ | `SettingsForm`, `DangerZone` (delete = owner) | `GET/PATCH …/workspaces/:wsId`, `DELETE …/workspaces/:wsId` |
| 16 | Members & invitations | `/workspaces/[wsId]/settings/members` | Roles, invites, revoke; last-owner demotion guard | owner/admin | `MemberTable`, `InviteDialog`, `RoleSelect` | `GET …/members`, `PATCH …/members/:id`, `DELETE …/members/:id`, `POST …/invites`, `DELETE …/invites/:id` |
| 17 | Audit log | `/workspaces/[wsId]/settings/activity` | Cursor-paginated `audit_event` stream | admin+ | `AuditTable`, `ActionFilter`, `CursorPager` | `GET …/audit`, `GET …/activity` |
| 18 | Asset library | `/workspaces/[wsId]/assets` | Uploaded media, processing state, filters/search | member | `AssetGrid`, `StateChip`, `SearchBar` | `GET …/assets`, `GET …/assets/:id`, `PATCH/DELETE …/assets/:id` (gated) |
| 19 | Uploads & processing | `/workspaces/[wsId]/uploads` | Resumable upload queue + per-stage processing progress | editor+ | `Dropzone`, `ProgressBar`, `StageTimeline`, `RetryButton` | `POST …/uploads`, `GET/POST …/uploads/:id[/complete]`, `DELETE …/uploads/:id`, socket `processing.progress` |
| 20 | Transcript & captions | `/workspaces/[wsId]/projects/[projectId]/review/[versionId]/transcripts` | Transcript editor, caption export, translation tab | editor+ (read: member) | `TranscriptEditor`, `SegmentList`, `LanguageTabs`, `ExportMenu` | `GET …/versions/:id/transcript`, `PATCH …/transcripts/:id`, `POST …/transcript/generate`, `POST …/captions/export`, `POST …/translate` |
| 21 | SEO assistant | `/workspaces/[wsId]/projects/[projectId]/seo` | SEO score/issues/suggestions, keyword block, publish-readiness | member | `ScoreGauge`, `IssueList`, `SuggestionCard` | `POST …/ai/jobs` (`task=seo`), `GET …/ai/jobs/:id/output` |
| 22 | Notifications | `/workspaces/[wsId]/notifications` | Per-user inbox, mark read | member | `NotificationList`, `UnreadBadge` | `GET …/notifications`, `POST …/notifications/read`, socket `notification.created` |
| 23 | Usage & quotas | `/workspaces/[wsId]/settings/usage` | Storage, minutes, AI tokens, publish units, seats vs plan limits | admin+ | `QuotaCard`, `UsageChart` | `GET …/usage` |
| 24 | Billing & plans | `/workspaces/[wsId]/settings/billing` | Subscription, invoices, plan changes (Stripe) | owner | `PlanCard`, `InvoiceTable`, `CheckoutForm` | `GET …/billing`, `POST /billing/webhooks/stripe` (server-to-server) |
| 25 | YouTube connections | `/workspaces/[wsId]/settings/youtube` | Connect/disconnect channels, status/scopes, quota widget | owner (connect/disconnect); member (read) | `ConnectionCard`, `ConnectWizard`, `QuotaWidget` | `GET …/youtube/connections`, `POST …/authorize`, `DELETE …/:id`, `GET …/youtube/quota` |
| 26 | Publish calendar | `/workspaces/[wsId]/publish-calendar` | Month view of scheduled and published jobs | member | `MonthGrid`, `JobChip`, `DayDrawer` | `GET …/publish-calendar`, `GET …/publish-jobs` |
| 27 | Platform admin | `/admin` | Platform users, workspaces, dead-letter jobs, platform actions | `is_platform_admin` | `AdminTabs`, `UserTable`, `DeadLetterTable` | `/admin/users`, `/admin/workspaces`, `/admin/jobs/dead-letter` |

Not counted (deliberate): a global **404 / error boundary** view (rendered by any route), toasts, and modals — these are overlays, not screens. Translation is a **tab inside screen 20**, not a separate screen; the previous "27 screens" claim is satisfied exactly by the table above.

**Build priority:** screens 1–8 are the load-bearing product (dashboard → project → review → comments → versions → AI → thumbnails → publish) and must ship in the order listed; 9–13 are the auth gate required before 1 can be shown to anyone; 14–27 follow the phase order in `MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`.

---

## 4. Design tokens

Single source: `client/styles/tokens.css` (CSS custom properties) + a typed TS mirror `client/constants/tokens.ts`. No hard-coded hex/sizes in components.

| Group | Tokens (examples) |
|---|---|
| Color | `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info` (+ `-subtle`/`-border`/`-text` variants per semantic) |
| Space | 4 px scale: `--space-1 … --space-12` (4, 8, 12, 16, 24, 32, 48, 64) |
| Radius | `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 16px`, `--radius-full` |
| Elevation | `--shadow-1 … --shadow-3` (low/medium/overlay) |
| Z-index | `--z-sticky`, `--z-dropdown`, `--z-modal`, `--z-toast` |
| Type | `--font-sans`, `--font-mono`, `--text-xs … --text-3xl`, `--leading-*` |
| Motion | `--duration-fast 120ms`, `--duration-base 200ms`, `--ease-out` |

## 5. Typography

- Family: system UI stack (`Inter`-class) for UI; monospace for timecodes, ids, quota numbers.
- Scale: 12 / 14 / 16 / 18 / 24 / 30 px; body 14 px (dense tooling) with 16 px on auth/marketing pages.
- Rules: sentence case for labels; tabular numerals for timecodes (`00:01:23.456`), quotas and prices; max line length 72 ch for prose; one `h1` per screen (the breadcrumb title).

## 6. Colors & semantic states

| Semantic | Light | Dark | Used for |
|---|---|---|---|
| neutral | gray scale | inverted gray scale | text, borders, surfaces |
| primary | brand hue | brand hue, lifted lightness | actions, links, focus |
| success | green | green (lifted) | `ready`, `published`, `approved` |
| warning | amber | amber | `processing`, `under_review`, quota ≥ 80 % |
| danger | red | red | `failed`, `changes_requested`, destructive confirms |
| info | blue | blue | `queued`, `submitted`, hints |

State colors are **semantic, never decorative**: `StateChip` maps DB enums → semantic color (`ready→success`, `processing→warning`, `failed→danger`, `approved→success`, `changes_requested→danger`, `outcome_unknown→warning`).

## 7. Dark & light themes

- `data-theme="light|dark"` on `<html>`; system preference by default, explicit user override persisted in `localStorage` (UI-only state — never server state).
- All tokens defined per theme; components consume tokens only — **zero** component-level color literals (lint rule).
- Contrast targets ≥ 4.5:1 body, ≥ 3:1 large text and UI borders in **both** themes.

## 8. Component inventory

**Primitives** (own, no heavy UI dependency): `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Badge`, `Chip`, `Avatar`, `Tooltip`, `Dropdown`, `Modal`, `Drawer`, `Tabs`, `Table`, `Pagination` (cursor), `ProgressBar`, `Skeleton`, `Toast`, `Breadcrumb`, `EmptyState`, `ErrorState`, `Spinner`.

**Patterns:** `FormRow` + zod-driven errors, `ConfirmDialog` (destructive), `IdempotencyButton` (submit-once buttons that attach `Idempotency-Key`), `CursorList`, `RealtimeBadge` (connected/reconnecting), `PermissionGate` (role prop; cosmetic only).

**Domain components:** `ReviewPlayer`, `CommentTimeline`, `CommentThread`, `VersionTimeline`, `StateChip`, `PackageEditor`, `JobTimeline`, `QuotaMeter`, `ConceptGrid`, `TranscriptEditor`, `TaskLauncher`, `OutputCompare`, `StageTimeline`, `Dropzone`, `WorkspaceSwitcher`, `ApprovalDialog`.

Rules: domain components live beside their feature (`client/app/components/<feature>/`); no domain component calls `fetch` directly — RTK Query only; every component is theme-token driven and keyboard reachable.

## 9. Responsive breakpoints

| Token | Width | Behavior |
|---|---|---|
| `sm` | < 640 px | single column; review = player over panel; tables → card lists |
| `md` | 640–1023 px | icon rail; two-column dashboards |
| `lg` | 1024–1279 px | full rail; review: player + comments side-by-side |
| `xl` | ≥ 1280 px | review: player + timeline + thread column (three-pane) |

Mobile (< 640 px) is **consumption-first**: review, comments, notifications, calendar. Editing surfaces (transcript, package editor) require ≥ 1024 px and show a "larger screen required" empty state below that — a deliberate scope cut, recorded here so it is not mistaken for a bug.

## 10. Accessibility rules (WCAG 2.2 AA target)

- Full keyboard operation of player (space/k-j-l, arrows frame-step), comment composer, and every dialog (focus trap + restore).
- Visible focus ring (`--color-primary` outline, 2 px) on all interactive elements; no focus-visible suppression.
- ARIA: live regions for job-state changes (`aria-live="polite"`), `aria-label` on icon-only buttons, correct roles for the timeline slider (`role="slider"` with `aria-valuenow` in seconds).
- Color is never the sole state signal (chip = color + text + icon).
- Forms: label association, inline error text linked via `aria-describedby`, 44 px touch targets.
- Reduced motion: `prefers-reduced-motion` disables all non-essential animation (§11).
- Player: captions on by default when a track exists; no autoplay with sound.

## 11. Motion principles

- **Purposeful only:** motion explains state change (job progressing, comment marker landing, panel switching) — never decoration.
- Durations: 120 ms feedback, 200 ms transitions, ≤ 300 ms panel moves; easing `cubic-bezier(0.2, 0, 0, 1)`.
- Skeletons pulse instead of spinners where layout is known; realtime events animate the changed element only.
- `prefers-reduced-motion: reduce` → instant state swaps.

## 12. Loading, empty, error & retry states

Every data surface implements the full matrix — a screen without all four is incomplete:

| State | Rule |
|---|---|
| **Loading** | skeleton matching final layout (no spinner-on-blank for lists); first paint ≤ 1 skeleton pass |
| **Empty** | `EmptyState` = icon + one line of cause + primary action (e.g. "No versions yet — Upload the first cut") |
| **Error** | `ErrorState` = human cause from the API `error.code`, `requestId` in small text, **Retry** button; never raw messages (mirrors API §1.2) |
| **Retry** | manual Retry re-issues the RTK Query subscription with the same `Idempotency-Key` for mutations; 401 → re-login path; 409 `VERSION_STALE` → refetch + diff banner; 429 → show `Retry-After` countdown |
| Offline/reconnecting | realtime pill shows "reconnecting"; REST data stays usable; mutations queue-fail fast with retry affordance |

## 13. State management

- **Server state:** RTK Query only (existing `client/redux` pattern kept), one `baseQuery` with `credentials: "include"`, `baseUrl` = `/v1`. Error interceptor → toast + 401 re-login.
- **UI state:** local React state or Zustand (panel open, theme, draft composer text). Never duplicate server data in globals.
- **No auth token in JS** — cookies only (reverses the V6 class of bugs).
- **Realtime:** socket events are invalidation triggers only; on `version.ready`, `comment.created`, `approval.decided`, `publish.progress`, `ai.job.updated`, `notification.created`, `session.revoked` the client refetches the affected query tags (room names: `API_CONTRACT_AND_MODULES.md` §3.15).

## 14. Open items

- Component-library choice (own primitives above vs headless library — Radix-class): **Proposed: headless primitives + own tokens**, ratify at Phase 5 start; no owner approval required.
- Visual brand direction (color hue, typeface): owner input needed before Phase 5 — cosmetic, not architectural.
- Mobile editing exemption (§9): recorded as deliberate v1 scope cut.
