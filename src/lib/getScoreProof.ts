import { PassportScoreProof } from '@arcxgame/contracts/dist/arc-types/sapphireCore'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import logger from './logger'

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay })

export async function getScoreProof(
  account: string,
  protocol: string,
): Promise<PassportScoreProof | undefined> {
  try {
    const res = await axios.get(`https://api.arcx.money/v1/scores`, {
      params: {
        account,
        protocol,
        format: 'proof',
      },
    })

    return res.data.data[0] as PassportScoreProof
  } catch (e) {
    logger.error('getScoreProof', e)
    return undefined
  }
}
