# ADR 0001: Public-Read, Owner-Write Authentication Model

## Status

Accepted

## Context

The Backlog Kanban board is a mobile-first web frontend for a Supabase-backed issue tracker. The codebase is public (GitHub Pages, public repo) and there is a tension between:

- **Openness**: the board should load instantly on a phone with no login friction. Anyone should be able to see what's being worked on.
- **Security**: only the owner (a single authenticated user) should be able to mutate story statuses. No one else should be able to corrupt the database through the frontend.

Supabase provides two mechanisms: the anon (publishable) key for unauthenticated access, and JWT-based Row Level Security (RLS) for authorization.

## Decision

We use a **two-tier access model**:

| Tier | Role | Mechanism | Capabilities |
|---|---|---|---|
| Public | Viewer | Supabase anon key | SELECT on all tables |
| Authenticated | Owner | GitHub OAuth JWT | SELECT + UPDATE on `stories.status` via RLS |

The anon key is embedded in the client bundle. This is safe because:
1. RLS policies at the database level reject any `UPDATE`, `DELETE`, or `INSERT` from the `anon` role.
2. The only mutation the board performs is `UPDATE stories SET status = $1 WHERE id = $2`, and this is gated behind a valid JWT.
3. The service_role key never touches client code.

The board renders in read-only mode by default. The status Transition UI shows a "Sign in to edit" prompt until the user authenticates via GitHub OAuth. The session persists in localStorage so re-authentication is infrequent.

## Alternatives Considered

### Service role key (full access)

Rejected: embedding the service_role key in a public GitHub repo would grant anyone full database access. Unacceptable risk.

### Auth-required for all access

Rejected: requiring login just to view the board adds friction on mobile. The board is primarily a read-only tool; the login step would discourage casual checking.

### email/password auth

Rejected: GitHub OAuth is simpler (no password to manage) and the owner already has a GitHub account (`DietKyle956`) linked to the project.

## Consequences

- The Supabase project must have RLS enabled on all tables with appropriate policies.
- A GitHub OAuth provider must be configured in the Supabase Auth dashboard.
- The board's `UPDATE` RLS policy must be scoped to a specific `auth.uid()`.
- Anyone on the internet can read the backlog. This is intentional — the repository and board are public by design.
