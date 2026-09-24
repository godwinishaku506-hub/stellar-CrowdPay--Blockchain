-- 20260925: Restore 'suspended' in the campaigns status CHECK constraint.
--
-- 20260602_campaign_refund_mechanism.sql recreated campaigns_status_check
-- (adding 'refunded') but dropped 'suspended', so the admin suspension
-- endpoint (admin.js PATCH /campaigns/:id/suspend) fails on every call
-- with a CHECK constraint violation.
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('active', 'funded', 'in_progress', 'completed', 'closed', 'withdrawn', 'failed', 'suspended', 'refunded'));