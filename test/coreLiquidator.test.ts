import dotenv from 'dotenv-flow'
import CoreLiquidator from '../src/coreLiquidator'
import { expect } from 'chai'
import { SapphireArc } from '@arcxgame/contracts/dist/src/SapphireArc'
import { loadContract } from '../src/lib/loadContracts'
import { providers, Wallet } from 'ethers'

dotenv.config()

// A liquidation is available at block 28556222

describe('CoreLiquidator', () => {
  let provider: providers.JsonRpcProvider
  let liquidator: CoreLiquidator

  before(async () => {
    provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
    const signer = new Wallet(process.env.WALLET_PRIVATE_KEY, provider)

    const wethCore = loadContract({
      network: 'polygon',
      group: 'WETH',
      name: 'SapphireCoreProxy',
    })
    const arc = new SapphireArc(signer)
    await arc.addCores({ [wethCore.group]: wethCore.address })

    liquidator = new CoreLiquidator(arc.getCoreContracts(arc.getCoreNames()[0]), wethCore.txn)
    /**
     * Manually set the block to the contract creation number since provider.getTransactionReceipt()
     * doesn't work with the MockProvider
     */
    liquidator.lastBlockScanned = 26815547
  })

  it('populates the known borrowers', async () => {
    await liquidator.getLiquidatableVaults()

    expect(liquidator.knownBorrowers.length).to.be.gte(1)
  }).timeout(10000)
})
