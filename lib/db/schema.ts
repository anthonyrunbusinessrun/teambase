import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "member", "viewer"]);

export const presenceStatusEnum = pgEnum("presence_status", [
  "online",
  "away",
  "offline",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "success",
  "failed",
]);

// ── Users ─────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("full_name").notNull().default(""),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").notNull().default("member"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    airtableEmployeeId: text("airtable_employee_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    airtableIdx: index("users_airtable_idx").on(t.airtableEmployeeId),
  })
);

// ── Sessions (Better Auth) ────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
    tokenIdx: index("sessions_token_idx").on(t.token),
  })
);

// ── Accounts (Better Auth OAuth) ─────────────────────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("accounts_user_id_idx").on(t.userId),
    providerIdx: index("accounts_provider_idx").on(t.providerId, t.accountId),
  })
);

// ── Verifications (Better Auth magic link) ───────────────────────────────

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    identifierIdx: index("verifications_identifier_idx").on(t.identifier),
  })
);

// ── Presence ──────────────────────────────────────────────────────────────

export const presence = pgTable(
  "presence",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    status: presenceStatusEnum("status").notNull().default("offline"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("presence_status_idx").on(t.status),
    lastSeenIdx: index("presence_last_seen_idx").on(t.lastSeenAt),
  })
);

// ── Tasks ─────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assignedTo: text("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    airtableRecordId: text("airtable_record_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assignedToIdx: index("tasks_assigned_to_idx").on(t.assignedTo),
    createdByIdx: index("tasks_created_by_idx").on(t.createdBy),
    statusIdx: index("tasks_status_idx").on(t.status),
    dueDateIdx: index("tasks_due_date_idx").on(t.dueDate),
  })
);

// ── Task Comments ─────────────────────────────────────────────────────────

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdIdx: index("task_comments_task_id_idx").on(t.taskId),
  })
);

// ── Airtable Sync Logs ────────────────────────────────────────────────────

export const airtableSyncLogs = pgTable(
  "airtable_sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syncType: text("sync_type").notNull(),
    status: syncStatusEnum("status").notNull().default("running"),
    recordsProcessed: text("records_processed"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (t) => ({
    syncTypeIdx: index("airtable_sync_logs_type_idx").on(t.syncType),
    startedAtIdx: index("airtable_sync_logs_started_idx").on(t.startedAt),
  })
);

// ── Relations ─────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  presence: one(presence, { fields: [users.id], references: [presence.userId] }),
  sessions: many(sessions),
  accounts: many(accounts),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  comments: many(taskComments),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  author: one(users, { fields: [taskComments.authorId], references: [users.id] }),
}));

export const presenceRelations = relations(presence, ({ one }) => ({
  user: one(users, { fields: [presence.userId], references: [users.id] }),
}));

// ── Type exports ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Presence = typeof presence.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type NewTaskComment = typeof taskComments.$inferInsert;

// ── User Profiles (extended) ──────────────────────────────────────────────

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    positionTitle: text("position_title"),
    bio: text("bio"),
    phone: text("phone"),
    location: text("location"),
    avatarUrl: text("avatar_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// ── Cached Airtable Folios ────────────────────────────────────────────────

export const airtableFolios = pgTable(
  "airtable_folios",
  {
    id: text("id").primaryKey(), // Airtable record ID
    baseId: text("base_id").notNull(),
    tableId: text("table_id").notNull(),
    name: text("name"),
    client: text("client"),
    status: text("status"),
    category: text("category"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    manager: text("manager"),
    contractValue: text("contract_value"),
    percentComplete: text("percent_complete"),
    type: text("type"),
    priority: text("priority"),
    description: text("description"),
    tags: text("tags"),         // JSON array stored as text
    rawFields: text("raw_fields"), // Full JSON of all fields
    airtableCreatedAt: text("airtable_created_at"),
    synced_at: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    locallyModified: boolean("locally_modified").notNull().default(false),
    pendingDelete: boolean("pending_delete").notNull().default(false),
  },
  (t) => ({
    statusIdx: index("airtable_folios_status_idx").on(t.status),
    categoryIdx: index("airtable_folios_category_idx").on(t.category),
    clientIdx: index("airtable_folios_client_idx").on(t.client),
  })
);

// ── Generic Airtable table cache ──────────────────────────────────────────

export const airtableCache = pgTable(
  "airtable_cache",
  {
    id: text("id").primaryKey(), // baseId:tableId:recordId
    baseId: text("base_id").notNull(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    fields: text("fields").notNull(), // Full JSON
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    baseTableIdx: index("airtable_cache_base_table_idx").on(t.baseId, t.tableName),
  })
);

// ── Type exports (extended) ───────────────────────────────────────────────

export type UserProfile = typeof userProfiles.$inferSelect;
export type AirtableFolioRow = typeof airtableFolios.$inferSelect;

// ── App Settings (key/value store for API keys etc) ───────────────────────
export const appSettings = pgTable("app_settings", {
  key:       text("key").primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
