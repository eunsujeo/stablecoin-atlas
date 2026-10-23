-- Research sample executed once; see observations.json. LIMIT bounds output rows, not scan cost.
-- Registered Ethereum identifiers only; this is not a network ranking.
WITH approved(coin_id, address) AS (
  SELECT column1, column2 FROM VALUES
    ('usdc', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    ('usdt', '0xdac17f958d2ee523a2206206994597c13d831ec7'),
    ('rlusd', '0x8292bb45bf1ee4d140127049757c2e0ff06317ed'),
    ('jpyc', '0xe7c3d8c9a439fede00d2600032d5db0be71c3c29'),
    ('jpysc', '0x6781d5631bfe47432b089e64e3eab3b6edd26177')
)
SELECT a.coin_id, s.chain, s.token_address, s.block_timestamp, s.unique_id,
       s.is_mint, s.is_burn, s.raw_amount_str, s.amount_str
FROM approved a
JOIN stablecoins.core.supply_change s ON LOWER(s.token_address) = a.address
WHERE s.chain = 'ethereum'
  AND s.block_timestamp >= '2026-10-22'::TIMESTAMP_NTZ
  AND s.block_timestamp < '2026-10-23'::TIMESTAMP_NTZ
QUALIFY ROW_NUMBER() OVER (PARTITION BY a.coin_id ORDER BY s.block_timestamp, s.unique_id) <= 2
ORDER BY a.coin_id, s.block_timestamp, s.unique_id
LIMIT 10;
