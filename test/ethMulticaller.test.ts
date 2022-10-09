import { Vault } from '@arcxgame/contracts/dist/arc-types/sapphireCore'
import { SapphireCoreV1Factory } from '@arcxgame/contracts/dist/src/typings'
import { expect } from 'chai'
import { BigNumber, providers } from 'ethers'
import ethMulticaller from '../src/lib/ethMulticaller'
import { loadContract } from '../src/lib/loadContracts'

describe('ethMulticaller', () => {
  it('makes multiple calls to the core', async () => {
    const provider = new providers.JsonRpcProvider('https://polygon-rpc.com')
    const signer = provider.getSigner(0)

    const wethCoreAddress = loadContract({
      network: 'polygon',
      group: 'WETH',
      name: 'SapphireCoreProxy',
    }).address

    const core = SapphireCoreV1Factory.connect(wethCoreAddress, signer)

    const [creditScore, limitScore] = await ethMulticaller<[BigNumber, Vault]>(core, [
      { name: 'getProofProtocol', params: [0] },
      { name: 'getProofProtocol', params: [1] },
    ])

    expect(creditScore).to.be.eq('arcx.credit')
    expect(limitScore).to.be.eq('arcx.limit.137.weth.a')
  })
})
