-- migrations/005_anchor_real_fabric_tx.sql
-- Migration: Anchor real Fabric transaction for allocation e2fa29c2-8f17-411f-8245-ac12dbd23172
-- Replaces previous synthetic 'fab_tx_' identifier with verified 64-character Hyperledger Fabric transaction ID

UPDATE allocations 
SET status = 'FABRIC_CONFIRMED', 
    fabric_tx_id = '6c3a49f405d8fb24c01280da0178b39588f3afb239888c68c5871beb2439c49f'
WHERE id = 'e2fa29c2-8f17-411f-8245-ac12dbd23172';

UPDATE blockchain_transactions
SET fabric_tx_id = '6c3a49f405d8fb24c01280da0178b39588f3afb239888c68c5871beb2439c49f', 
    payload_hash = 'f5badb14fb1e746b3be26fa360c04461cf31eb8efabdd8294e63f7c4cc68e0ab', 
    status = 'CONFIRMED', 
    confirmed_at = NOW()
WHERE record_id = 'e2fa29c2-8f17-411f-8245-ac12dbd23172';
