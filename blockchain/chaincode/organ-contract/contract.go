package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// OrganDonationContract defines the Smart Contract structure
type OrganDonationContract struct {
	contractapi.Contract
}

// AssetHash maps a cryptographic snapshot of a record state anchored on the blockchain
type AssetHash struct {
	RecordID     string `json:"record_id"`
	EntityType   string `json:"entity_type"`
	StateHash    string `json:"state_hash"`
	ActorID      string `json:"actor_id"`
	Organization string `json:"organization"`
	Timestamp    int64  `json:"timestamp"`
	Action       string `json:"action"` // "CREATE", "UPDATE", "APPROVE", "REJECT", "DELETE"
}

// AccessLog registers unauthorized threats and access violations directly on-chain
type AccessLog struct {
	EventID       string `json:"event_id"`
	ActorID       string `json:"actor_id"`
	Operation     string `json:"operation"`
	TamperingType string `json:"tampering_type"`
	Source        string `json:"source"`
	Timestamp     int64  `json:"timestamp"`
	Reason        string `json:"reason"`
}

// RegisterAssetHash anchors a record's SHA-256 state hash on the ledger
func (c *OrganDonationContract) RegisterAssetHash(
	ctx contractapi.TransactionContextInterface,
	recordId string,
	entityType string,
	stateHash string,
	actorId string,
	organization string,
	action string,
) error {
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to read transaction timestamp: %v", err)
	}
	timestamp := txTimestamp.Seconds

	asset := AssetHash{
		RecordID:     recordId,
		EntityType:   entityType,
		StateHash:    stateHash,
		ActorID:      actorId,
		Organization: organization,
		Timestamp:    timestamp,
		Action:       action,
	}

	assetBytes, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(recordId, assetBytes)
}

// GetAsset reads the latest ledger state for a record ID
func (c *OrganDonationContract) GetAsset(
	ctx contractapi.TransactionContextInterface,
	recordId string,
) (*AssetHash, error) {
	assetBytes, err := ctx.GetStub().GetState(recordId)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if assetBytes == nil {
		return nil, fmt.Errorf("the asset %s does not exist on-chain", recordId)
	}

	var asset AssetHash
	err = json.Unmarshal(assetBytes, &asset)
	if err != nil {
		return nil, err
	}

	return &asset, nil
}

// VerifyRecordHash returns Boolean checking if active hash matches ledger hash anchor
func (c *OrganDonationContract) VerifyRecordHash(
	ctx contractapi.TransactionContextInterface,
	recordId string,
	currentHash string,
) (bool, error) {
	asset, err := c.GetAsset(ctx, recordId)
	if err != nil {
		return false, err
	}
	return asset.StateHash == currentHash, nil
}

// RecordAccessAttempt anchors security alert threats on the blockchain
func (c *OrganDonationContract) RecordAccessAttempt(
	ctx contractapi.TransactionContextInterface,
	eventId string,
	actorId string,
	operation string,
	tamperingType string,
	source string,
	reason string,
) error {
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("failed to read transaction timestamp: %v", err)
	}
	timestamp := txTimestamp.Seconds

	log := AccessLog{
		EventID:       eventId,
		ActorID:       actorId,
		Operation:     operation,
		TamperingType: tamperingType,
		Source:        source,
		Timestamp:     timestamp,
		Reason:        reason,
	}

	logBytes, err := json.Marshal(log)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(eventId, logBytes)
}

// GetAssetHistory returns the full chronological transition history of a record
func (c *OrganDonationContract) GetAssetHistory(
	ctx contractapi.TransactionContextInterface,
	recordId string,
) ([]AssetHash, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(recordId)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var history []AssetHash
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var asset AssetHash
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &asset)
			if err != nil {
				return nil, err
			}
		} else {
			asset = AssetHash{
				RecordID:  recordId,
				Timestamp: response.Timestamp.Seconds,
				Action:    "DELETE",
			}
		}
		history = append(history, asset)
	}

	return history, nil
}
