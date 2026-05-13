/**
 * lib/birdy/context.ts
 * Page-context awareness — translates URL pathname into TeamBase module context.
 * This context is injected into the Birdy system prompt so Birdy knows
 * WHAT the user is currently looking at and can give relevant responses.
 */

export type TeamBaseModule =
  | 'home'
  | 'apply'
  | 'admin'
  | 'recruiting'
  | 'knowledge'
  | 'unknown'

export interface PageContext {
  module:      TeamBaseModule
  label:       string        // Human-readable: "Recruiting Pipeline"
  description: string        // Injected into system prompt
  suggestions: string[]      // Quick prompt suggestions shown in the panel
}

const MODULE_MAP: Record<string, PageContext> = {
  '/': {
    module:      'home',
    label:       'Job Board',
    description: 'The user is viewing the Rayland Inc. public job board — open roles and recruitment listings.',
    suggestions: [
      'Summarize all open roles',
      'Which departments are hiring most?',
      'Draft a social media post about our openings',
    ],
  },
  '/apply': {
    module:      'apply',
    label:       'Application Form',
    description: 'The user is on the candidate application page. They may be reviewing how the process works.',
    suggestions: [
      'What does the application process look like?',
      'What should candidates prepare?',
      'How long does hiring typically take?',
    ],
  },
}

/** Detect module from pathname (called client-side via window.location.pathname). */
export function detectModule(pathname: string): PageContext {
  // Exact match first
  if (MODULE_MAP[pathname]) return MODULE_MAP[pathname]

  // Prefix matches
  if (pathname.startsWith('/apply'))  return MODULE_MAP['/apply']
  if (pathname.startsWith('/admin'))  return {
    module: 'admin', label: 'Admin', description: 'The user is in the admin area.',
    suggestions: ['Show system status', 'Review recent AI activity'],
  }

  return {
    module:      'unknown',
    label:       'TeamBase',
    description: 'The user is navigating TeamBase.',
    suggestions: ['What can Birdy help with?', 'Search the knowledge base'],
  }
}

/** Build the context block injected into every system prompt. */
export function buildContextBlock(ctx: PageContext): string {
  return `\n## Current Context\nModule: ${ctx.label}\n${ctx.description}`
}
