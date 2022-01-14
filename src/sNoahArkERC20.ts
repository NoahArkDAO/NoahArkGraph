import { rebaseEvent} from '../generated/sNoahArkERC20/sNoahArkERC20'
import { NoahArkERC20 } from '../generated/sNoahArkERC20/NoahArkERC20'
import { Rebase } from '../generated/schema'
import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import {NRK_ERC20_CONTRACT, STAKING_CONTRACT} from './utils/Constants'
import { toDecimal } from './utils/Decimals'
import {getNRKUSDRate} from './utils/Price';


export function rebaseFunction(event: rebaseEvent): void {
    let rebaseId = event.transaction.hash.toHex()
    var rebase = Rebase.load(rebaseId)
    log.debug("Rebase_V1 event on TX {} with amount {}", [rebaseId, toDecimal(event.params.profit_, 9).toString()])

    if (rebase == null && event.params.profit_.gt(BigInt.fromI32(0))) {
        let nrk_contract = NoahArkERC20.bind(Address.fromString(NRK_ERC20_CONTRACT))

        rebase = new Rebase(rebaseId)
        rebase.amount = toDecimal(event.params.profit_, 9)
        rebase.stakedNrks = toDecimal(nrk_contract.balanceOf(Address.fromString(STAKING_CONTRACT)), 9)
        rebase.contract = STAKING_CONTRACT
        rebase.percentage = rebase.amount.div(rebase.stakedNrks)
        rebase.transaction = rebaseId
        rebase.timestamp = event.block.timestamp
        rebase.value = rebase.amount.times(getNRKUSDRate())
        rebase.save()
    }
}
