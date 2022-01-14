import {Address, BigDecimal, BigInt, ethereum, log} from '@graphprotocol/graph-ts'
import {NoahArkERC20} from '../../generated/NoahArkStaking/NoahArkERC20';
import {nrkTotalSupplyCalculator} from '../../generated/NoahArkStaking/nrkTotalSupplyCalculator';
import {sNoahArkERC20} from '../../generated/NoahArkStaking/sNoahArkERC20';
import {ERC20} from '../../generated/NoahArkStaking/ERC20';
import {UniswapV2Pair} from '../../generated/NoahArkStaking/UniswapV2Pair';
import {NoahArkStaking} from '../../generated/NoahArkStaking/NoahArkStaking';

import {LastBlock, ProtocolMetric} from '../../generated/schema'
import {LP_FLAG, NRK_TOTAL_SUPPLY_CONTRACT, ERC20DAI_CONTRACT, NRK_ERC20_CONTRACT, SNRK_ERC20_CONTRACT, STAKING_CONTRACT, SUSHI_NRKDAI_PAIR, TREASURY_ADDRESS,} from './Constants';
import {toDecimal} from './Decimals';
import {getDiscountedPairUSD, getNRKUSDRate, getPairUSD} from './Price';


export function loadOrCreateProtocolMetric(blockNumber: BigInt, timestamp: BigInt): ProtocolMetric {
    let id = blockNumber.minus(blockNumber.mod(BigInt.fromString("45")));

    let protocolMetric = ProtocolMetric.load(id.toString())
    if (protocolMetric == null) {
        protocolMetric = new ProtocolMetric(id.toString())
        protocolMetric.timestamp = timestamp
        protocolMetric.nrkCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.sNrkCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.totalSupply = BigDecimal.fromString("0")
        protocolMetric.nrkPrice = BigDecimal.fromString("0")
        protocolMetric.marketCap = BigDecimal.fromString("0")
        protocolMetric.totalValueLocked = BigDecimal.fromString("0")
        protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMarketValue = BigDecimal.fromString("0")
        protocolMetric.nextEpochRebase = BigDecimal.fromString("0")
        protocolMetric.nextDistributedNrk = BigDecimal.fromString("0")
        protocolMetric.currentAPY = BigDecimal.fromString("0")
        protocolMetric.treasuryDaiRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryDaiMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryNrkDaiPOL = BigDecimal.fromString("0")

        protocolMetric.save()
    }
    return protocolMetric as ProtocolMetric
}


function getTotalSupply(): BigDecimal {
    let nrk_contract = NoahArkERC20.bind(Address.fromString(NRK_ERC20_CONTRACT))
    let total_supply = toDecimal(nrk_contract.totalSupply(), 9)
    log.debug("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getNrkSupply(): BigDecimal {
    let nrk_totalsupply_contract = nrkTotalSupplyCalculator.bind(Address.fromString(NRK_TOTAL_SUPPLY_CONTRACT))
    let total_supply = toDecimal(nrk_totalsupply_contract.NRKCirculatingSupply(), 9)
    log.debug("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getSnrkSupply(blockNumber: BigInt): BigDecimal {
    let snrk_contract = sNoahArkERC20.bind(Address.fromString(SNRK_ERC20_CONTRACT))
    let snrk_supply = toDecimal(snrk_contract.circulatingSupply(), 9)
    log.debug("sNRK Supply {}", [snrk_supply.toString()])
    return snrk_supply
}

function getNRKDAIReserves(pair: UniswapV2Pair): BigDecimal[] {
    let nrkReserves = toDecimal(LP_FLAG ? pair.getReserves().value0 : pair.getReserves().value1, 9)
    let daiReserves = toDecimal(LP_FLAG ? pair.getReserves().value1 : pair.getReserves().value0, 18)
    return [nrkReserves, daiReserves]
}

function getMV_RFV(blockNumber: BigInt): BigDecimal[] {
    let daiERC20 = ERC20.bind(Address.fromString(ERC20DAI_CONTRACT))

    let nrkdaiPair = UniswapV2Pair.bind(Address.fromString(SUSHI_NRKDAI_PAIR))

    let daiBalance = daiERC20.balanceOf(Address.fromString(TREASURY_ADDRESS))

    //NRKDAI LP
    let nrkdaiBalance = nrkdaiPair.balanceOf(Address.fromString(TREASURY_ADDRESS))
    let nrkdaiTotalLP = toDecimal(nrkdaiPair.totalSupply(), 18)
    let nrkdaiPOL = toDecimal(nrkdaiBalance, 18).div(nrkdaiTotalLP).times(BigDecimal.fromString("100"))
    let nrkdaiValue = getPairUSD(nrkdaiBalance, SUSHI_NRKDAI_PAIR, getNRKDAIReserves)
    let nrkdaiRFV = getDiscountedPairUSD(nrkdaiBalance, SUSHI_NRKDAI_PAIR, getNRKDAIReserves)

    let stableValueDecimal = toDecimal(daiBalance, 18)
    let lpValue = nrkdaiValue
    let rfvLpValue = nrkdaiRFV
    let mv = stableValueDecimal.plus(lpValue)
    let rfv = stableValueDecimal.plus(rfvLpValue)

    log.debug("Treasury Market Value {}", [mv.toString()])
    log.debug("Treasury RFV {}", [rfv.toString()])
    log.debug("Treasury DAI value {}", [toDecimal(daiBalance, 18).toString()])
    log.debug("Treasury NRK-DAI RFV {}", [nrkdaiRFV.toString()])

    return [
        mv,
        rfv,
        nrkdaiRFV.plus(toDecimal(daiBalance, 18)),
        nrkdaiValue.plus(toDecimal(daiBalance, 18)),
        nrkdaiPOL,
    ]
}

function getNextNRKRebase(blockNumber: BigInt): BigDecimal {
    let staking_contract = NoahArkStaking.bind(Address.fromString(STAKING_CONTRACT))
    let distribution = toDecimal(staking_contract.epoch().value3, 9)
    log.debug("next_distribution v1 {}", [distribution.toString()])
    return distribution
}

function getAPY_Rebase(sNRK: BigDecimal, distributedNRK: BigDecimal): BigDecimal[] {
    let nextEpochRebase = sNRK.gt(BigDecimal.fromString('0'))
        ? distributedNRK.div(sNRK).times(BigDecimal.fromString("100"))
        : BigDecimal.fromString('0');

    let nextEpochRebase_number = parseFloat(nextEpochRebase.toString())
    let currentAPY = Math.pow(((Math.min(90, nextEpochRebase_number) / 100) + 1), (365 * 3) - 1) * 100

    let currentAPYdecimal = BigDecimal.fromString(currentAPY.toString())

    log.debug("next_rebase {}", [nextEpochRebase.toString()])
    log.debug("current_apy total {}", [currentAPYdecimal.toString()])

    return [currentAPYdecimal, nextEpochRebase]
}

function getRunway(sNrk: BigDecimal, rfv: BigDecimal, rebase: BigDecimal): BigDecimal[] {
    let runway2dot5k = BigDecimal.fromString("0")
    let runway5k = BigDecimal.fromString("0")
    let runway7dot5k = BigDecimal.fromString("0")
    let runway10k = BigDecimal.fromString("0")
    let runway20k = BigDecimal.fromString("0")
    let runway50k = BigDecimal.fromString("0")
    let runway70k = BigDecimal.fromString("0")
    let runway100k = BigDecimal.fromString("0")
    let runwayCurrent = BigDecimal.fromString("0")

    if (sNrk.gt(BigDecimal.fromString("0")) && rfv.gt(BigDecimal.fromString("0")) && rebase.gt(BigDecimal.fromString("0"))) {
        let treasury_runway = parseFloat(rfv.div(sNrk).toString());
        let runway2dot5k_num = (Math.log(treasury_runway) / Math.log(1 + 0.0029438)) / 3;
        let runway5k_num = (Math.log(treasury_runway) / Math.log(1 + 0.003579)) / 3;
        let runway7dot5k_num = (Math.log(treasury_runway) / Math.log(1 + 0.0039507)) / 3;
        let runway10k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00421449)) / 3;
        let runway20k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00485037)) / 3;
        let runway50k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00569158)) / 3;
        let runway70k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00600065)) / 3;
        let runway100k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00632839)) / 3;

        let nextEpochRebase_number = parseFloat(rebase.toString()) / 100
        let runwayCurrent_num = (Math.log(treasury_runway) / Math.log(1 + nextEpochRebase_number)) / 3;

        runway2dot5k = BigDecimal.fromString(runway2dot5k_num.toString())
        runway5k = BigDecimal.fromString(runway5k_num.toString())
        runway7dot5k = BigDecimal.fromString(runway7dot5k_num.toString())
        runway10k = BigDecimal.fromString(runway10k_num.toString())
        runway20k = BigDecimal.fromString(runway20k_num.toString())
        runway50k = BigDecimal.fromString(runway50k_num.toString())
        runway70k = BigDecimal.fromString(runway70k_num.toString())
        runway100k = BigDecimal.fromString(runway100k_num.toString())
        runwayCurrent = BigDecimal.fromString(runwayCurrent_num.toString())
    }
    return [runway2dot5k, runway5k, runway7dot5k, runway10k, runway20k, runway50k, runway70k, runway100k, runwayCurrent]
}


export function updateProtocolMetrics(blockNumber: BigInt, timestamp: BigInt): void {
    let pm = loadOrCreateProtocolMetric(blockNumber, timestamp);

    //Total Supply
    pm.totalSupply = getTotalSupply()

    //Circ Supply
    pm.nrkCirculatingSupply = getNrkSupply()

    //sNrk Supply
    pm.sNrkCirculatingSupply = getSnrkSupply(blockNumber)

    //NRK Price
    pm.nrkPrice = getNRKUSDRate()

    //NRK Market Cap
    pm.marketCap = pm.nrkCirculatingSupply.times(pm.nrkPrice)

    //Total Value Locked
    pm.totalValueLocked = pm.sNrkCirculatingSupply.times(pm.nrkPrice)

    //Treasury RFV and MV
    let mv_rfv = getMV_RFV(blockNumber)
    pm.treasuryMarketValue = mv_rfv[0]
    pm.treasuryRiskFreeValue = mv_rfv[1]
    pm.treasuryDaiRiskFreeValue = mv_rfv[2]
    pm.treasuryDaiMarketValue = mv_rfv[3]
    pm.treasuryNrkDaiPOL = mv_rfv[4]

    // Rebase rewards, APY, rebase
    pm.nextDistributedNrk = getNextNRKRebase(blockNumber)
    let apy_rebase = getAPY_Rebase(pm.sNrkCirculatingSupply, pm.nextDistributedNrk)
    pm.currentAPY = apy_rebase[0]
    pm.nextEpochRebase = apy_rebase[1]
    //Runway
    let runways = getRunway(pm.sNrkCirculatingSupply, pm.treasuryRiskFreeValue, pm.nextEpochRebase)
    pm.runway2dot5k = runways[0]
    pm.runway5k = runways[1]
    pm.runway7dot5k = runways[2]
    pm.runway10k = runways[3]
    pm.runway20k = runways[4]
    pm.runway50k = runways[5]
    pm.runway70k = runways[6]
    pm.runway100k = runways[7]
    pm.runwayCurrent = runways[8]
    pm.save()
}

export function handleBlock(block: ethereum.Block): void {
    let lastBlock = LastBlock.load('0')
    if (lastBlock == null || block.number.minus(lastBlock.number).gt(BigInt.fromString('45'))) {
        lastBlock = new LastBlock('0')
        lastBlock.number = block.number
        lastBlock.timestamp = block.timestamp
        lastBlock.save()
        updateProtocolMetrics(block.number, block.timestamp)
    }
}
