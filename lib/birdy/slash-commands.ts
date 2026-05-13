/**
 * lib/birdy/slash-commands.ts
 * Slash command registry — displayed when user types "/" in the chat input.
 */

export interface SlashCommand {
  command:     string        // without the slash
  label:       string        // display name
  description: string
  template:    string        // injected into the textarea on select
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command:     'summarize',
    label:       'Summarize',
    description: 'Summarize the current context',
    template:    'Summarize the current state of our hiring pipeline in bullet points. Focus on what\'s most important for the team to know today.',
  },
  {
    command:     'analyze',
    label:       'Analyze',
    description: 'Analyze data or a situation',
    template:    'Analyze ',
  },
  {
    command:     'draft',
    label:       'Draft',
    description: 'Draft a document, email, or message',
    template:    'Draft a professional ',
  },
  {
    command:     'search',
    label:       'Search',
    description: 'Search the knowledge base',
    template:    'Search for information about ',
  },
  {
    command:     'explain',
    label:       'Explain',
    description: 'Explain a concept or process',
    template:    'Explain in simple terms: ',
  },
  {
    command:     'compare',
    label:       'Compare',
    description: 'Compare two or more options',
    template:    'Compare and contrast: ',
  },
  {
    command:     'plan',
    label:       'Plan',
    description: 'Create an action plan',
    template:    'Create a step-by-step plan for: ',
  },
  {
    command:     'help',
    label:       'Help',
    description: 'What can Birdy do?',
    template:    'What are all the things you can help me with in PeopleBook?',
  },
]

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().replace(/^\//, '')
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    c => c.command.startsWith(q) || c.label.toLowerCase().startsWith(q)
  )
}
