# HR frontend

## Purpose and users

The HR frontend gives authorized HR administrators a simple web interface for maintaining employee profiles, personal information, current employment details, and the reference lists used in employee forms. It connects to the [HR administration API](API.md).

An employee profile can be created before employment information is available. Personal information and current employment have separate save actions. Account creation and role assignment are handled by shared Administration.

## Interface

The interface uses a minimal light theme with neutral colors, readable labels, bordered cards, and responsive forms and tables. Its header contains the application title and language switch. Signed-in users have access to Employees, Settings, and sign-out.

English is the default interface language and uses a left-to-right layout. Users can switch to Arabic, which changes labels, messages, and layout direction to right-to-left. The selected language is remembered on subsequent visits. Reference names prefer the selected language and fall back to an available name; employee names remain as entered.

Employee details include a decorative portrait placeholder. The asset can be replaced later at [`apps/hr/public/images/employee-placeholder.svg`](../../../apps/hr/public/images/employee-placeholder.svg). The current interface does not upload or store employee photographs.

## Screens and routes

| Route                            | Screen and behavior                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/hr/employees`                  | Employee list with search, filters, pagination, and links to individual records.                                               |
| `/hr/employees/new`              | Create a profile with an employee number and required Arabic name fields; other personal details are optional.                 |
| `/hr/employees/:employeeId`      | View personal information and current employment, including an explicit message when employment details have not been entered. |
| `/hr/employees/:employeeId/edit` | Edit personal and current employment information through separate forms and save actions.                                      |
| `/hr/settings/:kind`             | View reference records in tables and create or edit them in dialogs.                                                           |

`/hr` redirects to the employee list. `/hr/settings` redirects to staff categories. Unknown HR paths display a not-found screen; unsupported settings kinds redirect to staff categories.

### Employee list

The list displays employee number, name, staff category, position, department, and employment status. Search matches employee numbers and Arabic or English name fields. Filters cover category, position, and employment status.

Search, filters, page number, and page size are stored in URL query parameters so a direct link or refresh preserves the selected view. Applying filters resets pagination to the first page. Detailed identity and contact information is shown on the personnel detail screen rather than in the list.

### Employee forms

The personal-information form covers names, employee number, date of birth, nationality, civil registry number, contact information, emergency contact, and notes. A successful creation opens the employee detail page without requiring employment information.

The employment form covers category, position, academic rank, grade, department, employment regime and status, start and end dates, and notes. Position choices depend on the selected category. Changing category clears the previous position. Grade choices depend on the selected grade scheme.

Required values, email format, dates, and date order are checked before submission. Optional blank values are submitted as `null`. Employment saves submit the complete current form to match the API's PUT behavior. Failed saves preserve entered values, and pending saves disable repeated submissions.

### Reference settings

Settings contains five reference lists:

- Staff categories.
- Positions, including their category and academic-position flag.
- Academic ranks and their order.
- Grade schemes.
- Employment grades and optional steps within a scheme.

Create and edit dialogs use the relevant text fields, numeric inputs, checkboxes, and dependent reference selectors. The backend checks uniqueness and reference integrity. No delete actions are exposed.

## Technology and state ownership

| Technology                 | Responsibility                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| React and TypeScript       | Components, screen composition, local form state, and API response types.                     |
| Vite and Module Federation | Standalone frontend build and the `hr/App` remote consumed by the shell.                      |
| React Router               | Screen routes, navigation, route parameters, and URL search parameters.                       |
| React Query                | API queries, session checks, mutations, cache invalidation, cancellation, and request states. |
| Zustand                    | The selected UI language.                                                                     |
| react-i18next              | Scoped English and Arabic translations.                                                       |
| shadcn/ui and Tailwind     | Accessible controls and minimal styling.                                                      |

The selected shadcn components are Button, Input, Label, Textarea, Native Select, Checkbox, Table, Card, Tabs, Dialog, Alert, and Skeleton. Their source lives in [`apps/hr/src/components/ui`](../../../apps/hr/src/components/ui/).

Tailwind utilities use the `hr:` prefix, global preflight is omitted, and HR styling is scoped to its root. Dialogs render inside that root to inherit its theme and language direction. These choices limit interference with other federated modules.

The shell owns a single browser router and mounts HR at `/hr/*`. The exported HR app uses that parent router; the standalone entry point supplies its own router. Shell and HR share React Router as a federation singleton.

## Authentication and feedback

HR uses the existing shared sign-in endpoints and session cookies. It presents sign-in, required password change, pending approval, and disabled-account states. The requested route is retained during sign-in. Backend permissions remain authoritative for every operation.

The interface provides loading, empty, success, validation, access-denied, not-found, and retry states. Mutations are not automatically retried. Personnel query caches are cleared when identity or account eligibility changes and when a request reports session expiry. Sign-out clears the HR client cache.

Only the language preference is persisted in browser local storage, under `faculty-hr-language`. Credentials and personnel records are not persisted there.

## Setup and verification

The standalone entry point is `http://localhost:3005/hr/employees`; the shell entry point is `http://localhost:3000/hr/employees`. The API defaults to `http://localhost:4000` through `VITE_API_URL`. The shell's `VITE_HR_REMOTE_URL` selects HR's federation entry.

Both frontend origins must be allowed by the API. Hosting must serve the appropriate `index.html` for nested navigation routes while serving federation entries and static assets directly. See the [HR app setup guide](../../../apps/hr/README.md) for environment configuration, commands, and hosting details.

Automated frontend tests use jsdom and mocked API responses. They cover language defaults and switching, authentication states, URL filters, profile creation, independent employment saves, dependent selectors, reference dialogs, session expiry, and failed-save recovery. Production builds, lint checks, and nested-route HTTP responses were checked during implementation. Visual browser verification was unavailable in that session.

## Current scope

The implemented interface covers HR administration of employee details, current employment, and reference data. Reports, employee self-service requests, appointment or decision workflows, attachments, employment-history editing, account linking, employee deletion, and photograph uploads are outside this version.
