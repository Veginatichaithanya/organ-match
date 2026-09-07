package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	organContract := new(OrganDonationContract)

	cc, err := contractapi.NewChaincode(organContract)
	if err != nil {
		log.Panicf("Error creating organ-contract chaincode: %v", err)
	}

	if err := cc.Start(); err != nil {
		log.Panicf("Error starting organ-contract chaincode: %v", err)
	}
}
