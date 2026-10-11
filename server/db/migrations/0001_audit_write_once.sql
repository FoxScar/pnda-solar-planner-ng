-- PRD §21.2 / §20.3: calculation traces and the admin audit log are immutable.
-- Any UPDATE or DELETE on these tables is rejected at the database level.
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is write-once: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER quote_calc_audit_write_once
  BEFORE UPDATE OR DELETE ON quote_calc_audit
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_write_once
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
--> statement-breakpoint
-- TRUNCATE bypasses row triggers, so block it with a statement trigger too.
CREATE TRIGGER quote_calc_audit_no_truncate
  BEFORE TRUNCATE ON quote_calc_audit
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
