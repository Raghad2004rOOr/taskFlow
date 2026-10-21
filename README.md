# TaskFlow

**Live demo:** https://project-phi-kohl-61.vercel.app · **GitHub:** https://github.com/Raghad2004rOOr/taskFlow

TaskFlow is an Arabic-first project and task manager built with Next.js, Firebase Authentication, and Cloud Firestore.

## Features

- Google sign-in and email/password registration and sign-in.
- Project workspaces with owner/member permissions, member management, and task assignment.
- Task lists and a Kanban board with status, priority, due dates, search, sorting, and filters.
- Dashboard statistics and an activity log for task creation and status changes.
- In-app notifications and a persistent light/dark theme preference.
- RTL layout designed for mobile, tablet, and desktop.

> Notifications, Google auth, Kanban, activity log and dark mode are bonus features added after the MVP.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/dashboard` |
| `/login` | Sign in with Google or email/password |
| `/register` | Create an account |
| `/dashboard` | Protected workspace overview and project list |
| `/projects/[id]` | Protected project task view; shows an unavailable/access-denied message if the project is not in the signed-in user's workspace |

## Getting started

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Google** and **Authentication → Email/Password**, then create a **Cloud Firestore** database.
3. Set the six Firebase Web app configuration variables listed in `.env.example` for the local environment and the matching Vercel project. Never add a service-account key to the client app.
4. Add the deployed Vercel hostname to **Firebase Authentication → Settings → Authorized domains**.
5. Publish `firestore.rules` from the Firebase Console or with the Firebase CLI after selecting the correct Firebase project.
6. Install dependencies with `pnpm install`, then start the app with `pnpm dev`.

The app does not provision shared demo accounts. For a two-user evaluation, register an owner and a member with your own test email addresses, create a project from the owner account, and add the member from the project's member panel.

## Firestore data model

- `users/{uid}` — private profile for the signed-in user.
- `users/{uid}/notifications/{notificationId}` — per-user notifications and read state.
- `userDirectory/{uid}` — display name for direct member lookup; listing is denied.
- `memberIndex/{lowercase-email}` — account lookup used when a project owner adds a member; listing is denied.
- `projects/{projectId}` — project name and description, owner UID, member UID array, and audit timestamps.
- `projects/{projectId}/tasks/{taskId}` — task title and description, status, priority, optional assignee and due date, creator UID, and audit timestamps.
- `projects/{projectId}/activities/{activityId}` — task creation and status-change activity.

## How the main files work

- `components/auth-form.tsx` signs users in with Firebase Authentication, then creates or ensures their Firestore profile. `components/auth-gate.tsx` listens for the Firebase session and sends signed-out visitors to `/login`.
- `firestore.rules` is the authorization boundary for profiles, projects, tasks, notifications, and activity records. The UI hides unavailable actions for usability, but writes still have to pass the Firestore rules.
- `lib/firestore.ts` loads the signed-in user's projects and their tasks; the dashboard metrics in `components/dashboard-stats.tsx` are calculated from that workspace data and the task statuses.
- `lib/dates.ts` defines local-date overdue behavior and task date formatting. `components/taskflow-app.tsx` owns workspace state and mutations, while the dashboard, task list, filters, members panel, and Kanban board are separate components.

## Permissions and known limitations

- Project owners manage project details and membership. Members can read shared projects, create tasks, and edit tasks they created or are assigned. Only the owner or assigned member may change a task's status; only the owner or task creator may delete it. Firestore rules enforce these permissions.
- Removing a member clears their task assignments and removes their membership in one atomic Firestore batch. Firestore batches support up to 500 writes; a member with more than 499 assigned tasks cannot be removed until the task count is reduced.
- A task is **overdue** when its due date is before the current local date and its status is not `Done`. A task due today is not overdue; a completed task remains not overdue even when its due date has passed.
- Authenticated users can directly check whether an email has a `memberIndex` record; listing the index is denied, but lookups may reveal whether an account exists.
- Email verification is not enabled.
- The UI prevents deleting a project with tasks, but the Firestore project-delete rule does not enforce that restriction. Direct rule-authorized deletion could leave task subcollection documents behind.
- Notification message text is limited by the rules but is not otherwise constrained to a fixed template.
- Task lists are fetched per accessible project and filtered client-side. Large workspaces will need pagination and query/index planning.
- No shared demo credentials are configured. Use separate test accounts as described above.

## Testing status

The following checks are listed for manual Firebase-backed acceptance. They have **not** been run as part of this repository change; do not treat them as passing evidence.

| Test | Expected result | Status |
| --- | --- | --- |
| TC-01 | Test definition was not included in the supplied checklist | Not run |
| TC-02 | Test definition was not included in the supplied checklist | Not run |
| TC-03 | Test definition was not included in the supplied checklist | Not run |
| TC-04 — open `/dashboard` while signed out | Redirect to `/login` | Pass (local preview) |
| TC-05 | Test definition was not included in the supplied checklist | Not run |
| TC-06 — member edits project details | Firestore rejects the write | Not run |
| TC-07 | Test definition was not included in the supplied checklist | Not run |
| TC-08 | Test definition was not included in the supplied checklist | Not run |
| TC-09 | Test definition was not included in the supplied checklist | Not run |
| TC-10 | Test definition was not included in the supplied checklist | Not run |
| TC-11 | Test definition was not included in the supplied checklist | Not run |
| TC-12 | Test definition was not included in the supplied checklist | Not run |
| TC-13 — open an unknown `/projects/[id]` | No project data; unavailable/access-denied message | Not run |
| TC-14 — attempt a forbidden write in Rules Playground | Firestore rejects the write | Not run |
| TC-15 — use a 375px mobile viewport | No layout breakage | Partial (login checked at 375px; authenticated workspace not tested) |
| TC-16 — save a task while offline | Error is shown; no false success | Not run |
| Unassigned member changes task status | Firestore rejects the write | Not run |
| Remove a member who has assigned tasks | Assignment cleanup and membership removal succeed together | Not run |

Full cross-browser evidence and authenticated screenshots (auth, projects, tasks, filters, and mobile 375px) still need to be captured using the Firebase project's real test accounts.

## Environment variables

Use the keys in `.env.example` for local and deployment configuration. Firebase Web configuration is public client configuration; access control depends on Authentication and Firestore rules, not on hiding these values.
