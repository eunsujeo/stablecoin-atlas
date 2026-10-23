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
SELECT a.coin_id, d.chain, d.address, d.product_id, d.product_symbol,
       d.is_native, d.is_verified, d.decimals, d.currency, d.status
FROM approved a
JOIN stablecoins.registry.deployments d ON LOWER(d.address) = a.address
WHERE d.chain = 'ethereum'
ORDER BY a.coin_id, d.address
LIMIT 10;
