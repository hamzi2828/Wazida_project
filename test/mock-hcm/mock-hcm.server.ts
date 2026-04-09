import * as http from 'http';

interface BalanceRecord {
  employeeId: string;
  locationId: string;
  totalDays: number;
  usedDays: number;
  version: string;
}

interface TimeOffRecord {
  referenceId: string;
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  status: string;
}

/**
 * Standalone mock HCM server for integration/e2e testing.
 * Simulates real HCM behaviour with in-memory state and configurable failure modes.
 */
export class MockHcmServer {
  private server!: http.Server;
  private balances: Map<string, BalanceRecord> = new Map();
  private timeOffRecords: Map<string, TimeOffRecord> = new Map();
  private refCounter = 0;
  private port: number;

  // Configurable failure modes for testing error handling
  public shouldFailGetBalance = false;
  public shouldFailSubmitTimeOff = false;
  public shouldFailCancelTimeOff = false;
  public simulateLatency = 0;
  public rejectNextSubmission = false;
  public rejectReason = '';

  constructor(port = 3001) {
    this.port = port;
  }

  private key(employeeId: string, locationId: string): string {
    return `${employeeId}:${locationId}`;
  }

  /** Seed a balance record for testing */
  seedBalance(
    employeeId: string,
    locationId: string,
    totalDays: number,
    usedDays = 0,
  ): void {
    this.balances.set(this.key(employeeId, locationId), {
      employeeId,
      locationId,
      totalDays,
      usedDays,
      version: `v${Date.now()}`,
    });
  }

  getSeededBalance(
    employeeId: string,
    locationId: string,
  ): BalanceRecord | undefined {
    return this.balances.get(this.key(employeeId, locationId));
  }

  /** Simulate an external balance change (e.g. work anniversary) */
  updateBalance(
    employeeId: string,
    locationId: string,
    totalDays: number,
  ): void {
    const existing = this.balances.get(this.key(employeeId, locationId));
    if (existing) {
      existing.totalDays = totalDays;
      existing.version = `v${Date.now()}`;
    }
  }

  getTimeOffRecords(): TimeOffRecord[] {
    return Array.from(this.timeOffRecords.values());
  }

  /** Reset all state and failure flags */
  reset(): void {
    this.balances.clear();
    this.timeOffRecords.clear();
    this.refCounter = 0;
    this.shouldFailGetBalance = false;
    this.shouldFailSubmitTimeOff = false;
    this.shouldFailCancelTimeOff = false;
    this.simulateLatency = 0;
    this.rejectNextSubmission = false;
    this.rejectReason = '';
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        if (this.simulateLatency > 0) {
          await new Promise((r) => setTimeout(r, this.simulateLatency));
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            this.handleRequest(req, res, body);
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({ message: 'Internal mock server error' }),
            );
          }
        });
      });

      this.server.listen(this.port, () => {
        const address = this.server.address();
        const assignedPort =
          typeof address === 'object' && address
            ? address.port
            : this.port;
        this.port = assignedPort;
        resolve(assignedPort);
      });

      this.server.on('error', reject);
    });
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string,
  ): void {
    const url = req.url || '';
    const method = req.method || '';

    // GET /api/balances/:employeeId/:locationId
    const balanceMatch = url.match(/^\/api\/balances\/([^/]+)\/([^/]+)$/);
    if (method === 'GET' && balanceMatch) {
      if (this.shouldFailGetBalance) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'HCM service unavailable' }));
        return;
      }

      const [, employeeId, locationId] = balanceMatch;
      const balance = this.balances.get(this.key(employeeId, locationId));

      if (!balance) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Balance not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(balance));
      return;
    }

    // POST /api/time-off
    if (method === 'POST' && url === '/api/time-off') {
      if (this.shouldFailSubmitTimeOff) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'HCM service unavailable' }));
        return;
      }

      const data = JSON.parse(body);

      if (this.rejectNextSubmission) {
        this.rejectNextSubmission = false;
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message:
              this.rejectReason || 'Insufficient balance in HCM',
            status: 'REJECTED',
          }),
        );
        return;
      }

      const k = this.key(data.employeeId, data.locationId);
      const balance = this.balances.get(k);

      if (!balance) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: 'Invalid employee/location combination',
            status: 'REJECTED',
          }),
        );
        return;
      }

      const available = balance.totalDays - balance.usedDays;
      if (available < data.numberOfDays) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: `Insufficient balance. Available: ${available}, Requested: ${data.numberOfDays}`,
            status: 'REJECTED',
          }),
        );
        return;
      }

      this.refCounter++;
      const referenceId = `HCM-REF-${this.refCounter}`;
      balance.usedDays += data.numberOfDays;

      this.timeOffRecords.set(referenceId, {
        referenceId,
        employeeId: data.employeeId,
        locationId: data.locationId,
        startDate: data.startDate,
        endDate: data.endDate,
        numberOfDays: data.numberOfDays,
        status: 'APPROVED',
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          referenceId,
          status: 'APPROVED',
          message: 'Time-off approved by HCM',
        }),
      );
      return;
    }

    // DELETE /api/time-off/:referenceId
    const cancelMatch = url.match(/^\/api\/time-off\/([^/]+)$/);
    if (method === 'DELETE' && cancelMatch) {
      if (this.shouldFailCancelTimeOff) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'HCM service unavailable' }));
        return;
      }

      const [, referenceId] = cancelMatch;
      const record = this.timeOffRecords.get(referenceId);

      if (!record) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Time-off record not found' }));
        return;
      }

      const k = this.key(record.employeeId, record.locationId);
      const balance = this.balances.get(k);
      if (balance) {
        balance.usedDays = Math.max(
          0,
          balance.usedDays - record.numberOfDays,
        );
      }

      record.status = 'CANCELLED';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ status: 'CANCELLED', message: 'Time-off cancelled' }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}
