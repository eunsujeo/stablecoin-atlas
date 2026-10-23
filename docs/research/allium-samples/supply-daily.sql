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
SELECT a.coin_id, s.date, s.chain, s.token_address, s.is_native,
       TO_VARCHAR(s.total_supply) AS total_supply_str,
       TO_VARCHAR(s.circulating_supply) AS circulating_supply_str,
       TO_VARCHAR(s.adjusted_circulating_supply) AS adjusted_circulating_supply_str,
       s._metadata
FROM approved a
JOIN stablecoins.core.supply_daily s ON LOWER(s.token_address) = a.address
WHERE s.chain = 'ethereum' AND s.date = '2026-10-22'::DATE
ORDER BY a.coin_id, s.token_address
LIMIT 10;
