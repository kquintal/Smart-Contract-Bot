import { getEmptyScoreProof } from '@arcxgame/contracts'
import { SapphireCoreV1 } from '@arcxgame/contracts/dist/src/typings'
import { BigNumber, utils } from 'ethers'
import { formatBytes32String } from 'ethers/lib/utils'
import { getScoreProof } from '../lib/getScoreProof'
import { CoreParameters } from '../types/coreParameters'

const BASE = utils.parseEther('1')

async function checkLiquidatable(
  account: string,
  core: SapphireCoreV1,
  coreParameters: CoreParameters,
) {
  const { currentBorrowIndex, currentPrice, highCRatio, lowCRatio, maxScore, protocol } =
    coreParameters

  const [creditScoreProof, vault] = await Promise.all([
    getScoreProof(account, protocol),
    await core.vaults(account),
  ])

  const proof = creditScoreProof || getEmptyScoreProof(account, formatBytes32String(protocol))

  const boundsDifference = highCRatio.sub(lowCRatio)
  const creditScore = BigNumber.from(proof.score)
  const assessedCRatio = highCRatio.sub(creditScore.mul(boundsDifference).div(maxScore))

  if (vault.normalizedBorrowedAmount.isZero()) {
    return {
      assessedCRatio: null,
      isLiquidatable: false,
      proof,
    }
  }

  const denormalizedBorrowAmt = vault.normalizedBorrowedAmount.mul(currentBorrowIndex).div(BASE)
  const collateralValue = vault.collateralAmount.mul(currentPrice).div(BASE)
  const currentCRatio = collateralValue.mul(BASE).div(denormalizedBorrowAmt)
  const isCollateralized = currentCRatio.gt(assessedCRatio)

  return {
    assessedCRatio,
    isLiquidatable: !isCollateralized,
    proof,
  }
}

export { checkLiquidatable }
