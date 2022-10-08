import dotenv from 'dotenv-flow'
import { Vault } from '@arcxgame/contracts/dist/arc-types/sapphireCore'
import { SapphireCoreV1Factory } from '@arcxgame/contracts/dist/src/typings'
import chai from 'chai'
import { BigNumber, providers } from 'ethers'
import ethMulticaller from '../src/lib/ethMulticaller'
import { loadContract } from '../src/lib/loadContracts'
import { solidity } from 'ethereum-waffle'

chai.use(solidity)
const expect = chai.expect

dotenv.config()

describe('ethMulticaller', () => {
  it('makes multiple calls to the core', async () => {
    const provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
    const signer = provider.getSigner(0)

    const wethCoreAddress = loadContract({
      network: 'polygon',
      group: 'WETH',
      name: 'SapphireCoreProxy',
    }).address

    const core = SapphireCoreV1Factory.connect(wethCoreAddress, signer)

    const [highCRatio, protocol] = await ethMulticaller<[BigNumber, Vault]>(core, [
      { name: 'highCollateralRatio', params: [] },
      { name: 'getProofProtocol', params: [0] },
    ])

    expect(highCRatio).to.be.gt(0)
    expect(protocol).to.be.eq('arcx.credit')
  })
})
