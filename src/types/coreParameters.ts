import { BigNumber } from 'ethers'

export type CoreParameters = {
  highCRatio: BigNumber
  lowCRatio: BigNumber
  currentBorrowIndex: BigNumber
  currentPrice: BigNumber
  maxScore: number
  protocol: string
}
