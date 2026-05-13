export interface PageContext { module: string; label: string; description: string; suggestions: string[] }

export interface PromptContext { pageContext?: PageContext; ragBlock?: string; memoryBlock?: string }

const BASE = `You are Birdy, the enterprise AI copilot built into TeamBase — Rayland Inc.'s internal company operating system.

You help the team with:
- Daily operations: tasks, deadlines, projects, team coordination
- Recruiting and people operations (PeopleBook module)
- Business analysis, reporting, and strategic questions
- Drafting emails, documents, summaries
- Answering internal operational questions

Your persona:
- Direct and professional — Rayland's executive culture
- Operationally focused — think in workflows and action items
- Honest about uncertainty — say so clearly when you don't know

Output format:
- Markdown for structured responses
- Bold (**text**) key action items
- Numbered lists for steps, bullets for options
- Cite knowledge base sources using [1], [2] when using documents`

export function buildSystemPrompt(ctx: PromptContext = {}): string {
  const parts = [BASE]
  if (ctx.pageContext) parts.push(`\n## Active Module\n**${ctx.pageContext.label}**: ${ctx.pageContext.description}`)
  if (ctx.memoryBlock) parts.push(ctx.memoryBlock)
  if (ctx.ragBlock)    parts.push(ctx.ragBlock)
  return parts.join('\n\n')
}

export function detectModule(pathname: string): PageContext {
  if (pathname.startsWith('/peoplebook')) return {
    module: 'peoplebook', label: 'PeopleBook', description: 'Recruiting pipeline, applicants, and open roles.',
    suggestions: ['Summarize open roles', 'Who is in interview stage?', 'Draft a job description']
  }
  if (pathname.startsWith('/tasks')) return {
    module: 'tasks', label: 'Tasks', description: 'Team task management and deadlines.',
    suggestions: ['What tasks are overdue?', 'Create a task breakdown', 'Summarize priorities']
  }
  if (pathname.startsWith('/channels')) return {
    module: 'channels', label: 'Channels', description: 'Team communication channels.',
    suggestions: ['Draft an announcement', 'Summarize team updates']
  }
  if (pathname.startsWith('/calendar')) return {
    module: 'calendar', label: 'Calendar', description: 'Meetings and scheduled events.',
    suggestions: ['What\'s on the agenda today?', 'Draft a meeting agenda']
  }
  if (pathname.startsWith('/dashboard')) return {
    module: 'dashboard', label: 'Dashboard', description: 'TeamBase operational overview.',
    suggestions: ['What should I focus on today?', 'Summarize team status', 'Help me prioritize']
  }
  return {
    module: 'unknown', label: 'TeamBase', description: 'Internal company operating system.',
    suggestions: ['What can Birdy help with?', 'Help me think through a problem']
  }
}
