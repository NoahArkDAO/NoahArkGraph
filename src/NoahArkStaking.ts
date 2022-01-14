import {StakeEvent, UnStakeEvent} from '../generated/NoahArkStaking/NoahArkStaking'
import {handleBlock} from './utils/ProtocolMetrics'
import {StakeRecord} from "../generated/schema";
import {Address, BigInt} from "@graphprotocol/graph-ts/index";
import {toDecimal} from "./utils/Decimals";
import {NoahArkERC20} from "../generated/sNoahArkERC20/NoahArkERC20";
import {NRK_ERC20_CONTRACT, STAKING_CONTRACT} from "./utils/Constants";

export function handleStake(event: StakeEvent): void {
    handleBlock(event.block)
    stakeRecord(event)
}

export function handleUnstake(event: UnStakeEvent): void {
    handleBlock(event.block)
    unStakeRecord(event)
}

export function stakeRecord(event: StakeEvent): void {
    let stakeId = event.transaction.hash.toHex()
    var record = StakeRecord.load(stakeId)

    if (record == null && event.params._amount.gt(BigInt.fromI32(0))) {
        let nrk_contract = NoahArkERC20.bind(Address.fromString(NRK_ERC20_CONTRACT))
        record = new StakeRecord(stakeId)
        record.stakeAddress = event.transaction.from.toHex()
        record.stakeNrk = toDecimal(event.params._amount, 9)
        record.transaction = stakeId
        record.timestamp = event.block.timestamp
        record.contractNrk = toDecimal(nrk_contract.balanceOf(Address.fromString(STAKING_CONTRACT)), 9)
        record.isStake = true
        record.save()
    }
}

export function unStakeRecord(event: UnStakeEvent): void {
    let stakeId = event.transaction.hash.toHex()
    var record = StakeRecord.load(stakeId)

    if (record == null && event.params._amount.gt(BigInt.fromI32(0))) {
        let nrk_contract = NoahArkERC20.bind(Address.fromString(NRK_ERC20_CONTRACT))
        record = new StakeRecord(stakeId)
        record.stakeAddress = event.transaction.from.toHex()
        record.stakeNrk = toDecimal(event.params._amount, 9)
        record.transaction = stakeId
        record.timestamp = event.block.timestamp
        record.contractNrk = toDecimal(nrk_contract.balanceOf(Address.fromString(STAKING_CONTRACT)), 9)
        record.isStake = false
        record.save()
    }
}

