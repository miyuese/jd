import "server-only";

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { ProjectFormValues } from "@/lib/project-form";

type UserScopedProject = {
  id: string;
  clerkUserId: string;
  name: string;
  targetRole: string;
  currentNeed: string;
  status: string;
  createdAt: string | Date;
};

function sanitizeConnectionUrl(value: string | undefined) {
  if (!value) {
    return value;
  }

  return value
    .replace(/([?&])channel_binding=require(&?)/g, (_match, prefix: string, suffix: string) => {
      if (prefix === "?" && suffix) {
        return "?";
      }

      if (!suffix) {
        return "";
      }

      return prefix;
    })
    .replace(/[?&]$/, "");
}

type WorkspaceProjectRow = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
  status: string;
  createdAt: string | Date;
};

function mapProjectRow(row: UserScopedProject | WorkspaceProjectRow) {
  return {
    id: row.id,
    name: row.name,
    targetRole: row.targetRole,
    currentNeed: row.currentNeed,
    status: row.status,
    createdAt: new Date(row.createdAt)
  };
}

function getSql() {
  const connectionString = sanitizeConnectionUrl(process.env.DATABASE_URL);

  if (!connectionString) {
    throw new Error("缺少 DATABASE_URL，无法连接 Neon 数据库。");
  }

  return neon(connectionString);
}

export async function listWorkspaceProjects(clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "name",
        "targetRole",
        "currentNeed",
        "status",
        "createdAt"
      FROM "Project"
      WHERE "clerkUserId" = $1
      ORDER BY "createdAt" DESC
    `,
    [clerkUserId]
  )) as WorkspaceProjectRow[];

  return rows.map(mapProjectRow);
}

export async function getWorkspaceProjectById(projectId: string, clerkUserId: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        "id",
        "clerkUserId",
        "name",
        "targetRole",
        "currentNeed",
        "status",
        "createdAt"
      FROM "Project"
      WHERE "id" = $1 AND "clerkUserId" = $2
      LIMIT 1
    `,
    [projectId, clerkUserId]
  )) as UserScopedProject[];

  const project = rows[0];

  return project ? mapProjectRow(project) : null;
}

export async function insertWorkspaceProject(clerkUserId: string, values: ProjectFormValues) {
  const sql = getSql();
  const rows = (await sql.query(
    `
      INSERT INTO "Project" (
        "id",
        "clerkUserId",
        "name",
        "targetRole",
        "currentNeed",
        "status",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, 'DRAFT', NOW(), NOW())
      RETURNING "id", "name", "targetRole", "currentNeed", "createdAt"
    `,
    [randomUUID(), clerkUserId, values.projectName, values.targetRole, values.currentNeed]
  )) as Array<{
    id: string;
    name: string;
    targetRole: string;
    currentNeed: string;
    createdAt: string | Date;
  }>;

  const project = rows[0];

  return {
    id: project.id,
    projectName: project.name,
    targetRole: project.targetRole,
    currentNeed: project.currentNeed,
    createdAt: new Date(project.createdAt).toISOString()
  };
}
