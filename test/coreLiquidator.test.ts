import { SapphireArc } from '@arcxgame/contracts/dist/src/SapphireArc'
import { expect } from 'chai'
import { providers, Wallet } from 'ethers'
import CoreLiquidator from '../src/coreLiquidator'
import { loadContract } from '../src/lib/loadContracts'

describe('CoreLiquidator', () => {
  let provider: providers.JsonRpcProvider
  let liquidator: CoreLiquidator
  const lastKnowLiquidationBlock = 28556222


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
    liquidator.lastBlockScanned = lastKnowLiquidationBlock
  })

  it('populates the known borrowers', async () => {
    await liquidator.getLiquidatableVaults()

    expect(liquidator.knownBorrowers.length).to.be.gte(1)
  }).timeout(10000)
})
