# Project overview

## Purpose

Plan a shared university application that brings together the nine modules listed in the source notes. They are parts of one application, not separate products.

## Repository and application shape

- The planned repository is a pnpm monorepo with one Next.js web frontend at `apps/web` and one NestJS API.
- The frontend uses the Next.js App Router. A minimal root layout provides the global shell, and the application shares one sign-in flow and session.
- Each of the nine modules has its own route subtree, layout, and navigation. Module navigation is scoped to that module.
- Each module has a planning folder under `modules/` with one initial `README.md` specification.
- The boundaries between modules and any shared data contracts remain open.

## Technology notes

The technology source note lists React. Next.js is the chosen React frontend framework, and NestJS is the chosen API framework. Better Auth, Drizzle ORM, React Query, and dynamic role-based access remain planning inputs. The need for Zustand, the role model, package boundaries, and integration details remain open. Google account linking is deferred.

## Planning principles

- Keep identity and access shared across modules.
- Treat role assignment, approvals, workflows, priorities, and inter-module data exchange as undecided unless confirmed in a later spec.
- Add module-specific detail only when supported by source notes or an explicit decision.
- Record decisions and observable acceptance checks as the plan becomes more concrete.

## Open decisions

- Which remaining technology choices and versions will be selected, and how will shared packages be organized?
- What does dynamic role-based access mean in this application, and how will it relate to the minimum permissions required by each operation?
- Which module boundaries and data contracts are needed?
- What further implementation sequencing is appropriate after the shared foundation?
