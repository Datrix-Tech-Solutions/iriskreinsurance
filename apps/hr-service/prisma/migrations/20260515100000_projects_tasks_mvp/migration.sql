CREATE TYPE "hr"."ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

CREATE TYPE "hr"."ProjectMemberRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');

CREATE TYPE "hr"."ProjectTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'ON_HOLD', 'DONE');

CREATE TYPE "hr"."ProjectTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "hr"."ProjectActivityType" AS ENUM (
    'PROJECT_CREATED',
    'PROJECT_UPDATED',
    'PROJECT_CANCELLED',
    'MEMBER_ADDED',
    'MEMBER_REMOVED',
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_STATUS_CHANGED',
    'TASK_ASSIGNED',
    'TASK_DELETED'
);

CREATE TABLE "hr"."Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "hr"."ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(15,2),
    "managerId" TEXT,
    "createdByUserId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr"."ProjectMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "hr"."ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr"."ProjectTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "hr"."ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "hr"."ProjectTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "assignedEmployeeId" TEXT,
    "createdByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr"."ProjectActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "actorUserId" TEXT,
    "actorEmployeeId" TEXT,
    "type" "hr"."ProjectActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_tenantId_status_idx" ON "hr"."Project"("tenantId", "status");
CREATE INDEX "Project_tenantId_managerId_idx" ON "hr"."Project"("tenantId", "managerId");
CREATE INDEX "Project_tenantId_createdAt_idx" ON "hr"."Project"("tenantId", "createdAt");

CREATE UNIQUE INDEX "ProjectMember_projectId_employeeId_key" ON "hr"."ProjectMember"("projectId", "employeeId");
CREATE INDEX "ProjectMember_tenantId_employeeId_idx" ON "hr"."ProjectMember"("tenantId", "employeeId");
CREATE INDEX "ProjectMember_tenantId_projectId_idx" ON "hr"."ProjectMember"("tenantId", "projectId");

CREATE INDEX "ProjectTask_tenantId_projectId_idx" ON "hr"."ProjectTask"("tenantId", "projectId");
CREATE INDEX "ProjectTask_tenantId_assignedEmployeeId_idx" ON "hr"."ProjectTask"("tenantId", "assignedEmployeeId");
CREATE INDEX "ProjectTask_tenantId_status_idx" ON "hr"."ProjectTask"("tenantId", "status");
CREATE INDEX "ProjectTask_tenantId_dueDate_idx" ON "hr"."ProjectTask"("tenantId", "dueDate");

CREATE INDEX "ProjectActivity_tenantId_projectId_createdAt_idx" ON "hr"."ProjectActivity"("tenantId", "projectId", "createdAt");
CREATE INDEX "ProjectActivity_tenantId_taskId_idx" ON "hr"."ProjectActivity"("tenantId", "taskId");

ALTER TABLE "hr"."Project"
ADD CONSTRAINT "Project_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "hr"."Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr"."ProjectMember"
ADD CONSTRAINT "ProjectMember_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."ProjectMember"
ADD CONSTRAINT "ProjectMember_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."ProjectTask"
ADD CONSTRAINT "ProjectTask_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."ProjectTask"
ADD CONSTRAINT "ProjectTask_assignedEmployeeId_fkey"
FOREIGN KEY ("assignedEmployeeId") REFERENCES "hr"."Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr"."ProjectActivity"
ADD CONSTRAINT "ProjectActivity_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."ProjectActivity"
ADD CONSTRAINT "ProjectActivity_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "hr"."ProjectTask"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
