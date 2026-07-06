# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React/Vite frontend and a Python backend. Frontend code lives in `src/`, with `components/`, `components/admin/`, `services/`, `hooks/`, `context/`, `config/`, and `types/` holding the main UI and data-access layers. Backend code lives in `backend/app/`, organized into `routers/`, `services/`, `models/`, `schemas/`, `db/`, `dependencies/`, `scheduler/`, and `utils/`. Operational helpers are in `backend/scripts/`. Generated folders such as `dist/`, `node_modules/`, virtual environments, logs, and `__pycache__/` should not be committed.

## Build, Test, and Development Commands

Frontend commands run from the repository root: `npm install` installs dependencies, `npm run dev` starts Vite, `npm run build` type-checks and builds `dist/`, and `npm run preview` serves the production build.

Backend commands run from `backend/`: `python -m venv .venv` creates an environment, `.venv\Scripts\activate` activates it on Windows, `pip install -r requirements.txt` installs dependencies, and `uvicorn app.main:app --reload --port 8000` starts the API server.

## Coding Style & Naming Conventions

Use TypeScript and React functional components in the frontend. Name components in `PascalCase` such as `Dashboard.tsx`, hooks with `use` prefixes such as `useDashboardData.ts`, and services with domain names such as `authService.ts`.

Use Python modules in `snake_case`. Keep route handlers in `routers/`, business logic in `services/`, database models in `models/`, and request/response contracts in `schemas/`. Prefer typed signatures and explicit names.

## Testing Guidelines

No test runner or committed test suite is currently configured. Before submitting changes, run `npm run build` for frontend type and build checks. For backend changes, start `uvicorn app.main:app --reload --port 8000` and exercise changed endpoints manually. Add future tests near covered code, using `*.test.tsx` for frontend tests and `test_*.py` for backend tests.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, for example `Replace market snapshot with price history` and `Update script for fetch_data.py`. Keep commit messages focused on one change.

Pull requests should include a clear description, affected frontend/backend areas, setup or migration notes, and screenshots for visible UI changes. Link related issues when available and list verification commands or manual checks.

## Security & Configuration Tips

Do not commit `.env` files, service credentials, JWT secrets, database passwords, or generated tokens. Backend configuration belongs in environment variables. Keep frontend `src/config/brokers.ts` and backend broker configuration aligned when broker lists change.
