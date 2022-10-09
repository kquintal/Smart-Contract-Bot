import { SapphireArc } from '@arcxgame/contracts/dist/src/SapphireArc'
import { FlashLiquidator, FlashLiquidatorFactory } from '@arcxgame/contracts/dist/src/typings'
import axios from 'axios'
import { expect } from 'chai'
import { providers, Wallet } from 'ethers'
import sinon from 'sinon'
import CoreLiquidator from '../src/ARCx/CoreLiquidator'
import { loadContract } from '../src/lib/loadContracts'
import logger from '../src/lib/logger'

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

    sinon.stub(FlashLiquidatorFactory, 'connect').returns({
      liquidate: sinon.stub().resolves({
        wait: sinon.stub().resolves()
      }),
    } as unknown as FlashLiquidator)

    sinon.stub(axios, 'get').resolves({ data: { data: [] } })


    liquidator = new CoreLiquidator(arc.getCoreContracts(arc.getCoreNames()[0]), wethCore.txn)
    /**
     * Manually set the block to the contract creation number since provider.getTransactionReceipt()
     * doesn't work with the MockProvider
     */
    liquidator.lastBlockScanned = lastKnowLiquidationBlock
  })

  after(() => { sinon.restore() })

  it('Fetches liquidatable vaults when available', async () => {
    await liquidator.getLiquidatableVaults()
    expect(liquidator.activeBorrowers.length).to.be.gte(1)
  })

  it('Calls liquidation when available', async () => {
    const infoStub = sinon.stub(logger, 'info')
    const proofs = await liquidator.getLiquidatableVaults()
    await liquidator.liquidateVaults(proofs)

    expect(liquidator.activeBorrowers.length, 'active borrowers').to.be.gte(1)
    expect(infoStub.calledOnce, 'info stub called').to.be.true
  })
})
