# Technical Requirements Document: Time-Off Microservice

## 1. Overview & Problem Statement

**ExampleHR** provides an employee-facing portal where users can request time off. However, the **Human Capital Management (HCM)** system (e.g., Workday, SAP) remains the authoritative **Source of Truth** for all employment data, including leave balances.

### The Core Problem

Keeping time-off balances synchronized between two independent systems is inherently difficult:

- An employee with 10 days of leave who requests 2 days on ExampleHR must have their balance validated against the HCM.
- The HCM can change balances independently — work anniversaries, annual resets, policy changes — without notifying ExampleHR in real time.
- If ExampleHR relies solely on the HCM for every operation, availability and latency become blockers.
- If ExampleHR caches balances locally, those caches can go stale.

### User Personas

| Persona | Need |
|---------|------|
| **Employee** | Accurate balance visibility and instant feedback when submitting requests |
| **Manager** | Confidence that displayed data is valid when approving or rejecting requests |

---

## 2. Functional Requirements

### 2.1 REST API Endpoints

#### Health
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |

#### Balances
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/balances/:employeeId` | Retrieve all balances for an employee |
| `GET` | `/balances/:employeeId/:locationId` | Retrieve balance for a specific employee-location pair |

#### Time-Off Requests
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/time-off-requests` | Create a new time-off request |
| `GET` | `/time-off-requests` | List requests (filterable by `employeeId`, `locationId`, `status`) |
| `GET` | `/time-off-requests/:id` | Retrieve a specific request |
| `PATCH` | `/time-off-requests/:id/approve` | Manager approves a pending request |
| `PATCH` | `/time-off-requests/:id/reject` | Manager rejects a pending request |
| `PATCH` | `/time-off-requests/:id/cancel` | Employee cancels a pending or approved request |

#### Synchronization
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sync/batch` | HCM pushes bulk balance updates (API-key protected) |
| `POST` | `/sync/employee/:employeeId` | Trigger real-time balance refresh from HCM |
| `POST` | `/sync/webhook` | Receive real-time balance change notification (API-key protected) |

### 2.2 Request Lifecycle

```
                     ┌──────────┐
            create   │          │  reject
         ──────────▶ │ PENDING  │ ──────────▶ REJECTED
                     │          │
                     └────┬─────┘
                          │ cancel
                          ▼
                     CANCELLED

                     ┌────┴─────┐
                     │  approve  │
                     │ + submit  │
                     │  to HCM   │
                     └────┬─────┘
                     ╱         ╲
              HCM accepts    HCM rejects
                 ╱                 ╲
            APPROVED          HCM_REJECTED
                │
                │ cancel (reverses via HCM)
                ▼
            CANCELLED
```

**States:**
- **PENDING**: Request created, awaiting manager review. Balance reserved in `pendingDays`.
- **APPROVED**: Manager approved and HCM confirmed the deduction. Moved from `pendingDays` to `usedDays`.
- **REJECTED**: Manager rejected. `pendingDays` released.
- **CANCELLED**: Employee cancelled. Depending on prior state, either `pendingDays` released or `usedDays` reversed (with HCM cancellation).
- **HCM_REJECTED**: Manager approved but HCM rejected (insufficient balance, blackout period, invalid dimensions). `pendingDays` released.

---

## 3. Technical Challenges & Solutions

### Challenge 1: Balance Consistency (Stale Cache)

**Problem:** The HCM can modify balances independently (work anniversaries, annual resets), making locally cached balances stale.

**Solution — Read-through cache with fallback:**
1. Before creating a time-off request, the service attempts a **real-time sync** from the HCM API to refresh the local `totalDays`.
2. If the HCM is unreachable, the service **falls back to the local cached balance** — accepting slightly stale data over total unavailability.
3. Each balance record tracks `hcmLastSyncedAt` and `hcmVersion` for staleness detection.
4. The HCM can push updates proactively via the **batch endpoint** or **webhook**.

**Why this works:** The employee gets instant feedback (local cache) with best-effort freshness (HCM sync on critical operations). Staleness is bounded because every request creation triggers a sync attempt.

### Challenge 2: HCM Error Unreliability

**Problem:** The HCM may not always return errors for invalid submissions (e.g., insufficient balance, invalid dimension combinations). We cannot fully trust HCM validation.

**Solution — Defensive dual validation:**
1. **Local validation first**: Before submitting to HCM, the service validates balance sufficiency locally using `totalDays - usedDays - pendingDays`.
2. **HCM as second layer**: The HCM submission acts as confirmation, not the sole gatekeeper.
3. On HCM rejection, the request moves to `HCM_REJECTED` and pending balance is released.
4. On HCM acceptance, the request moves to `APPROVED` and balance shifts from pending to used.

**Result:** Even if the HCM silently accepts an invalid request, the local validation would have caught insufficient balances. The system errs on the side of caution.

### Challenge 3: Concurrent Requests (Race Conditions)

**Problem:** Two simultaneous requests for the same employee could each pass the balance check individually but together exceed the available balance.

**Solution — Transaction-level isolation with pending days:**
1. The `pendingDays` field on the balance record acts as an **optimistic reservation**.
2. Request creation wraps the balance check and pending-days increment in a **database transaction** (SQLite's serialized write model provides implicit locking).
3. Available balance is computed as `totalDays - usedDays - pendingDays`, so pending requests reduce availability for subsequent requests.

**Example:** Employee has 10 days. Request A for 6 days sets `pendingDays = 6`. Request B for 6 days sees `available = 10 - 0 - 6 = 4` and is rejected.

### Challenge 4: Batch Sync vs. Active Requests

**Problem:** A batch sync from HCM could overwrite locally managed fields (`pendingDays`, `usedDays`), corrupting the accounting for in-flight requests.

**Solution — Selective field updates:**
- Batch sync and webhook handlers **only update `totalDays`** from HCM data.
- `pendingDays` and `usedDays` are **never overwritten by external sync** — they are exclusively managed by the request lifecycle logic.
- The `hcmVersion` field allows future conflict detection if needed.

---

## 4. Data Model

### Balance

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER (PK) | Auto-incremented primary key |
| `employeeId` | VARCHAR | Employee identifier |
| `locationId` | VARCHAR | Location identifier |
| `totalDays` | DECIMAL(10,2) | Total allocated days (synced from HCM) |
| `usedDays` | DECIMAL(10,2) | Days consumed by approved requests |
| `pendingDays` | DECIMAL(10,2) | Days reserved by pending requests |
| `hcmLastSyncedAt` | DATETIME | Last successful HCM sync timestamp |
| `hcmVersion` | VARCHAR | HCM-provided version for conflict detection |
| `createdAt` | DATETIME | Record creation timestamp |
| `updatedAt` | DATETIME | Last update timestamp |

**Constraints:** `UNIQUE(employeeId, locationId)`
**Computed:** `availableDays = totalDays - usedDays - pendingDays`

### TimeOffRequest

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (PK) | Unique request identifier |
| `employeeId` | VARCHAR | Requesting employee |
| `locationId` | VARCHAR | Location for the leave |
| `startDate` | DATE | Leave start date |
| `endDate` | DATE | Leave end date |
| `numberOfDays` | DECIMAL(10,2) | Number of days requested |
| `status` | VARCHAR | Current status (see lifecycle) |
| `reason` | TEXT | Optional reason for leave |
| `reviewedBy` | VARCHAR | Manager who reviewed |
| `reviewedAt` | DATETIME | Review timestamp |
| `hcmReferenceId` | VARCHAR | Reference ID returned by HCM |
| `hcmSubmittedAt` | DATETIME | When submitted to HCM |
| `hcmResponseAt` | DATETIME | When HCM responded |
| `hcmErrorMessage` | TEXT | Error message if HCM rejected |
| `createdAt` | DATETIME | Record creation timestamp |
| `updatedAt` | DATETIME | Last update timestamp |

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  NestJS Application                  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌──────┐    │
│  │ Balances │  │ Requests │  │ Sync │  │ HCM  │    │
│  │ Module   │  │ Module   │  │Module│  │Module│    │
│  │          │  │          │  │      │  │      │    │
│  │Controller│  │Controller│  │Ctrl  │  │      │    │
│  │ Service  │  │ Service  │──│Svc   │──│ Svc  │──────▶ External HCM API
│  │          │◀─│          │  │      │  │      │    │
│  └────┬─────┘  └────┬─────┘  └──────┘  └──────┘    │
│       │              │                               │
│  ┌────┴──────────────┴───────┐                      │
│  │     TypeORM + SQLite      │                      │
│  │  ┌──────────┐ ┌─────────┐│                      │
│  │  │ balances │ │requests ││                      │
│  │  └──────────┘ └─────────┘│                      │
│  └───────────────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

### Module Responsibilities

- **BalancesModule**: CRUD for balance records, pending/used day accounting, batch upsert logic.
- **RequestsModule**: Full request lifecycle (create, approve, reject, cancel), balance coordination, HCM submission.
- **HcmModule**: HTTP client abstraction for the external HCM API with timeout handling and error extraction.
- **SyncModule**: Inbound sync endpoints — batch, per-employee refresh, and webhook handling.

### Key Design Decisions

1. **Synchronous HCM submission on approve**: When a manager approves, the system immediately submits to HCM and awaits the response. This keeps the state machine simple and avoids eventual-consistency complexity.

2. **Defensive validation**: Balance checks happen locally before HCM submission. The system does not rely solely on HCM to reject invalid requests.

3. **API key authentication for sync endpoints**: Batch and webhook endpoints are protected with API keys to prevent unauthorized balance manipulation.

---

## 6. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Input validation** | All DTOs use `class-validator` decorators. `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` strips unknown fields. |
| **SQL injection** | TypeORM uses parameterized queries exclusively. No raw SQL with user input. |
| **Unauthorized sync access** | Batch and webhook endpoints are protected by `ApiKeyGuard` requiring a valid `x-api-key` header. |
| **HTTP security headers** | `helmet` middleware sets security headers (X-Frame-Options, CSP, etc.). |
| **CORS** | Enabled and configurable via NestJS CORS middleware. |
| **Error information leakage** | Internal errors are logged server-side but return generic messages to clients. |
| **Request size** | Express defaults limit body size; configurable for batch endpoints. |
| **UUID validation** | Request IDs are validated as UUIDs via `ParseUUIDPipe` before database lookup, preventing injection via path params. |

---

## 7. Alternatives Considered

### Sync Strategy: Event-Driven vs. REST Polling

**Considered:** Using a message queue (Kafka, RabbitMQ) for real-time HCM sync events.
**Chosen:** REST endpoints (batch + webhook) for simplicity.
**Trade-off:** Event-driven would provide lower-latency sync and better decoupling, but adds infrastructure complexity. The webhook endpoint provides a migration path — the HCM can push events as they occur, approximating event-driven behaviour without message broker overhead.

### API Style: GraphQL vs. REST

**Considered:** GraphQL for flexible querying.
**Chosen:** REST for its simplicity, broader tooling support, and straightforward caching semantics.
**Trade-off:** GraphQL would reduce over-fetching for complex queries, but the API surface here is small and well-defined — REST maps naturally to the resource model.

### HCM Submission: Async (Job Queue) vs. Synchronous

**Considered:** Submitting to HCM via a background job queue (Bull/BullMQ) on approval, with the request moving through `APPROVED → SUBMITTED_TO_HCM → CONFIRMED/HCM_REJECTED`.
**Chosen:** Synchronous submission during the approve call.
**Trade-off:** Async would improve API response time and handle HCM downtime more gracefully (retry logic), but significantly increases complexity (job state, idempotency, at-least-once delivery). For this iteration, synchronous is sufficient; the architecture supports adding async submission later.

### Database: PostgreSQL vs. SQLite

**Chosen:** SQLite per requirements.
**Trade-off:** SQLite's single-writer model provides natural serialization for concurrent balance checks (an advantage here), but limits horizontal scaling. The TypeORM abstraction allows a straightforward migration to PostgreSQL by changing the connection configuration.

---

## 8. Test Strategy

### Unit Tests (71 tests)
Service-level tests with in-memory SQLite databases. Cover:
- Balance CRUD operations (upsert, reserve, release, confirm, reverse, batch)
- Request lifecycle state transitions (create, approve, reject, cancel)
- Error cases (insufficient balance, invalid state transitions, HCM failures)
- HCM client service (mocked HTTP responses)

### End-to-End Tests (45 tests)
Full HTTP request/response cycles through the NestJS application with a **real mock HCM server** (standalone HTTP server with in-memory state). Cover:
- Complete happy path: create → approve → confirmed
- Balance integrity across multiple requests
- HCM sync via batch, webhook, and per-employee refresh
- HCM failure handling (unavailable, rejection, cancellation failure)
- Input validation (missing fields, invalid UUIDs, date validation)
- Concurrent request handling (pending days preventing double-booking)
- External balance changes (work anniversary) preserving active request state

### Mock HCM Server
A standalone Node.js HTTP server (`MockHcmServer`) with:
- In-memory balance and time-off record storage
- Configurable failure modes (`shouldFailGetBalance`, `shouldFailSubmitTimeOff`, etc.)
- Realistic balance validation (checks available balance before accepting time-off)
- Programmatic state mutation for testing external changes
- Dynamic port allocation (port 0) for test isolation

---

## 9. Future Improvements

1. **Async HCM submission with job queue** — Use Bull/BullMQ for resilient, retryable HCM submissions with dead-letter handling.
2. **Leave type dimension** — Add leave type (vacation, sick, personal) as an additional balance dimension.
3. **Caching layer** — Redis for frequently accessed balances and request lists.
4. **Notification system** — Email/Slack notifications on status changes.
5. **Audit log** — Dedicated audit table tracking all state changes with actor and timestamp.
6. **Rate limiting** — Protect endpoints from abuse, especially sync endpoints.
7. **Periodic background sync** — Scheduled job to refresh all balances from HCM at configurable intervals.
8. **Conflict resolution UI** — Surface stale-balance warnings to managers when `hcmLastSyncedAt` exceeds a threshold.
