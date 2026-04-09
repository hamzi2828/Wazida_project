# Time-Off Microservice

A NestJS microservice that manages the lifecycle of time-off requests and maintains balance integrity with an external Human Capital Management (HCM) system.

## Architecture Overview

- **NestJS** — Modular backend framework
- **TypeORM + SQLite** — Persistence with in-memory option for testing
- **Mock HCM Server** — Standalone HTTP server simulating HCM behaviour for integration tests

Key design:
- Balances are cached locally per employee-location pair, with real-time sync from HCM on critical operations
- `pendingDays` tracking prevents double-booking across concurrent requests
- Batch and webhook endpoints allow the HCM to push balance updates proactively
- Defensive local validation before HCM submission (HCM errors are not always guaranteed)

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env

# 3. Build the project
npm run build

# 4. Start the server
npm run start

# Or start in development mode (auto-reload)
npm run start:dev
```

The service runs on `http://localhost:3000` by default.

### API Documentation

Swagger UI is available at `http://localhost:3000/api/docs` when the server is running.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HCM_BASE_URL` | `http://localhost:3001` | External HCM API base URL |
| `HCM_API_KEY` | — | API key for authenticating with HCM |
| `SYNC_API_KEY` | — | API key required for sync/webhook endpoints |
| `DATABASE_PATH` | `./timeoff.db` | SQLite database file path (use `:memory:` for testing) |

## Running Tests

```bash
# Unit tests
npm test

# Unit tests with coverage report
npm run test:cov

# End-to-end tests (includes mock HCM server)
npm run test:e2e

# Watch mode
npm run test:watch
```

### Test Architecture

- **Unit tests** (`src/**/*.spec.ts`) — Test service logic in isolation with in-memory SQLite
- **E2E tests** (`test/e2e/*.e2e-spec.ts`) — Full HTTP lifecycle tests with a real mock HCM server
- **Mock HCM server** (`test/mock-hcm/mock-hcm.server.ts`) — Standalone HTTP server with configurable failure modes

### Coverage

Unit tests cover core service logic:
- `BalancesService`: 94% line coverage
- `RequestsService`: 93% line coverage
- `HcmService`: 94% line coverage

E2E tests additionally cover controller routing, input validation, API-key guards, and full integration flows.

## API Endpoints

### Health
- `GET /health` — Service health check

### Balances
- `GET /balances/:employeeId` — All balances for an employee
- `GET /balances/:employeeId/:locationId` — Balance for a specific employee-location pair

### Time-Off Requests
- `POST /time-off-requests` — Create a new request
- `GET /time-off-requests` — List requests (query params: `employeeId`, `locationId`, `status`)
- `GET /time-off-requests/:id` — Get a specific request
- `PATCH /time-off-requests/:id/approve` — Approve (body: `{ "reviewedBy": "manager-id" }`)
- `PATCH /time-off-requests/:id/reject` — Reject (body: `{ "reviewedBy": "manager-id" }`)
- `PATCH /time-off-requests/:id/cancel` — Cancel

### Sync (HCM Integration)
- `POST /sync/batch` — Bulk balance update from HCM (requires `x-api-key` header)
- `POST /sync/employee/:employeeId` — Trigger real-time sync for an employee
- `POST /sync/webhook` — Receive balance change notification (requires `x-api-key` header)

## Request Lifecycle

```
PENDING  →  APPROVED (HCM confirmed)
         →  REJECTED (manager rejected)
         →  CANCELLED (employee cancelled)
         →  HCM_REJECTED (manager approved, but HCM rejected)

APPROVED →  CANCELLED (employee cancelled, reversed in HCM)
```

## Project Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
├── app.controller.ts            # Health check
├── common/
│   ├── guards/api-key.guard.ts  # API key authentication
│   └── filters/                 # Global exception filter
├── balances/                    # Balance management module
├── requests/                    # Time-off request lifecycle module
├── hcm/                         # HCM API client module
└── sync/                        # Sync/webhook endpoints module

test/
├── mock-hcm/                    # Mock HCM server for integration testing
└── e2e/                         # End-to-end test suites
```

## Technical Documentation

See [TRD.md](./TRD.md) for the full Technical Requirements Document including:
- Problem analysis and challenges
- Architecture decisions and trade-offs
- Data model design
- Security considerations
- Alternatives considered
- Test strategy
# Wazida_project
