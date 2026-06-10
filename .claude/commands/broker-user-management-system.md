### XFL Admin Panel – Broker & User Management System
## Overview
Build a full-stack admin panel with authentication, broker configuration, and user management. Admins manage brokers and users. Users authenticate and land on the broker dashboard. Users can self-manage password.

## Roles
RoleCapabilitiesadminCreate/edit/delete brokers, create/edit/delete users, assign brokers to usersuserLogin, change own password, view broker dashboard

## Backend – FastAPI
# Auth System

JWT-based (access + refresh token)
POST /auth/login → returns access + refresh token
POST /auth/refresh → returns new access token
POST /auth/logout → invalidate refresh token
POST /auth/change-password → authenticated user changes own password
Password hashing: bcrypt
Token blacklist in MySQL on logout


## MySQL Schema
# sql-- Brokers
brokers
  broker_id     VARCHAR PK (e.g. "SNM", "BAL")
  broker_label  VARCHAR NOT NULL
  created_at    DATETIME
  updated_at    DATETIME

-- Users
users
  id            INT PK AUTO_INCREMENT
  email         VARCHAR UNIQUE NOT NULL
  password_hash VARCHAR NOT NULL
  role          ENUM('admin', 'user') DEFAULT 'user'
  broker_id     FK → brokers.broker_id  (nullable: admin has no broker)
  is_active     BOOLEAN DEFAULT TRUE
  created_at    DATETIME
  updated_at    DATETIME

-- Token Blacklist
token_blacklist
  id            INT PK
  jti           VARCHAR UNIQUE   -- JWT ID
  expires_at    DATETIME

## API Endpoints
Broker (admin only)
POST   /admin/brokers          → create broker
GET    /admin/brokers          → list all brokers
PUT    /admin/brokers/{id}     → update broker label
DELETE /admin/brokers/{id}     → delete broker
User (admin only)
POST   /admin/users            → create user (email, password, role, broker_id)
GET    /admin/users            → list all users
PUT    /admin/users/{id}       → update user (email, broker assignment, active status)
DELETE /admin/users/{id}       → delete user
Self-service (authenticated user)
POST   /user/change-password   → {current_password, new_password}
GET    /user/me                → own profile info

Frontend – React/TypeScript
Pages & Routes
/login                   → Login page (all users)
/admin                   → Admin layout (admin role only)
  /admin/brokers         → Broker management
  /admin/users           → User management
/dashboard               → Broker dashboard (user role)
/profile                 → Change password (authenticated user)
Route Guard

Unauthenticated → redirect to /login
user role accessing /admin/* → redirect to /dashboard
admin role → redirect to /admin after login


## Admin Panel – Broker Setup
# Fields:
FieldTypeValidationbroker_idText inputUppercase, max 10 chars, uniquebroker_labelText inputRequired, max 100 chars

Table view: list all brokers with edit/delete actions
Inline edit or modal


## Admin Panel – User Setup
# Fields:
FieldTypeValidationemailEmail inputValid email, uniquepasswordPassword inputMin 8 charsbroker_idDropdownPopulated from broker listroleDropdownadmin / user

Table view: list all users (email, role, assigned broker, active status)
Edit: reassign broker, toggle active, update email
Admin cannot delete own account


## User – Change Password

Form: current_password, new_password, confirm_new_password
Client-side match validation before API call
Accessible from profile/navbar


# Login Form

Email + Password
On success: decode JWT role → route to /admin or /dashboard
Show error on invalid credentials
No registration (admin creates users only)


# Tech Stack
LayerTechBackendFastAPI, SQLAlchemy, Alembic, APSchedulerAuthJWT (python-jose), bcrypt (passlib)DBMySQLFrontendReact 18, TypeScript, ViteHTTPAxiosUIExisting component styleStateReact Context or Zustand (auth state)

## Implementation Order
# Backend

MySQL schema + Alembic migrations
Auth service (login, refresh, logout, change-password)
JWT middleware + role guards
Broker CRUD endpoints
User CRUD endpoints
Seed: default admin account

# Frontend
7. Auth context + token storage + axios interceptor (auto-refresh)
8. Route guards (ProtectedRoute by role)
9. Login page
10. Admin layout + sidebar nav
11. Broker management page
12. User management page
13. Change password page
14. Post-login redirect by role

## Seed Data (on first run)
# Admin account:
  email:    admin@xfl.com
  password: Admin@1234  (force change on first login flag)
  role:     admin