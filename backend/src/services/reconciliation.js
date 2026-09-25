const db = require('../config/database');
const { getCampaignBalance } = require('./stellarService');
const logger = require('../config/logger');

async function reconcileCampaign(campaign) {
  try {
    const { rows: pendingRows } = await db.query(
      `SELECT id FROM withdrawal_requests WHERE campaign_id = $1 AND status = 'pending' LIMIT 1`,
      [campaign.id]
    );
    if (pendingRows.length > 0) {
      logger.info(`[reconcile] Skipping campaign ${campaign.id} due to pending withdrawal`);
      return { skipped: true, reason: 'pending_withdrawal' };
    }

    const onChain = await getCampaignBalance(campaign.wallet_public_key);
    const liveBalance = parseFloat(onChain[campaign.asset_type] || '0');
    const dbBalance = parseFloat(campaign.raised_amount);

    if (liveBalance > dbBalance + 0.0000001) {
      // The on-chain balance is higher than what we recorded — there are
      // contributions we haven't tracked yet (e.g. direct on-chain deposits).
      // Bring the DB up to the live value.
      logger.warn(`[reconcile] Campaign ${campaign.id}: DB=${dbBalance} < chain=${liveBalance}. Updating raised_amount upward.`);
      await db.query(
        `UPDATE campaigns SET raised_amount = $1 WHERE id = $2`,
        [liveBalance, campaign.id]
      );
      return { updated: true, dbBalance, liveBalance, direction: 'increased' };
    }

    if (liveBalance < dbBalance - 0.0000001) {
      // The on-chain balance is lower than raised_amount — this is expected
      // after withdrawals or refunds.  raised_amount is a cumulative total and
      // must NOT be rolled back; doing so would flip a funded campaign to
      // failed and corrupt contribution history.
      logger.warn(
        `[reconcile] Campaign ${campaign.id}: chain=${liveBalance} < DB=${dbBalance}. ` +
        `Balance drop is likely due to a withdrawal/refund — raised_amount preserved.`
      );
      return { updated: false, dbBalance, liveBalance, direction: 'skipped_decrease' };
    }

    return { updated: false, dbBalance, liveBalance };
  } catch (err) {
    logger.error(`[reconcile] Failed for campaign ${campaign.id}:`, { error: err.message });
    throw err;
  }
}

async function reconcileCampaignBalances() {
  const { rows } = await db.query(
    `SELECT id, wallet_public_key, asset_type, raised_amount FROM campaigns WHERE status IN ('active', 'funded')`
  );

  for (const campaign of rows) {
    try {
      await reconcileCampaign(campaign);
    } catch (err) {
      // Error is already logged inside reconcileCampaign
    }
  }
}

async function reconcileSingleCampaign(campaignId) {
  const { rows } = await db.query(
    `SELECT id, wallet_public_key, asset_type, raised_amount FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (!rows.length) {
    throw new Error('Campaign not found');
  }
  return await reconcileCampaign(rows[0]);
}

module.exports = {
  reconcileCampaignBalances,
  reconcileSingleCampaign,
};
