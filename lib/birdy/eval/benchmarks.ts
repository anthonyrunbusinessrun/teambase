/**
 * lib/birdy/eval/benchmarks.ts
 * Model evaluation framework for TeamBase workflow quality.
 *
 * PURPOSE:
 *   Measures how well each self-hosted model performs on the actual tasks
 *   Birdy runs inside TeamBase. Not general benchmarks — production-relevant ones.
 *
 * USAGE:
 *   POST /api/birdy/admin/benchmark?model=qwen3:32b&suite=recruiting
 *
 * SUITES:
 *   recruiting  — JD drafting, screening questions, offer letters
 *   operations  — task summarization, status updates, prioritization
 *   reasoning   — multi-step analysis, comparison, planning
 *   code        — SQL, TypeScript, API integration tasks
 */

export interface BenchmarkCase {
  id:       string
  suite:    BenchmarkSuite
  prompt:   string
  scoring: {
    must_contain?:    string[]   // substrings that must appear in output
    must_not_contain?: string[]  // substrings that must NOT appear
    min_length?:      number     // minimum character count
    max_length?:      number     // maximum character count
    format_check?:    (output: string) => boolean
  }
}

export type BenchmarkSuite = 'recruiting' | 'operations' | 'reasoning' | 'code'

export const BENCHMARK_CASES: BenchmarkCase[] = [
  // ── Recruiting ─────────────────────────────────────────────────────────
  {
    id:    'rec-jd-001',
    suite: 'recruiting',
    prompt: 'Write a concise job description for a Warehouse Associate role at Rayland Inc. Include: responsibilities, requirements, schedule.',
    scoring: {
      must_contain:  ['Warehouse', 'responsibilities', 'requirements'],
      min_length:    200,
      max_length:    2000,
    },
  },
  {
    id:    'rec-screen-001',
    suite: 'recruiting',
    prompt: 'Generate 5 phone screening questions for a Shift Supervisor candidate. Questions should assess leadership and scheduling skills.',
    scoring: {
      must_contain:  ['?'],
      min_length:    150,
      format_check:  (o) => (o.match(/\d+\./g) ?? []).length >= 3,
    },
  },
  {
    id:    'rec-offer-001',
    suite: 'recruiting',
    prompt: 'Draft a brief, professional offer letter for Maria Santos for the role of HR Coordinator starting June 1st at $55,000 annual salary.',
    scoring: {
      must_contain:  ['Maria', 'HR Coordinator', '$55,000'],
      min_length:    200,
    },
  },
  // ── Operations ─────────────────────────────────────────────────────────
  {
    id:    'ops-summary-001',
    suite: 'operations',
    prompt: 'Summarize this status update in 2-3 bullet points: "The Q3 hiring drive is behind schedule. We have 7 open roles across Operations and Logistics. 3 candidates are in final interviews. The Operations Supervisor role has been open for 45 days and is urgent."',
    scoring: {
      must_contain:  ['7', '3'],
      max_length:    500,
      format_check:  (o) => o.includes('-') || o.includes('•') || o.includes('*'),
    },
  },
  {
    id:    'ops-priority-001',
    suite: 'operations',
    prompt: 'I have these tasks: (1) Process 15 new applications, (2) Schedule interviews for 3 candidates, (3) Update job posting for Warehouse role, (4) Send offer letter to accepted candidate. What order should I do them in and why?',
    scoring: {
      must_contain:  ['offer', 'interview'],
      min_length:    100,
    },
  },
  // ── Reasoning ──────────────────────────────────────────────────────────
  {
    id:    'rsn-compare-001',
    suite: 'reasoning',
    prompt: 'Compare the pros and cons of hiring full-time vs contract workers for warehouse operations. Give a recommendation for a growing company.',
    scoring: {
      must_contain:  ['full-time', 'contract'],
      min_length:    200,
      format_check:  (o) => o.toLowerCase().includes('pros') || o.toLowerCase().includes('advantage'),
    },
  },
  // ── Code ───────────────────────────────────────────────────────────────
  {
    id:    'code-sql-001',
    suite: 'code',
    prompt: 'Write a SQL query to find all applicants who applied in the last 30 days and are currently in the "SCREENING" stage. Table: applicants(id, full_name, stage, date_applied).',
    scoring: {
      must_contain:  ['SELECT', 'WHERE', 'stage'],
      format_check:  (o) => o.includes('```') || o.toLowerCase().includes('select'),
    },
  },
]

// ── Scorer ─────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  caseId:       string
  suite:        BenchmarkSuite
  model:        string
  provider:     string
  passed:       boolean
  score:        number          // 0.0 – 1.0
  latencyMs:    number
  outputLength: number
  output:       string
  failures:     string[]
}

export function scoreOutput(
  bcase:     BenchmarkCase,
  output:    string,
  latencyMs: number,
  model:     string,
  provider:  string,
): BenchmarkResult {
  const failures: string[] = []
  let   checks   = 0
  let   passed   = 0

  const s = bcase.scoring

  if (s.must_contain) {
    for (const term of s.must_contain) {
      checks++
      if (output.toLowerCase().includes(term.toLowerCase())) passed++
      else failures.push(`Missing required term: "${term}"`)
    }
  }

  if (s.must_not_contain) {
    for (const term of s.must_not_contain) {
      checks++
      if (!output.toLowerCase().includes(term.toLowerCase())) passed++
      else failures.push(`Forbidden term present: "${term}"`)
    }
  }

  if (s.min_length !== undefined) {
    checks++
    if (output.length >= s.min_length) passed++
    else failures.push(`Output too short: ${output.length} < ${s.min_length}`)
  }

  if (s.max_length !== undefined) {
    checks++
    if (output.length <= s.max_length) passed++
    else failures.push(`Output too long: ${output.length} > ${s.max_length}`)
  }

  if (s.format_check) {
    checks++
    if (s.format_check(output)) passed++
    else failures.push('Format check failed')
  }

  const score = checks > 0 ? passed / checks : 1.0

  return {
    caseId: bcase.id,
    suite:  bcase.suite,
    model,
    provider,
    passed: failures.length === 0,
    score,
    latencyMs,
    outputLength: output.length,
    output: output.slice(0, 500),
    failures,
  }
}
