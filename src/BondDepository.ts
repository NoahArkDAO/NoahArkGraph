import {BondCreated, BondRedeemed} from '../generated/NoahArkBondDepository/BondDepository'
import {BondRecord, RedeemRecord} from "../generated/schema";
import {BigInt} from "@graphprotocol/graph-ts/index";
import {toDecimal} from "./utils/Decimals";


export function bondFunction(event: BondCreated): void {
    let bondId = event.transaction.hash.toHex()
    var record = BondRecord.load(bondId)

    if (record == null && event.params.deposit.gt(BigInt.fromI32(0))) {
        record = new BondRecord(bondId)
        record.transaction = bondId
        record.timestamp = event.block.timestamp
        record.bondAmount = toDecimal(event.params.deposit)
        record.contract = event.address.toHex()
        record.payout = toDecimal(event.params.payout, 9)
        record.priceInUSD = toDecimal(event.params.priceInUSD)
        record.bondAddress = event.transaction.from.toHex()
        record.save()
    }
}

export function redeemFunction(event: BondRedeemed): void {
    let redeemId = event.transaction.hash.toHex()
    var record = RedeemRecord.load(redeemId)

    if (record == null) {
        record = new RedeemRecord(redeemId)
        record.transaction = redeemId
        record.timestamp = event.block.timestamp
        record.contract = event.address.toHex()
        record.payout = toDecimal(event.params.payout, 9)
        record.remindingPayout = toDecimal(event.params.remaining, 9)
        record.redeemAddress = event.transaction.from.toHex()
        record.save()
    }
}
