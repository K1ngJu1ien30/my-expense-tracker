-- ============================================================================
-- MIGRATION 005: WanderPlan Decommissioning & Dead Tables Cleanup
-- Universal Expense Tracker
-- ============================================================================

-- 1. DROP ALL WANDERPLAN TABLES
DROP TABLE IF EXISTS wp_packing_lists CASCADE;
DROP TABLE IF EXISTS wp_documents CASCADE;
DROP TABLE IF EXISTS wp_saved_places CASCADE;
DROP TABLE IF EXISTS wp_trip_expenses CASCADE;
DROP TABLE IF EXISTS wp_budget_allocations CASCADE;
DROP TABLE IF EXISTS wp_activities CASCADE;
DROP TABLE IF EXISTS wp_trip_days CASCADE;
DROP TABLE IF EXISTS wp_trips CASCADE;
