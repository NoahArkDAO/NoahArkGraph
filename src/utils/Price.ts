import {
    SUSHI_NRKDAI_PAIR, LP_FLAG
} from './Constants'
import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { UniswapV2Pair } from '../../generated/NoahArkStaking/UniswapV2Pair';
import { toDecimal } from './Decimals'


let BIG_DECIMAL_1E9 = BigDecimal.fromString('1e9')
let BIG_DECIMAL_1E12 = BigDecimal.fromString('1e12')

export function getNRKUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_NRKDAI_PAIR))

    let reserves = pair.getReserves()
    let reserve0 = reserves.value1.toBigDecimal()
    let reserve1 = reserves.value0.toBigDecimal()

    if (LP_FLAG) {
        reserve0 = reserves.value0.toBigDecimal()
        reserve1 = reserves.value1.toBigDecimal()
    }

    let nrkRate = reserve1.div(reserve0).div(BIG_DECIMAL_1E9)
    log.debug("NRK rate {}", [nrkRate.toString()])

    return nrkRate
}

//(slp_treasury/slp_supply)*(2*sqrt(lp_dai * lp_nrk))
export function getDiscountedPairUSD(lp_amount: BigInt, pair_address: string, getReserves: (pair: UniswapV2Pair) => BigDecimal[]): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_address))

    let total_lp = pair.totalSupply()
    let reserves = getReserves(pair)
    let lp_token_1 = LP_FLAG ? reserves[0] : reserves[1]
    let lp_token_2 = LP_FLAG ? reserves[1] : reserves[0]
    let kLast = lp_token_1.times(lp_token_2).truncate(0).digits

    let part1 = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let two = BigInt.fromI32(2)

    let sqrt = kLast.sqrt();
    let part2 = toDecimal(two.times(sqrt), 0)
    let result = part1.times(part2)
    return result
}

export function getPairUSD(lp_amount: BigInt, pair_address: string, getReserves: (pair: UniswapV2Pair) => BigDecimal[]): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_address))
    let total_lp = pair.totalSupply()
    let reserves = getReserves(pair)
    let lp_token_0 = LP_FLAG ? reserves[0] : reserves[1]
    let lp_token_1 = LP_FLAG ? reserves[1] : reserves[0]
    let ownedLP = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let nrk_value = lp_token_0.times(getNRKUSDRate())
    let total_lp_usd = nrk_value.plus(lp_token_1)

    return ownedLP.times(total_lp_usd)
}
