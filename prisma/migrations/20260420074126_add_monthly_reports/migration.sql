-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('IT_SKILL', 'BUSINESS_SKILL');

-- CreateEnum
CREATE TYPE "EvaluationAxis" AS ENUM ('SELF_GROWTH', 'SYNERGY');

-- CreateEnum
CREATE TYPE "EvaluationScoreType" AS ENUM ('LEVEL_2', 'CONTINUOUS_DONE');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('HALF_YEAR', 'YEAR');

-- CreateEnum
CREATE TYPE "EvaluationPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('SELF_REVIEW', 'MANAGER_REVIEW', 'FINAL_REVIEW', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('SELF', 'MANAGER', 'FINAL');

-- CreateEnum
CREATE TYPE "AssignmentTargetType" AS ENUM ('EMPLOYEE', 'PARTNER');

-- CreateEnum
CREATE TYPE "CostTargetType" AS ENUM ('EMPLOYEE', 'PARTNER', 'TEAM');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('SALARY', 'SOCIAL_INSURANCE', 'OUTSOURCING', 'INDIRECT_COST', 'FIXED_COST_ALLOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "FixedCostAllocationMethod" AS ENUM ('HEADCOUNT', 'SALES_RATIO', 'EQUAL');

-- CreateEnum
CREATE TYPE "SalarySimulationStatus" AS ENUM ('DRAFT', 'APPROVED', 'APPLIED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "department_id" TEXT,
    "position_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "department_id" TEXT,
    "name" TEXT NOT NULL,
    "leader_user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_grade_definitions" (
    "id" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "grade_code" TEXT NOT NULL,
    "grade_name" TEXT NOT NULL,
    "rank_order" INTEGER NOT NULL,
    "description" TEXT,
    "min_score" DECIMAL(4,2),
    "max_score" DECIMAL(4,2),
    "position_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_grade_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL DEFAULT 'HALF_YEAR',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "EvaluationPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_items" (
    "id" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "axis" "EvaluationAxis" NOT NULL DEFAULT 'SELF_GROWTH',
    "score_type" "EvaluationScoreType" NOT NULL DEFAULT 'LEVEL_2',
    "major_category" TEXT NOT NULL DEFAULT '',
    "minor_category" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "grade_definition_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_evaluations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "evaluation_period_id" TEXT NOT NULL,
    "team_id" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'SELF_REVIEW',
    "self_comment" TEXT,
    "manager_comment" TEXT,
    "final_comment" TEXT,
    "self_score_total" DECIMAL(5,2),
    "manager_score_total" DECIMAL(5,2),
    "final_score_total" DECIMAL(5,2),
    "it_skill_grade_id" TEXT,
    "business_skill_grade_id" TEXT,
    "final_rating" TEXT,
    "finalized_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_scores" (
    "id" TEXT NOT NULL,
    "employee_evaluation_id" TEXT NOT NULL,
    "evaluation_item_id" TEXT NOT NULL,
    "review_type" "ReviewType" NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_score_evidences" (
    "id" TEXT NOT NULL,
    "evaluation_score_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "target_name" TEXT,
    "period_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_score_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "social_insurance" INTEGER NOT NULL DEFAULT 0,
    "other_fixed_cost" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_revision_rules" (
    "id" TEXT NOT NULL,
    "evaluation_period_id" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "min_raise" DECIMAL(5,2) NOT NULL,
    "max_raise" DECIMAL(5,2) NOT NULL,
    "default_raise" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_revision_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_revision_simulations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "evaluation_period_id" TEXT NOT NULL,
    "employee_evaluation_id" TEXT,
    "current_salary" INTEGER NOT NULL,
    "proposed_raise_amount" INTEGER NOT NULL,
    "proposed_raise_rate" DECIMAL(5,2) NOT NULL,
    "new_salary" INTEGER NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" "SalarySimulationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_revision_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_assignments" (
    "id" TEXT NOT NULL,
    "target_type" "AssignmentTargetType" NOT NULL,
    "user_id" TEXT,
    "partner_id" TEXT,
    "team_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "sales_amount" INTEGER NOT NULL,
    "work_rate" INTEGER NOT NULL DEFAULT 100,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_unassigned_monthly_assignments" (
    "id" TEXT NOT NULL,
    "target_type" "AssignmentTargetType" NOT NULL,
    "user_id" TEXT,
    "partner_id" TEXT,
    "department_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "sales_amount" INTEGER NOT NULL,
    "outsourcing_cost" INTEGER NOT NULL DEFAULT 0,
    "work_rate" INTEGER NOT NULL DEFAULT 100,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_unassigned_monthly_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_costs" (
    "id" TEXT NOT NULL,
    "target_type" "CostTargetType" NOT NULL,
    "user_id" TEXT,
    "partner_id" TEXT,
    "team_id" TEXT,
    "year_month" TEXT NOT NULL,
    "cost_category" "CostCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_monthly_pls" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "sales_total" INTEGER NOT NULL,
    "direct_labor_cost" INTEGER NOT NULL,
    "outsourcing_cost" INTEGER NOT NULL,
    "gross_profit_1" INTEGER NOT NULL,
    "indirect_cost" INTEGER NOT NULL,
    "gross_profit_2" INTEGER NOT NULL,
    "fixed_cost_allocation" INTEGER NOT NULL,
    "final_gross_profit" INTEGER NOT NULL,
    "target_gross_profit_rate" DECIMAL(5,2) NOT NULL,
    "actual_gross_profit_rate" DECIMAL(5,2) NOT NULL,
    "variance_amount" INTEGER NOT NULL,
    "variance_rate" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_monthly_pls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_indirect_costs" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_indirect_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_cost_settings" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "end_year_month" TEXT,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "allocation_method" "FixedCostAllocationMethod" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_cost_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_fixed_cost_allocations" (
    "id" TEXT NOT NULL,
    "fixed_cost_setting_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_fixed_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_monthly_other_costs" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_monthly_other_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_cost_allocations" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "fixed_cost_setting_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "allocated_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_targets" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "sales_target" INTEGER NOT NULL,
    "gross_profit_target" INTEGER NOT NULL,
    "gross_profit_rate_target" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_logs" (
    "id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "acted_by" TEXT NOT NULL,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_sales_rate_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "default_work_rate" INTEGER NOT NULL DEFAULT 100,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_sales_rate_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_sales_rate_settings" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "default_work_rate" INTEGER NOT NULL DEFAULT 100,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_sales_rate_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_outsource_rate_settings" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_outsource_rate_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_report_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "team_id" TEXT,
    "team_name_snapshot" TEXT NOT NULL DEFAULT '個人',
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_report_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_monthly_reports" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "project_summary" TEXT NOT NULL DEFAULT '',
    "team_self_growth_issue" TEXT NOT NULL DEFAULT '',
    "team_self_growth_result" TEXT NOT NULL DEFAULT '',
    "team_synergy_issue" TEXT NOT NULL DEFAULT '',
    "team_synergy_result" TEXT NOT NULL DEFAULT '',
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_monthly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_monthly_reports" (
    "id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "team_name_snapshot" TEXT NOT NULL DEFAULT '個人',
    "user_role_code" TEXT NOT NULL DEFAULT 'employee',
    "member_type" TEXT NOT NULL DEFAULT 'member',
    "project_role" TEXT NOT NULL DEFAULT '',
    "personal_self_growth_issue" TEXT NOT NULL DEFAULT '',
    "personal_self_growth_result" TEXT NOT NULL DEFAULT '',
    "personal_synergy_issue" TEXT NOT NULL DEFAULT '',
    "personal_synergy_result" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_monthly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_team_id_user_id_start_date_key" ON "team_memberships"("team_id", "user_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "skill_grade_definitions_category_grade_code_position_id_key" ON "skill_grade_definitions"("category", "grade_code", "position_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_evaluations_user_id_evaluation_period_id_key" ON "employee_evaluations"("user_id", "evaluation_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_scores_employee_evaluation_id_evaluation_item_id_key" ON "evaluation_scores"("employee_evaluation_id", "evaluation_item_id", "review_type");

-- CreateIndex
CREATE UNIQUE INDEX "salary_records_user_id_effective_from_key" ON "salary_records"("user_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "salary_revision_rules_evaluation_period_id_rating_key" ON "salary_revision_rules"("evaluation_period_id", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "salary_revision_simulations_user_id_evaluation_period_id_key" ON "salary_revision_simulations"("user_id", "evaluation_period_id");

-- CreateIndex
CREATE INDEX "department_unassigned_monthly_assignments_department_id_yea_idx" ON "department_unassigned_monthly_assignments"("department_id", "year_month");

-- CreateIndex
CREATE INDEX "department_unassigned_monthly_assignments_user_id_year_mont_idx" ON "department_unassigned_monthly_assignments"("user_id", "year_month");

-- CreateIndex
CREATE INDEX "department_unassigned_monthly_assignments_partner_id_year_m_idx" ON "department_unassigned_monthly_assignments"("partner_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "team_monthly_pls_team_id_year_month_key" ON "team_monthly_pls"("team_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "department_fixed_cost_allocations_fixed_cost_setting_id_dep_key" ON "department_fixed_cost_allocations"("fixed_cost_setting_id", "department_id");

-- CreateIndex
CREATE INDEX "department_monthly_other_costs_department_id_year_month_idx" ON "department_monthly_other_costs"("department_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "employee_sales_rate_settings_user_id_effective_from_key" ON "employee_sales_rate_settings"("user_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "partner_sales_rate_settings_partner_id_effective_from_key" ON "partner_sales_rate_settings"("partner_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "partner_outsource_rate_settings_partner_id_effective_from_key" ON "partner_outsource_rate_settings"("partner_id", "effective_from");

-- CreateIndex
CREATE INDEX "monthly_report_projects_team_id_is_active_idx" ON "monthly_report_projects"("team_id", "is_active");

-- CreateIndex
CREATE INDEX "monthly_report_projects_normalized_name_idx" ON "monthly_report_projects"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_report_projects_normalized_name_team_id_key" ON "monthly_report_projects"("normalized_name", "team_id");

-- CreateIndex
CREATE INDEX "team_monthly_reports_team_id_year_month_idx" ON "team_monthly_reports"("team_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "team_monthly_reports_year_month_project_id_team_id_key" ON "team_monthly_reports"("year_month", "project_id", "team_id");

-- CreateIndex
CREATE INDEX "personal_monthly_reports_user_id_year_month_idx" ON "personal_monthly_reports"("user_id", "year_month");

-- CreateIndex
CREATE INDEX "personal_monthly_reports_team_id_year_month_idx" ON "personal_monthly_reports"("team_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "personal_monthly_reports_year_month_project_id_user_id_key" ON "personal_monthly_reports"("year_month", "project_id", "user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_grade_definitions" ADD CONSTRAINT "skill_grade_definitions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_items" ADD CONSTRAINT "evaluation_items_grade_definition_id_fkey" FOREIGN KEY ("grade_definition_id") REFERENCES "skill_grade_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_evaluation_period_id_fkey" FOREIGN KEY ("evaluation_period_id") REFERENCES "evaluation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_it_skill_grade_id_fkey" FOREIGN KEY ("it_skill_grade_id") REFERENCES "skill_grade_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_business_skill_grade_id_fkey" FOREIGN KEY ("business_skill_grade_id") REFERENCES "skill_grade_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_employee_evaluation_id_fkey" FOREIGN KEY ("employee_evaluation_id") REFERENCES "employee_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_item_id_fkey" FOREIGN KEY ("evaluation_item_id") REFERENCES "evaluation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_score_evidences" ADD CONSTRAINT "evaluation_score_evidences_evaluation_score_id_fkey" FOREIGN KEY ("evaluation_score_id") REFERENCES "evaluation_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revision_rules" ADD CONSTRAINT "salary_revision_rules_evaluation_period_id_fkey" FOREIGN KEY ("evaluation_period_id") REFERENCES "evaluation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revision_simulations" ADD CONSTRAINT "salary_revision_simulations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revision_simulations" ADD CONSTRAINT "salary_revision_simulations_evaluation_period_id_fkey" FOREIGN KEY ("evaluation_period_id") REFERENCES "evaluation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revision_simulations" ADD CONSTRAINT "salary_revision_simulations_employee_evaluation_id_fkey" FOREIGN KEY ("employee_evaluation_id") REFERENCES "employee_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revision_simulations" ADD CONSTRAINT "salary_revision_simulations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_assignments" ADD CONSTRAINT "monthly_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_assignments" ADD CONSTRAINT "monthly_assignments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_assignments" ADD CONSTRAINT "monthly_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_unassigned_monthly_assignments" ADD CONSTRAINT "department_unassigned_monthly_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_unassigned_monthly_assignments" ADD CONSTRAINT "department_unassigned_monthly_assignments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_unassigned_monthly_assignments" ADD CONSTRAINT "department_unassigned_monthly_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_costs" ADD CONSTRAINT "monthly_costs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_costs" ADD CONSTRAINT "monthly_costs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_costs" ADD CONSTRAINT "monthly_costs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_monthly_pls" ADD CONSTRAINT "team_monthly_pls_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_indirect_costs" ADD CONSTRAINT "team_indirect_costs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_fixed_cost_allocations" ADD CONSTRAINT "department_fixed_cost_allocations_fixed_cost_setting_id_fkey" FOREIGN KEY ("fixed_cost_setting_id") REFERENCES "fixed_cost_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_fixed_cost_allocations" ADD CONSTRAINT "department_fixed_cost_allocations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_monthly_other_costs" ADD CONSTRAINT "department_monthly_other_costs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_cost_allocations" ADD CONSTRAINT "fixed_cost_allocations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_cost_allocations" ADD CONSTRAINT "fixed_cost_allocations_fixed_cost_setting_id_fkey" FOREIGN KEY ("fixed_cost_setting_id") REFERENCES "fixed_cost_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_targets" ADD CONSTRAINT "team_targets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_acted_by_fkey" FOREIGN KEY ("acted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_sales_rate_settings" ADD CONSTRAINT "employee_sales_rate_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_sales_rate_settings" ADD CONSTRAINT "partner_sales_rate_settings_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_outsource_rate_settings" ADD CONSTRAINT "partner_outsource_rate_settings_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_report_projects" ADD CONSTRAINT "monthly_report_projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_monthly_reports" ADD CONSTRAINT "team_monthly_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monthly_report_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_monthly_reports" ADD CONSTRAINT "team_monthly_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_monthly_reports" ADD CONSTRAINT "personal_monthly_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monthly_report_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_monthly_reports" ADD CONSTRAINT "personal_monthly_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_monthly_reports" ADD CONSTRAINT "personal_monthly_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
