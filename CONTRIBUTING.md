# Contributing to WorkPhelo

This document covers everything you need to know to contribute to WorkPhelovfrom setting up your environment to making your first PR.

---

## Branch Strategy

| Branch      | Purpose               | Auto-deploy      |
| ----------- | --------------------- | ---------------- |
| `main`      | Production-ready code | No               |
| `dev`       | Active development    | Yes → dev server |
| `feature/*` | New features          | No               |
| `fix/*`     | Bug fixes             | No               |
| `docs/*`    | Documentation only    | No               |

**Never push directly to `main`,`prod` or `dev`.** Always branch off `dev` and open a PR

---

## Git Workflow

### Starting a new feature

```bash
# Make sure you're on dev and up to date
git checkout dev

git pull origin dev

# Create your feature branch
git checkout -b feature/your-feature-name
```

### Making commits

We follow **Conventional Commits**. Every commit message must follow this format:

```
<type>(<scope>): <short description>
```

**Types:**

| Type       | When to use                                      |
| ---------- | ------------------------------------------------ |
| `feat`     | New feature                                      |
| `fix`      | Bug fix                                          |
| `docs`     | Documentation only                               |
| `refactor` | Code change that is not a fix or feature         |
| `test`     | Adding or updating tests                         |
| `chore`    | Build process, config, CI changes                |
| `style`    | Formatting, missing semicolons (no logic change) |

**Scopes:** `auth`, `hr`, `web`, `gateway`, `notification`, `infra`, `ci`, `db`

**Examples:**

```bash
git commit -m "feat(hr): add employee offboarding endpoint"

git commit -m "fix(auth): prevent OTP reuse after password reset"

git commit -m "docs(web): update component usage in README"

git commit -m "chore(ci): add nextjs docker build step"
```

### Pushing your branch

```bash
git push origin feature/your-feature-name
```

### Opening a PR

- PR target: always `dev`, never `main` or `prod`
- Title must follow conventional commit format
- Add a description of what changed and why
- Link to the relevant user story or ticket
- Request review from at least one team member

---

## Pre-commit Checks

The repo uses **Husky + lint-staged**. These run automatically on every `git commit`:

- Prettier formatting
- ESLint

If your commit is rejected, fix the errors and try again. **Do not use `--no-verify`.**

---

## Backend Development

### Adding a new endpoint

1. Add the route to the appropriate controller
2. Add business logic to the service
3. Add Swagger decorators (`@ApiOperation`, `@ApiBody`, `@ApiResponse`)
4. Add DTOs with class-validator decorators
5. Run `npm run check-types` before committing

### Database changes

Always create a migration — never edit existing migration files:

```bash
# Auth service
cd apps/auth-service

npx prisma migrate dev --name describe_your_change

# HR service
cd apps/hr-service

npx prisma migrate dev --name describe_your_change
```

Never run `prisma migrate reset` on the shared dev server without first purging the RabbitMQ queue:

### Running type checks locally

```bash
npm run check-types
```

Fix all errors before pushing. The CI pipeline will reject builds with type errors.

---

## Frontend Development (Next.js)

The frontend lives at `apps/web/work-phelo-web` and follows **atomic design** principles.

### Atomic Design Rules

| Layer          | Contains                        | Rule                               |
| -------------- | ------------------------------- | ---------------------------------- |
| Atoms          | Button, Input, Badge, Icon      | No business logic, no API calls    |
| Molecules      | FormField, StatusBadge, NavItem | Combines atoms, no API calls       |
| Organisms      | Table, Sidebar, Header, Form    | Can use hooks, no direct API calls |
| Templates      | Page layouts                    | Layout only, no data fetching      |
| Pages (`app/`) | Route components                | Data fetching lives here           |

### Component rules

- Every component must be typed with TypeScript — no `any`
- Use `cn()` from `@/lib/utils` for conditional classes
- Use `@tanstack/react-query` for all server state
- Use Zustand for global client state (auth, UI state)
- Never use `localStorage` or `sessionStorage`
- All new components go in the correct atomic layer — don't mix concerns

### Running the frontend locally

```bash
cd apps/web/work-phelo-web

npm install

npm run dev

# → http://localhost:3000
```

### Type checking before pushing

```bash
cd apps/web/work-phelo-web

npx tsc --noEmit

npm run build
```

Fix all errors locally before pushing — the pipeline runs these same checks.

---

## Environment Variables

Never commit `.env` files. Each service has a `.env.example` — copy it and fill in your values.

Required variables per service:

**auth-service:**

```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
RABBITMQ_URL=
RESEND_API_KEY=
FRONTEND_BASE_URL=
```

**hr-service:**

```
DATABASE_URL=
RABBITMQ_URL=
```

**web (Next.js):**

```
NEXT_PUBLIC_API_URL=https://dev-api.workphelo.com/api/v1
NEXT_PUBLIC_APP_BASE_URL=https://dev-app.workphelo.com
```

---

## Common Issues & Fixes

**`npm ci` fails with lockfile mismatch**

```bash

rm package-lock.json && npm install
```

**Prisma client out of sync**

```bash
npx prisma generate
```

**Resend daily quota hit (100 emails/day on free plan)**

---

## Deployment

Deployment is fully automated via GitHub Actions on every push to `dev` and `prod`.

### How the pipeline works

1. Push to `dev`
2. Quality gates run (type checks, build validation)
3. Changed services are detected automatically
4. Docker images are built and pushed to GHCR
5. Next.js Docker image is built and pushed
6. Server pulls new images, restarts containers
7. DB migrations run automatically
8. DB is seeded (idempotent — safe to run every deploy)

### Promoting to production

```bash
git checkout main
git merge dev
git push origin main
```

Service names: `auth-service`, `hr-service`, `notification-service`, `api-gateway`, `nextjs`

---
