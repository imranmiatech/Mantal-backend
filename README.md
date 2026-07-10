# CAMH Risk Index Backend

NestJS + Prisma + PostgreSQL backend for the Climate-Ageing-Mental Health Risk Index project.

## What this backend does

- Researcher signup and login approval flow
- Admin-only approval for researcher accounts
- Admin panel API to post district risk data directly
- Public landing-page API that returns only published district data
- District-wise filtering for landing page consumption

## Core flow

1. Researcher signs up with `POST /api/auth/signup`
2. Researcher stays blocked from login until admin approval
3. Admin approves researcher with `PATCH /api/admin/users/:id/approve`
4. Researcher can submit data with `POST /api/researcher/submissions`
5. Admin can publish pending submissions with `PATCH /api/admin/submissions/:id/publish`
6. Admin can also post data directly with `POST /api/admin/submissions`
7. Landing page reads live published data from `GET /api/public/dashboard`

## Main routes

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Public

- `GET /api/dashboard`
- `GET /api/public/dashboard`
- `GET /api/public/dashboard?division=Khulna%20Division`
- `GET /api/public/districts`
- `GET /api/public/districts/:slug`

### Researcher

- `GET /api/researcher/dashboard`
- `POST /api/researcher/submissions`
- `GET /api/researcher/submissions/mine`

### Admin

- `POST /api/admin/submissions`
- `GET /api/admin/users/pending`
- `PATCH /api/admin/users/:id/approve`
- `GET /api/admin/submissions/pending`
- `PATCH /api/admin/submissions/:id/publish`
- `PATCH /api/admin/submissions/:id/reject`

Admins and approved researchers can use the same authenticated dashboard route:

```bash
GET /api/dashboard
```

Approved researchers can use all admin routes except:

```bash
PATCH /api/admin/users/:id/approve
```

## Prisma models

- `User`
- `UserApprovalAudit`
- `District`
- `DistrictSubmission`

## Run locally

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

## Default admin

- Email: value from `ADMIN_EMAIL`
- Password: value from `ADMIN_PASSWORD`

## Landing page integration

Frontend should call:

```bash
GET /api/public/dashboard
```

Response includes:

- district list
- published scores
- risk index
- risk level
- division info
- last published time
