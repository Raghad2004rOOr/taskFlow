# TaskFlow

A responsive Arabic-first project and task management app built with Next.js, Firebase Authentication, and Cloud Firestore.

## Features

- Email/password registration, sign-in, and sign-out.
- Owner/member project access with project CRUD and membership management.
- Task CRUD with status, priority, due date, assignment, search, and filters.
- Dashboard counts for projects, tasks by status, completion, and overdue work.
- Firestore security rules in `firestore.rules`; project membership and task permissions are enforced in Firestore, not only in the UI.
- RTL responsive layout for mobile, tablet, and desktop.

## Setup

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Email/Password** and create a **Cloud Firestore** database.
3. Add the six Firebase Web app configuration values as the corresponding `NEXT_PUBLIC_FIREBASE_*` environment variables (see `.env.example`). Never add a service-account key to the client app.
4. Deploy the included Firestore rules from the repository root with the Firebase CLI (`firebase deploy --only firestore:rules`), or paste `firestore.rules` into the Firebase Console Rules editor and publish them.
5. Install dependencies with `pnpm install`, then start the app with `pnpm dev`.

## Firestore data model

- `users/{uid}` — the signed-in user’s private profile.
- `userDirectory/{uid}` — display name only, readable by authenticated users through direct document lookups; listing is denied.
- `memberIndex/{lowercase-email}` — minimal lookup record used by project owners to add an existing account by email; listing is denied.
- `projects/{projectId}` — name, description, owner UID, member UID array, and audit timestamps.
- `projects/{projectId}/tasks/{taskId}` — title, description, status, priority, optional assignee and due date, creator UID, and audit timestamps.

## Permissions and known limits

- Project owners manage project details and membership. Members can read shared projects, create tasks, and edit tasks they created or are assigned. Only the owner or assigned member may change a task’s status; only the owner or task creator may delete it.
- Removing a member also clears that member from assigned tasks before revoking project access.
- Firestore does not cascade deletes into task subcollections. To prevent orphaned task records, the app refuses to delete a project while it still contains tasks; delete its tasks first.
- Task lists are fetched per accessible project and filtered in the client, matching the MVP scope. Large workspaces should add pagination and query/index planning.
- No demo accounts or sample data are created. Create fictional accounts for evaluation in your Firebase project.

## Environment variables

Copy the keys from `.env.example` into the local environment or your deployment environment. Firebase Web configuration is public client configuration; access control depends on Authentication and the Firestore rules, not on hiding these values.
