-- Follow-up research; execution recorded separately. LIMIT is not a scan-cost cap.
-- Registered Ethereum identifiers only; this is not a network ranking.
WITH approved(coin_id, address) AS (
  SELECT column1, column2 FROM VALUES
    ('usdc', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    ('usdt', '0xdac17f958d2ee523a2206206994597c13d831ec7'),
    ('rlusd', '0x8292bb45bf1ee4d140127049757c2e0ff06317ed'),
    ('jpyc', '0xe7c3d8c9a439fede00d2600032d5db0be71c3c29'),
    ('jpysc', '0x6781d5631bfe47432b089e64e3eab3b6edd26177')
)
SELECT a.coin_id, v.activity_date, v.chain, v.token_address,
       TO_VARCHAR(v.transfer_volume) AS transfer_volume_str,
       TO_VARCHAR(v.transfer_volume_usd) AS transfer_volume_usd_str,
       TO_VARCHAR(v.transfer_count) AS transfer_count_str,
       TO_VARCHAR(v.transfer_tx_count) AS transfer_tx_count_str,
       v.has_adjusted_volume, TO_VARCHAR(v.adjusted_volume_usd) AS adjusted_volume_usd_str
FROM approved a
JOIN stablecoins.metrics.volume_daily v ON LOWER(v.token_address) = a.address
WHERE v.chain = 'ethereum' AND v.activity_date >= '2026-10-08'::DATE AND v.activity_date < '2026-10-23'::DATE
ORDER BY a.coin_id, v.activity_date DESC, v.token_address
LIMIT 75;
