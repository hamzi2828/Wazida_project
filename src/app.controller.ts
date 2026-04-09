import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  @Header('Content-Type', 'text/html')
  @ApiExcludeEndpoint()
  root(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ExampleHR Time-Off Microservice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-deep: #ffffff;
      --bg-surface: #f8f9fb;
      --bg-elevated: #f1f3f6;
      --bg-hover: #eaecf0;
      --border-subtle: #e2e5ea;
      --border-accent: #d0d4db;
      --text-primary: #1a1d23;
      --text-secondary: #4b5563;
      --text-muted: #8892a0;
      --accent-blue: #2563eb;
      --accent-cyan: #0891b2;
      --accent-green: #16a34a;
      --accent-amber: #b45309;
      --accent-red: #dc2626;
      --accent-purple: #7c3aed;
      --glow-blue: rgba(37, 99, 235, 0.08);
      --glow-green: rgba(22, 163, 74, 0.08);
      --radius: 8px;
      --radius-lg: 14px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg-deep);
      color: var(--text-primary);
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* Atmospheric background */
    .bg-glow {
      position: fixed;
      top: -200px;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 500px;
      background: radial-gradient(ellipse, rgba(37, 99, 235, 0.06) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      max-width: 860px;
      margin: 0 auto;
      padding: 48px 28px 64px;
    }

    /* Header */
    .header { margin-bottom: 48px; }

    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .logo-mark {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Mono', monospace;
      font-weight: 500;
      font-size: 16px;
      color: #ffffff;
    }

    .logo-text {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 14px;
      background: var(--glow-green);
      border: 1px solid rgba(22, 163, 74, 0.25);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: var(--accent-green);
    }

    .status-pill::before {
      content: '';
      width: 7px;
      height: 7px;
      background: var(--accent-green);
      border-radius: 50%;
      animation: blink 2.5s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    h1 {
      font-size: 2.6rem;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: var(--text-primary);
      margin-bottom: 14px;
    }

    h1 span {
      background: linear-gradient(135deg, #2563eb, #0891b2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .tagline {
      font-size: 1.05rem;
      font-weight: 300;
      color: var(--text-secondary);
      line-height: 1.6;
      max-width: 620px;
    }

    /* Quick links */
    .quick-links {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }

    .ql {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
    }

    .ql-primary {
      background: var(--accent-blue);
      color: #ffffff;
    }
    .ql-primary:hover { background: #1d4ed8; }

    .ql-secondary {
      background: var(--bg-elevated);
      border: 1px solid var(--border-accent);
      color: var(--text-primary);
    }
    .ql-secondary:hover { background: var(--bg-hover); border-color: #b0b8c4; }

    /* Section titles */
    .section {
      margin-top: 56px;
    }

    .section-label {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--accent-blue);
      margin-bottom: 10px;
    }

    .section-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }

    /* Flow diagram */
    .flow-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 32px;
      overflow-x: auto;
    }

    .flow-track {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .flow-row {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .flow-node {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-accent);
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .flow-node-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot-pending { background: var(--accent-amber); }
    .dot-approved { background: var(--accent-green); }
    .dot-rejected { background: var(--accent-red); }
    .dot-cancelled { background: var(--text-muted); }
    .dot-hcm { background: var(--accent-purple); }
    .dot-action { background: var(--accent-blue); }

    .flow-arrow {
      display: flex;
      align-items: center;
      padding: 0 6px;
      color: var(--text-muted);
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      gap: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .flow-arrow::before {
      content: '';
      width: 24px;
      height: 1px;
      background: var(--border-accent);
    }

    .flow-arrow::after {
      content: '';
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 6px solid var(--border-accent);
    }

    .flow-branch {
      margin-left: 52px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .flow-branch-line {
      display: flex;
      align-items: center;
      gap: 0;
      position: relative;
      padding-left: 20px;
    }

    .flow-branch-line::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      width: 14px;
      height: 1px;
      background: var(--border-accent);
    }

    .flow-outcome {
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid;
    }

    .outcome-green { color: var(--accent-green); border-color: rgba(22,163,74,0.3); background: rgba(22,163,74,0.07); }
    .outcome-red { color: var(--accent-red); border-color: rgba(220,38,38,0.3); background: rgba(220,38,38,0.06); }
    .outcome-purple { color: var(--accent-purple); border-color: rgba(124,58,237,0.3); background: rgba(124,58,237,0.06); }
    .outcome-muted { color: var(--text-muted); border-color: var(--border-subtle); background: var(--bg-elevated); }

    .flow-note {
      font-family: 'DM Mono', monospace;
      font-size: 10.5px;
      color: var(--text-muted);
      margin-left: 10px;
    }

    /* Endpoints */
    .ep-group {
      margin-bottom: 24px;
    }

    .ep-group-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 8px;
      padding-left: 2px;
    }

    .ep-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ep {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius);
      transition: all 0.15s;
    }

    .ep:hover {
      background: var(--bg-elevated);
      border-color: var(--border-accent);
    }

    .ep-method {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      padding: 3px 7px;
      border-radius: 4px;
      min-width: 50px;
      text-align: center;
      letter-spacing: 0.04em;
    }

    .m-get { background: rgba(37,99,235,0.1); color: var(--accent-blue); }
    .m-post { background: rgba(22,163,74,0.1); color: var(--accent-green); }
    .m-patch { background: rgba(180,83,9,0.1); color: var(--accent-amber); }

    .ep-path {
      font-family: 'DM Mono', monospace;
      font-size: 13px;
      color: var(--text-primary);
    }

    .ep-desc {
      margin-left: auto;
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .ep-badge {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      padding: 2px 7px;
      border-radius: 3px;
      background: rgba(163,113,247,0.1);
      color: var(--accent-purple);
      border: 1px solid rgba(163,113,247,0.2);
      letter-spacing: 0.06em;
    }

    /* Quick start */
    .code-block {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 14px;
    }

    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-subtle);
    }

    .code-step {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .code-step-num {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--glow-blue);
      color: var(--accent-blue);
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      font-weight: 500;
    }

    .code-desc {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      color: var(--text-muted);
    }

    .code-body {
      padding: 14px 16px;
      overflow-x: auto;
    }

    .code-body pre {
      font-family: 'DM Mono', monospace;
      font-size: 12.5px;
      line-height: 1.6;
      color: var(--text-secondary);
      white-space: pre;
      margin: 0;
    }

    .code-body pre .cmd { color: #0e7490; }
    .code-body pre .flag { color: var(--accent-amber); }
    .code-body pre .url { color: var(--accent-blue); }
    .code-body pre .str { color: #15803d; }
    .code-body pre .key { color: var(--accent-purple); }

    /* Footer */
    .footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-text {
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'DM Mono', monospace;
    }

    .footer-links {
      display: flex;
      gap: 16px;
    }

    .footer-links a {
      font-size: 12px;
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-links a:hover {
      color: var(--accent-blue);
    }

    /* Responsive */
    @media (max-width: 640px) {
      h1 { font-size: 1.8rem; }
      .container { padding: 28px 16px 48px; }
      .ep-desc { display: none; }
      .quick-links { flex-direction: column; }
      .flow-container { padding: 20px; }
      .header-row { flex-direction: column; align-items: flex-start; gap: 12px; }
      .footer { flex-direction: column; gap: 12px; align-items: flex-start; }
    }

    /* Animations */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate {
      animation: fadeUp 0.5s ease-out both;
    }

    .d1 { animation-delay: 0.05s; }
    .d2 { animation-delay: 0.1s; }
    .d3 { animation-delay: 0.15s; }
    .d4 { animation-delay: 0.2s; }
    .d5 { animation-delay: 0.3s; }
    .d6 { animation-delay: 0.4s; }
    .d7 { animation-delay: 0.5s; }
  </style>
</head>
<body>
  <div class="bg-glow"></div>

  <div class="container">
    <!-- Header -->
    <header class="header animate d1">
      <div class="header-row">
        <div class="logo-mark">
          <div class="logo-icon">TO</div>
          <span class="logo-text">ExampleHR</span>
        </div>
        <div class="status-pill">Operational</div>
      </div>

      <h1>Time-Off <span>Microservice</span></h1>
      <p class="tagline">
        Manages the full lifecycle of employee time-off requests and keeps leave balances
        in sync with HCM systems like Workday and SAP. Built with NestJS, SQLite, and TypeORM.
      </p>

      <div class="quick-links">
        <a href="/api/docs" class="ql ql-primary">Swagger Documentation</a>
        <a href="/health" class="ql ql-secondary">Health Check</a>
      </div>
    </header>

    <!-- How It Works -->
    <section class="section animate d2">
      <div class="section-label">// How it works</div>
      <div class="section-title">Request Lifecycle</div>

      <div class="flow-container">
        <div class="flow-track">

          <div class="flow-row">
            <div class="flow-node"><div class="flow-node-dot dot-action"></div>Employee Creates Request</div>
            <div class="flow-arrow"></div>
            <div class="flow-node"><div class="flow-node-dot dot-pending"></div>PENDING</div>
            <span class="flow-note">balance reserved in pendingDays</span>
          </div>

          <div class="flow-branch">
            <div class="flow-branch-line">
              <div class="flow-node"><div class="flow-node-dot dot-action"></div>Manager Approves</div>
              <div class="flow-arrow"></div>
              <div class="flow-node"><div class="flow-node-dot dot-hcm"></div>Submit to HCM</div>
            </div>
            <div class="flow-branch" style="margin-left: 32px;">
              <div class="flow-branch-line">
                <span class="flow-outcome outcome-green">APPROVED</span>
                <span class="flow-note">pendingDays moved to usedDays</span>
              </div>
              <div class="flow-branch-line">
                <span class="flow-outcome outcome-purple">HCM_REJECTED</span>
                <span class="flow-note">pendingDays released</span>
              </div>
            </div>
          </div>

          <div class="flow-branch">
            <div class="flow-branch-line">
              <span class="flow-outcome outcome-red">REJECTED</span>
              <span class="flow-note">manager rejects &rarr; pendingDays released</span>
            </div>
          </div>

          <div class="flow-branch">
            <div class="flow-branch-line">
              <span class="flow-outcome outcome-muted">CANCELLED</span>
              <span class="flow-note">employee cancels &rarr; balance released or reversed via HCM</span>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- API Endpoints -->
    <section class="section animate d3">
      <div class="section-label">// Endpoints</div>
      <div class="section-title">API Reference</div>

      <div class="ep-group">
        <div class="ep-group-title">Balances</div>
        <div class="ep-list">
          <div class="ep">
            <span class="ep-method m-get">GET</span>
            <span class="ep-path">/balances/:employeeId</span>
            <span class="ep-desc">All balances for an employee</span>
          </div>
          <div class="ep">
            <span class="ep-method m-get">GET</span>
            <span class="ep-path">/balances/:employeeId/:locationId</span>
            <span class="ep-desc">Balance for specific location</span>
          </div>
        </div>
      </div>

      <div class="ep-group">
        <div class="ep-group-title">Time-Off Requests</div>
        <div class="ep-list">
          <div class="ep">
            <span class="ep-method m-post">POST</span>
            <span class="ep-path">/time-off-requests</span>
            <span class="ep-desc">Create a new request</span>
          </div>
          <div class="ep">
            <span class="ep-method m-get">GET</span>
            <span class="ep-path">/time-off-requests</span>
            <span class="ep-desc">List all requests (filterable)</span>
          </div>
          <div class="ep">
            <span class="ep-method m-get">GET</span>
            <span class="ep-path">/time-off-requests/:id</span>
            <span class="ep-desc">Get specific request</span>
          </div>
          <div class="ep">
            <span class="ep-method m-patch">PATCH</span>
            <span class="ep-path">/time-off-requests/:id/approve</span>
            <span class="ep-desc">Manager approves</span>
          </div>
          <div class="ep">
            <span class="ep-method m-patch">PATCH</span>
            <span class="ep-path">/time-off-requests/:id/reject</span>
            <span class="ep-desc">Manager rejects</span>
          </div>
          <div class="ep">
            <span class="ep-method m-patch">PATCH</span>
            <span class="ep-path">/time-off-requests/:id/cancel</span>
            <span class="ep-desc">Employee cancels</span>
          </div>
        </div>
      </div>

      <div class="ep-group">
        <div class="ep-group-title">Sync &mdash; HCM Integration</div>
        <div class="ep-list">
          <div class="ep">
            <span class="ep-method m-post">POST</span>
            <span class="ep-path">/sync/batch</span>
            <span class="ep-desc">Bulk balance sync from HCM</span>
            <span class="ep-badge">API KEY</span>
          </div>
          <div class="ep">
            <span class="ep-method m-post">POST</span>
            <span class="ep-path">/sync/employee/:employeeId</span>
            <span class="ep-desc">Per-employee sync refresh</span>
          </div>
          <div class="ep">
            <span class="ep-method m-post">POST</span>
            <span class="ep-path">/sync/webhook</span>
            <span class="ep-desc">Balance change notification</span>
            <span class="ep-badge">API KEY</span>
          </div>
        </div>
      </div>

      <div class="ep-group">
        <div class="ep-group-title">System</div>
        <div class="ep-list">
          <div class="ep">
            <span class="ep-method m-get">GET</span>
            <span class="ep-path">/health</span>
            <span class="ep-desc">Health check</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Start -->
    <section class="section animate d4">
      <div class="section-label">// Quick start</div>
      <div class="section-title">Try It Out</div>

      <div class="code-block">
        <div class="code-header">
          <div class="code-step">
            <span class="code-step-num">1</span>
            Seed a balance via batch sync
          </div>
          <span class="code-desc">POST /sync/batch</span>
        </div>
        <div class="code-body">
          <pre><span class="cmd">curl</span> <span class="flag">-X POST</span> <span class="url">http://localhost:3000/sync/batch</span> \\
  <span class="flag">-H</span> <span class="str">"Content-Type: application/json"</span> \\
  <span class="flag">-H</span> <span class="str">"x-api-key: YOUR_SYNC_API_KEY"</span> \\
  <span class="flag">-d</span> <span class="str">'{ <span class="key">"records"</span>: [{ <span class="key">"employeeId"</span>: "emp-1", <span class="key">"locationId"</span>: "loc-1", <span class="key">"totalDays"</span>: 20 }] }'</span></pre>
        </div>
      </div>

      <div class="code-block">
        <div class="code-header">
          <div class="code-step">
            <span class="code-step-num">2</span>
            Create a time-off request
          </div>
          <span class="code-desc">POST /time-off-requests</span>
        </div>
        <div class="code-body">
          <pre><span class="cmd">curl</span> <span class="flag">-X POST</span> <span class="url">http://localhost:3000/time-off-requests</span> \\
  <span class="flag">-H</span> <span class="str">"Content-Type: application/json"</span> \\
  <span class="flag">-d</span> <span class="str">'{
    <span class="key">"employeeId"</span>: "emp-1",
    <span class="key">"locationId"</span>: "loc-1",
    <span class="key">"startDate"</span>: "2026-05-01",
    <span class="key">"endDate"</span>: "2026-05-03",
    <span class="key">"numberOfDays"</span>: 3,
    <span class="key">"reason"</span>: "Family vacation"
  }'</span></pre>
        </div>
      </div>

      <div class="code-block">
        <div class="code-header">
          <div class="code-step">
            <span class="code-step-num">3</span>
            Approve the request (replace :id)
          </div>
          <span class="code-desc">PATCH /time-off-requests/:id/approve</span>
        </div>
        <div class="code-body">
          <pre><span class="cmd">curl</span> <span class="flag">-X PATCH</span> <span class="url">http://localhost:3000/time-off-requests/REQUEST_ID/approve</span> \\
  <span class="flag">-H</span> <span class="str">"Content-Type: application/json"</span> \\
  <span class="flag">-d</span> <span class="str">'{ <span class="key">"reviewedBy"</span>: "manager-1" }'</span></pre>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer animate d5">
      <span class="footer-text">Time-Off Microservice v1.0</span>
      <div class="footer-links">
        <a href="/api/docs">Swagger</a>
        <a href="/health">Health</a>
      </div>
    </footer>
  </div>
</body>
</html>`;
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'time-off-service',
    };
  }
}
