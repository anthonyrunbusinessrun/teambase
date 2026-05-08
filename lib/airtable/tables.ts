// ── Table names ───────────────────────────────────────────────────────────
// Update these to match your actual Airtable table names

export const TABLES = {
  EMPLOYEES: "Employees",
  PROJECTS: "Projects",
  CLIENTS: "Clients",
  TASKS: "Tasks",
} as const;

// ── Employee field mappings ────────────────────────────────────────────────

export const EMPLOYEE_FIELDS = {
  NAME: "Name",
  EMAIL: "Email",
  ROLE: "Role",
  DEPARTMENT: "Department",
  TIMEZONE: "Timezone",
  AVATAR: "Avatar",
  START_DATE: "Start Date",
  STATUS: "Status",
} as const;

// ── Project field mappings ────────────────────────────────────────────────

export const PROJECT_FIELDS = {
  NAME: "Name",
  CLIENT: "Client",
  STATUS: "Status",
  START_DATE: "Start Date",
  END_DATE: "End Date",
  ASSIGNED_TO: "Assigned To",
  DESCRIPTION: "Description",
} as const;

// ── Typed Airtable field shapes ───────────────────────────────────────────

export interface AirtableEmployee {
  [key: string]: unknown;
  Name: string;
  Email?: string;
  Role?: string;
  Department?: string;
  Timezone?: string;
  Avatar?: Array<{ url: string; thumbnails?: { small?: { url: string } } }>;
  "Start Date"?: string;
  Status?: string;
}

export interface AirtableProject {
  [key: string]: unknown;
  Name: string;
  Client?: string[];
  Status?: string;
  "Start Date"?: string;
  "End Date"?: string;
  "Assigned To"?: string[];
  Description?: string;
}

// ── BOSS Base ─────────────────────────────────────────────────────────────

export const BOSS_TABLES = {
  FOLIOS: "Folios",
  EMPLOYEES: "Employees",
} as const;

export interface AirtableFolio {
  [key: string]: unknown;
  Name?: string;
  "Client Name"?: string;
  Client?: string;
  Status?: string;
  "Start Date"?: string;
  "End Date"?: string;
  "Project Manager"?: string;
  Manager?: string[];
  Budget?: number;
  "Total Budget"?: number;
  Value?: number;
  Description?: string;
  Notes?: string;
  Tags?: string[];
  Priority?: string;
  Type?: string;
  "Folio Type"?: string;
  "Contract Value"?: number;
  "Hours Budgeted"?: number;
  "Hours Logged"?: number;
  "Percent Complete"?: number;
  "% Complete"?: number;
  Team?: string[];
  Assignees?: string[];
}
