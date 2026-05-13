/**
 * lib/birdy/quick-actions.ts
 * Pre-built AI workflow registry — one-click actions that fire into the chat pipeline.
 * Actions are recruiting-focused to match Rayland Inc. / PeopleBook context.
 *
 * DESIGN: Actions pre-fill the chat input with a structured prompt.
 * They use the same SSE streaming endpoint as regular chat — no extra API needed.
 * This keeps the architecture simple and gives actions the full context window.
 */

export interface QuickAction {
  key:         string
  label:       string
  description: string
  icon:        string        // emoji or SVG path name
  category:    ActionCategory
  prompt:      string        // the prompt sent to Birdy
  color:       string        // accent color for the card
}

export type ActionCategory =
  | 'recruiting'
  | 'content'
  | 'analysis'
  | 'operations'

export const QUICK_ACTIONS: QuickAction[] = [
  // ── Recruiting ──────────────────────────────────────────────────────────
  {
    key:         'pipeline-summary',
    label:       'Pipeline Summary',
    description: 'Status of all active roles and candidates',
    icon:        '📊',
    category:    'recruiting',
    color:       '#1e3a5f',
    prompt:      'Give me a concise summary of our current hiring pipeline. Include: open roles by department, typical stages candidates are at, any roles that seem stuck or urgent, and top recommendations for the team today.',
  },
  {
    key:         'draft-jd',
    label:       'Draft Job Description',
    description: 'Generate a polished JD for any role',
    icon:        '✍️',
    category:    'content',
    color:       '#1a3a2a',
    prompt:      'Help me write a professional job description. Ask me for: the role title, department, key responsibilities (3–5), required qualifications, and whether it\'s remote/hybrid/onsite. Then draft a complete JD in Rayland\'s voice — professional, direct, no fluff.',
  },
  {
    key:         'screen-candidate',
    label:       'Screen Candidate',
    description: 'Pre-screening questions for any role',
    icon:        '🔍',
    category:    'recruiting',
    color:       '#2a1a3a',
    prompt:      'I need to screen a candidate. Ask me for the role title and any specific requirements. Then give me 8–10 targeted pre-screening questions that will quickly identify whether this candidate is worth a full interview. Include both skill and culture-fit questions.',
  },
  {
    key:         'interview-plan',
    label:       'Interview Plan',
    description: 'Structured interview with scoring rubric',
    icon:        '🗓️',
    category:    'recruiting',
    color:       '#3a2a1a',
    prompt:      'Create a structured interview plan for me. Ask for the role and seniority level. Then provide: a 60-minute interview agenda, 12 questions organized by competency (technical, behavioral, situational), and a simple 1–5 scoring rubric for each competency area.',
  },
  {
    key:         'offer-draft',
    label:       'Draft Offer Letter',
    description: 'Professional offer letter template',
    icon:        '📄',
    category:    'content',
    color:       '#1a2a3a',
    prompt:      'Help me draft an offer letter. Ask for: candidate name, role title, start date, salary, and any key benefits to highlight. Then write a professional, warm offer letter in Rayland\'s voice. Keep it clear and compelling — we want them to accept.',
  },
  {
    key:         'rejection-email',
    label:       'Rejection Email',
    description: 'Compassionate, professional decline',
    icon:        '📧',
    category:    'content',
    color:       '#3a1a1a',
    prompt:      'Write a professional rejection email. Ask me for the candidate name and role they applied for. Draft a thoughtful rejection that: thanks them sincerely, is warm but clear, leaves the door open for future roles, and represents Rayland well. No generic templates.',
  },
  {
    key:         'role-analysis',
    label:       'Role Market Analysis',
    description: 'Compensation and market insights',
    icon:        '📈',
    category:    'analysis',
    color:       '#1a3a1a',
    prompt:      'Give me a market analysis for a role we\'re hiring. Ask me for the job title and location. Then provide: typical compensation range, key skills the market values, common titles for the same role at other companies, and 3 hiring tips specific to this type of role.',
  },
  {
    key:         'onboarding-plan',
    label:       'Onboarding Plan',
    description: '30/60/90 day plan for new hires',
    icon:        '🚀',
    category:    'operations',
    color:       '#1e3a3a',
    prompt:      'Create a 30/60/90 day onboarding plan. Ask me for the role title and department. Then build a structured plan with: Week 1 priorities, 30-day learning objectives, 60-day contribution goals, and 90-day performance expectations. Make it practical and specific.',
  },
]

export const ACTION_CATEGORIES: Record<ActionCategory, string> = {
  recruiting:  'Recruiting',
  content:     'Content',
  analysis:    'Analysis',
  operations:  'Operations',
}

export function getActionByKey(key: string): QuickAction | undefined {
  return QUICK_ACTIONS.find(a => a.key === key)
}
