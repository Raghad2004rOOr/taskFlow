# TaskFlow

**Live demo:** https://project-phi-kohl-61.vercel.app · **GitHub:** https://github.com/Raghad2004rOOr/taskFlow

TaskFlow is an Arabic-first project and task manager built with Next.js (App Router), Firebase Authentication, and Cloud Firestore. Teams create projects, invite members, and track tasks on a list or a Kanban board.

## Features

- Google sign-in and email/password registration and sign-in.
- Project workspaces with owner/member permissions, member management, and task assignment.
- Task lists and a Kanban board with status, priority, due dates, search, sorting, and filters (including an Overdue filter).
- Dashboard statistics and an activity log for task creation and status changes.
- In-app notifications and a persistent light/dark theme preference.
- Offline detection: a banner is shown and saves are blocked with a visible error while the browser is offline.
- RTL layout designed for mobile, tablet, and desktop.

> Notifications, Google auth, Kanban, activity log, dark mode and the offline banner are bonus features added after the MVP.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/dashboard` |
| `/login` | Sign in with Google or email/password |
| `/register` | Create an account |
| `/dashboard` | Protected workspace overview and project list |
| `/projects/[id]` | Protected project task view; shows a "project not found or no access" message if the project is not in the signed-in user's workspace |

## Project structure

```
app/            Next.js routes (dashboard, login, register, projects/[id])
components/     UI: task list, Kanban board, filters, members panel, dialogs, dashboard stats
hooks/          use-online-status (offline detection)
lib/            Firebase setup, Firestore functions, date helpers, types
firestore.rules Firestore security rules
docs/           Project SRS
```

## Getting started

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Google** and **Authentication → Email/Password**, then create a **Cloud Firestore** database.
3. Set the six Firebase Web app configuration variables listed in `.env.example` for the local environment and the matching Vercel project. Never add a service-account key to the client app.
4. Add the deployed Vercel hostname to **Firebase Authentication → Settings → Authorized domains**.
5. Publish `firestore.rules` from the Firebase Console (Firestore → Rules → Publish) or with the Firebase CLI. A new Firestore database starts with open test-mode rules, so this step is required.
6. Install dependencies with `pnpm install`, then start the app with `pnpm dev`.

Scripts: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm typecheck`.

## Demo accounts

Two fictional accounts are available for evaluation (they contain no real data):

| Role | Email | Password |
| --- | --- | --- |
| Owner | owner@example.test |123456 |
| Member | member@example.test | قشلاشي |

To try the permissions: sign in as the owner, create a project and a task, add the member from the project's member panel, then sign in as the member in a second browser window.

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
- `hooks/use-online-status.ts` tracks the browser's online/offline state; the app shows a banner and refuses to write while offline.

## Permissions and known limitations

- Project owners manage project details and membership. Members can read shared projects, create tasks, and edit tasks they created or are assigned. Only the owner or assigned member may change a task's status; only the owner or task creator may delete it. Firestore rules enforce these permissions.
- Projects are readable only by users listed in the project's `memberIds` (`request.auth.uid in resource.data.memberIds`).
- Removing a member clears their task assignments and removes their membership in one atomic Firestore batch. Firestore batches support up to 500 writes; a member with more than 499 assigned tasks cannot be removed until the task count is reduced.
- A task is **overdue** when its due date is before the current local date and its status is not `Done`. A task due today is not overdue; a completed task remains not overdue even when its due date has passed.
- Authenticated users can directly check whether an email has a `memberIndex` record; listing the index is denied, but lookups may reveal whether an account exists.
- Email verification is not enabled.
- The UI prevents deleting a project with tasks, but the Firestore project-delete rule does not enforce that restriction (rules cannot check whether a subcollection is empty). Direct rule-authorized deletion could leave task documents behind.
- Notification message text is limited in length by the rules but is not otherwise constrained to a fixed template.
- The offline check relies on the browser's online/offline events. If the connection drops after pressing save but before the server replies, the save button stays on "Saving…" until the connection returns.
- Task lists are fetched per accessible project and filtered client-side. Large workspaces will need pagination and query/index planning.

## Testing

Tested manually on the deployed app with two accounts (owner and member), a 375px browser viewport, and the Firebase Rules Playground. The rules in `firestore.rules` were published to Firebase before testing.

| ID | Test | Expected | Result |
| --- | --- | --- | --- |
| TC-01 | Register with valid inputs | Account and profile created | Pass |
| TC-02 | Register with invalid email | Validation error | Pass |
| TC-03 | Log in and refresh | Session remains active | Pass |
| TC-04 | Open dashboard signed out | Redirect to login | Pass |
| TC-05 | Create project | Project persists after refresh | Pass |
| TC-06 | Update project as member | Operation denied | Pass (UI hides the action; Rules Playground returns "write denied" for a member `update` on a project) |
| TC-07 | Add existing member | Member sees project | Pass |
| TC-08 | Add unknown user | Clear error; no invalid membership | Pass |
| TC-09 | Create task without title | Validation prevents save | Pass |
| TC-10 | Change task status | Correct state persists | Pass (assigned member changed status; it persisted after refresh) |
| TC-11 | Filter high-priority tasks | Only matching tasks shown | Pass |
| TC-12 | Search title keyword | Correct matching tasks shown | Pass |
| TC-13 | Open foreign project URL | No data disclosed | Pass (app shows "project not found or no access"; Rules Playground `get` on the project is denied for a removed member and allowed for the owner) |
| TC-14 | Attempt forbidden Firestore write | Security rules reject operation | Pass (Rules Playground, member `update` on a project: denied) |
| TC-15 | Mobile width 375px | No broken or clipped core controls | Pass |
| TC-16 | Simulate network failure | Visible error and no false success | Pass (offline banner is shown; saving a task or changing its status is blocked with an error message and nothing is written) |
| — | Remove a member who has tasks assigned | Member loses access to the project | Pass |
| — | Unassigned member changes task status | Rules reject the write | Verified by reading the rules (`diff().affectedKeys()` check). The Rules Playground cannot demonstrate it because every task update must set `updatedAt == request.time` |

### Security verification note

While testing, the Rules Playground showed that the database was still on Firebase's default test-mode rules, so the earlier checks in the UI had passed without the rules being involved. After publishing `firestore.rules`, the project list failed to load. The read condition `resource.data.memberIds is list && ...hasAny([request.auth.uid])` was replaced with `request.auth.uid in resource.data.memberIds`, which fixed it. The same change is in this repository.

## Environment variables

Use the keys in `.env.example` for local and deployment configuration. Firebase Web configuration is public client configuration; access control depends on Authentication and Firestore rules, not on hiding these values.
