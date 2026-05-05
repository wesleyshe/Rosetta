-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "shortcut_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "install_id" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_class" TEXT,
    "app_version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortcutStats" (
    "shortcut_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "reliability_score" DOUBLE PRECISION,
    "last_validated" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortcutStats_pkey" PRIMARY KEY ("shortcut_id","app_id","app_version","platform")
);

-- CreateTable
CREATE TABLE "Contributor" (
    "github_username" TEXT NOT NULL,
    "oauth_token_hash" TEXT,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("github_username")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "contributor_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "shortcut_id" TEXT NOT NULL,
    "pr_url" TEXT NOT NULL,
    "pr_commit_sha" TEXT,
    "reviewer_verdict" TEXT NOT NULL,
    "reviewer_reason" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_shortcut_id_app_version_platform_idx" ON "Execution"("shortcut_id", "app_version", "platform");

-- CreateIndex
CREATE INDEX "Execution_install_id_shortcut_id_created_at_idx" ON "Execution"("install_id", "shortcut_id", "created_at");

-- CreateIndex
CREATE INDEX "Submission_contributor_id_created_at_idx" ON "Submission"("contributor_id", "created_at");

