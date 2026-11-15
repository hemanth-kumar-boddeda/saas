# Feature Specification: VidTouch Release Readiness

**Created**: 2026-11-08  
**Status**: Draft for release planning  
**Input**: Repair authentication, inventory all existing features, and prepare the current application for release by 2026-12-08. User selected Vercel for the frontend and a separate persistent backend.

## Scope Baseline

- **Discovery method**: Enumerated App Router pages, Express route declarations, Redux API endpoints, Mongoose models, and existing tests.
- **Total items discovered**: 22 frontend pages, 38 backend route declarations, 5 data models, and 2 backend test files containing 22 tests.
- **Items in scope**: All current user and administrator flows in those pages and APIs. New CreatorFlow features described in proposed architecture documents are not treated as implemented requirements.
- **Current product scope**: Existing VidTouch course marketplace and administrator tools. Release work must not imply that planned AI, editing, publishing, or workspace features already exist.

### Existing Feature Inventory

| Area | Current screens and behavior | Backend surface |
|---|---|---|
| Public site | Home, about, FAQ, and policy pages; landing content and navigation. | Public layout data for hero, categories, and FAQ. |
| Accounts | Registration, email activation, email/password login, configured Google login, profile and password changes, avatar upload, logout, session refresh, current-user loading. | Registration, activation, login, social auth, logout, refresh, profile, avatar, password, and user-management routes. GitHub is not implemented; signup social icons are decorative. |
| Course discovery | Paginated course listing, category filters, search, course details, preview, and video-access/player pages. | Public video list, detail, search, authenticated course content, and VdoCipher OTP routes. |
| Learning and reviews | Video sections, lesson playback, questions, answers, reviews, and administrator review replies. | Content, question, answer, review, and reply routes. |
| Checkout and orders | Course checkout with Stripe, order confirmation, administrator order/invoice screens. | Stripe publishable key, payment intent, order creation, and administrator order routes. |
| Administrator courses | Dashboard, course create/edit/delete, course content management, and course listing. | Administrator video CRUD and video analytics routes. |
| Administrator operations | User/team screens, role changes, notifications, categories, FAQ, hero content, user/order/video analytics. | User/role management, notifications, layout CRUD, and analytics routes. |
| Realtime | Socket.IO clients in the app layout, video player, checkout, and administrator dashboard. | Socket.IO notification event relay. |

Page inventory: `/`, `/about`, `/faq`, `/policy`, `/profile`, `/videos`, `/videos/search`, `/video/[id]`, `/video-access/[id]`, `/admin`, `/admin/categories`, `/admin/create-video`, `/admin/edit-video/[id]`, `/admin/faq`, `/admin/hero`, `/admin/invoices`, `/admin/orders-analytics`, `/admin/team`, `/admin/users`, `/admin/users-analytics`, `/admin/videos`, and `/admin/videos-analytics`.

### Current Release Readiness Snapshot

- Login and signup fields now bind to Formik by name; password visibility works as labeled.
- Login, profile loading, session refresh/rotation, and logout now use the same server-side session records.
- Backend tests pass: 22 of 22. Backend TypeScript build passes. Frontend production build passes.
- Local frontend and backend health checks returned HTTP 200 before the final build pass.
- Live login still needs reachable MongoDB and Redis. A local startup previously reported DNS failures for those configured services; rerun end-to-end tests with working service URLs.
- No browser end-to-end suite or client component tests exist. The current backend tests cover authentication and authorization only.
- Vercel frontend deployment is not yet demonstrated. The Express and Socket.IO backend requires a persistent external host.
- Choose the persistent backend provider and production domains before final cookie and deployment verification. Vercel frontend + persistent external backend is confirmed; provider is undecided.

## User Scenarios & Testing

### User Story 1 - Create an account and sign in (Priority: P1)

A visitor creates an account, verifies the email address, signs in, and remains signed in while using protected features.

**Why this priority**: Account access gates profiles, checkout, learning, and administrator operations.

**Independent Test**: Exercise registration, activation, login, page reload, refresh, and logout against staging MongoDB and Redis.

**Acceptance Scenarios**:

1. **Given** a valid new account and working email delivery, **When** the visitor registers and submits the received activation code, **Then** the account becomes usable for sign-in.
2. **Given** an activated account, **When** the user enters valid credentials, **Then** the app loads the user and protected API requests succeed after a page reload.
3. **Given** an active session, **When** the user logs out, **Then** the session is revoked and protected requests reject the old cookies.
4. **Given** an invalid password or expired refresh token, **When** the user submits a protected request, **Then** the app reports an authentication error and does not show protected data.

### User Story 2 - Find and preview courses (Priority: P1)

A visitor browses the catalog, filters by category, searches, and opens a course detail page.

**Why this priority**: Course discovery is the main public path to purchase.

**Independent Test**: Exercise catalog, category filter, pagination, search, course detail, and preview in a browser with seeded courses.

**Acceptance Scenarios**:

1. **Given** published courses, **When** a visitor opens the catalog, **Then** course cards and pagination match the available results.
2. **Given** categories and courses, **When** the visitor selects a category or searches, **Then** matching results appear and unrelated courses do not.
3. **Given** a course detail page, **When** the visitor opens it, **Then** course information and the preview appear without requiring a purchase.

### User Story 3 - Purchase and watch a course (Priority: P1)

A signed-in learner pays for a course and receives access to its lessons.

**Why this priority**: Checkout and protected learning deliver the core paid value.

**Independent Test**: Use Stripe test mode, one seeded course, and a valid VdoCipher test configuration; verify both successful and declined payments.

**Acceptance Scenarios**:

1. **Given** an authenticated learner and an unpurchased course, **When** checkout succeeds, **Then** one order is recorded and the learner can open its lessons.
2. **Given** a failed or incomplete payment, **When** order creation is attempted, **Then** no paid access is granted.
3. **Given** a learner without course access, **When** the learner requests protected lesson content, **Then** the request is rejected.

### User Story 4 - Participate in course discussions (Priority: P2)

A learner asks a question, submits an answer or review, and sees administrator replies.

**Why this priority**: Discussion and reviews support course quality and learner retention.

**Independent Test**: Submit and retrieve questions, answers, reviews, and an administrator reply using separate learner and administrator accounts.

**Acceptance Scenarios**:

1. **Given** an authenticated learner with course access, **When** the learner submits a question or review, **Then** it appears on the appropriate course.
2. **Given** an open question, **When** an authorized learner submits an answer, **Then** the answer is attached to that question.
3. **Given** a review, **When** an administrator replies, **Then** the reply appears without changing the original review.

### User Story 5 - Manage courses and site content (Priority: P1)

An administrator manages courses, lessons, hero content, categories, and FAQ entries.

**Why this priority**: Administrators need to operate the marketplace without code changes.

**Independent Test**: Use an administrator account to create, edit, publish, and delete a test course, then edit each configurable content area.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** the administrator creates or edits a course and its lessons, **Then** changes appear in the public catalog and course detail.
2. **Given** a non-administrator, **When** the user requests an administrator mutation, **Then** the API rejects the request.
3. **Given** an administrator edits hero, category, or FAQ content, **When** a visitor reloads the relevant page, **Then** the updated content appears.

### User Story 6 - Manage accounts, orders, and performance (Priority: P2)

An administrator manages users and roles, views orders and invoices, reviews notifications, and opens analytics.

**Why this priority**: These tools support day-to-day service operations.

**Independent Test**: Exercise administrator list, update, delete, notification, invoice, and analytics screens using representative test data.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** the administrator changes a user's role or removes an account, **Then** the change is enforced by the API and reflected in later requests.
2. **Given** recorded orders and courses, **When** the administrator opens invoices or analytics, **Then** displayed totals and records match the source data.
3. **Given** an unread notification, **When** an administrator marks it read, **Then** its status persists after reload.

### User Story 7 - Release the application on Vercel (Priority: P1)

The team deploys the frontend to Vercel and the API plus Socket.IO service to a persistent backend provider.

**Why this priority**: Production services must communicate with the right origins and credentials.

**Independent Test**: Deploy to staging with production-like domains, external MongoDB and Redis, and sandbox integrations; run the release smoke suite from a real browser.

**Acceptance Scenarios**:

1. **Given** configured frontend and API origins, **When** a browser signs in and calls the API, **Then** credentialed requests and session cookies work without localhost URLs.
2. **Given** an authenticated browser connected to the backend, **When** a supported realtime event occurs, **Then** the intended UI receives the event.
3. **Given** a clean deployment, **When** health checks and critical user journeys run, **Then** all required services respond and no required integration is missing.

### Edge Cases

- Duplicate registration, invalid or expired activation code, invalid password, expired or replayed refresh token, and revoked session.
- Empty catalog, no category matches, no search matches, malformed page number, and unavailable course.
- Double checkout submission, declined payment, payment-provider timeout, duplicate order, and delayed email.
- Missing MongoDB, Redis, Stripe, Cloudinary, SMTP, Google, or VdoCipher configuration.
- Vercel preview and production origins, backend origin changes, cookie SameSite behavior, and Socket.IO reconnects.
- A non-administrator attempts each protected operation directly through the API.
- A user changes profile data or buys a course; the updated state must appear in the current session.

## Requirements

### Functional Requirements

- **REQ-001**: Visitors MUST be able to open the home, about, FAQ, and policy pages.
- **REQ-002**: Visitors MUST be able to list, paginate, filter, and search available courses.
- **REQ-003**: Visitors MUST be able to view course details and previews before purchase.
- **REQ-004**: A visitor MUST be able to register and activate an account using a valid, unexpired email code.
- **REQ-005**: An activated user MUST be able to sign in with email/password; configured Google sign-in MUST validate identity on the server.
- **REQ-006**: An authenticated user MUST remain signed in after reload, refresh the session, and revoke the session on logout.
- **REQ-007**: An authenticated user MUST be able to update profile information, avatar, and password without stale profile data in the active session.
- **REQ-008**: An authenticated learner MUST be able to buy a course through Stripe and receive access only after a successful payment.
- **REQ-009**: A learner MUST be able to access protected course lessons only when the learner has valid course access.
- **REQ-010**: Authorized learners MUST be able to submit course questions, answers, and reviews; administrators MUST be able to reply to reviews.
- **REQ-011**: Administrators MUST be able to create, edit, list, and delete courses and manage course lessons.
- **REQ-012**: Administrators MUST be able to view orders and invoices.
- **REQ-013**: Administrators MUST be able to manage users, roles, and the team view; server authorization MUST reject unauthorized role changes.
- **REQ-014**: Administrators MUST be able to manage hero, category, and FAQ content.
- **REQ-015**: Administrators MUST be able to view user, order, and course analytics.
- **REQ-016**: Administrators MUST be able to view and update notification status; supported realtime events MUST work across configured origins.
- **REQ-017**: The frontend MUST deploy to Vercel while the Express API and Socket.IO service run on a persistent external host.
- **REQ-018**: Production configuration MUST use explicit frontend origins, HTTPS, reachable MongoDB and Redis, and provider credentials stored outside the browser bundle.
- **REQ-019**: Release verification MUST cover every P1 journey, every public route, all 38 backend route declarations, and all administrator authorization boundaries.
- **REQ-020**: The release candidate MUST pass frontend and backend production builds, the complete backend test suite, and browser-based critical-flow tests with zero open P0/P1 defects.

### Key Entities

- **User**: Account identity, verification status, role, profile, and owned course access.
- **Session**: Authenticated user projection and refresh-token state used to authorize requests.
- **Course**: Public course information, price, lessons, reviews, questions, and purchase count.
- **Order**: User, course, and payment outcome for a purchase.
- **Notification**: Administrator message and read status.
- **Layout**: Editable hero, category, and FAQ content.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 22 application pages load in the production deployment and match the expected access rules.
- **SC-002**: All P1 browser journeys pass in staging on the target production domains.
- **SC-003**: All 38 backend route declarations have a documented smoke or contract test.
- **SC-004**: The complete backend test suite and both production builds pass in CI on every release candidate.
- **SC-005**: Zero P0 or P1 defects remain open at release approval.
- **SC-006**: 100% of scripted scenarios for registration, activation, login, refresh, logout, checkout, and course access pass before release.
- **SC-007**: A production rollback procedure and health-check procedure are rehearsed before the release date.

## Assumptions

- Release means the existing VidTouch feature set, not the proposed CreatorFlow rewrite or new AI/video-editing capabilities.
- The target date is 2026-12-08, one month after the request date. This is a target, not a guaranteed delivery date.
- Vercel hosts the frontend only. The API and Socket.IO service remain a persistent Node.js service.
- Stripe, Google, email, Cloudinary, VdoCipher, MongoDB, and Redis are configured by the project owner in non-production and production environments as needed.
- **[NEEDS CLARIFICATION: Which persistent backend provider and production domain will host the Express and Socket.IO service?]**
