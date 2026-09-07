-- Migration: Anchor real Fabric transaction on organ-donation-channel with organ-contract
-- Allocation ID: e2fa29c2-8f17-411f-8245-ac12dbd23172
-- Channel: organ-donation-channel
-- Chaincode: organ-contract
-- Real Fabric TX ID: 26e06a7a8ee3084ece4989ab5a31f3d97fda5c97aeb78257f2614fdd7bc298b5

UPDATE allocations 
SET status = 'FABRIC_CONFIRMED', 
    fabric_tx_id = '26e06a7a8ee3084ece4989ab5a31f3d97fda5c97aeb78257f2614fdd7bc298b5'
WHERE id = 'e2fa29c2-8f17-411f-8245-ac12dbd23172';

UPDATE blockchain_transactions
SET fabric_tx_id = '26e06a7a8ee3084ece4989ab5a31f3d97fda5c97aeb78257f2614fdd7bc298b5',
    payload_hash = 'f5badb14fb1e746b3be26fa360c04461cf31eb8efabdd8294e63f7c4cc68e0ab',
    channel = 'organ-donation-channel',
    chaincode = 'organ-contract',
    status = 'CONFIRMED',
    confirmed_at = NOW()
WHERE record_id = 'e2fa29c2-8f17-411f-8245-ac12dbd23172';
