import { expect } from 'chai'
import dotenv from 'dotenv-flow'
import { providers, Wallet } from 'ethers'

dotenv.config({
  node_env: 'production',
})

describe('(int) - Setup on prod', () => {
  it('has the environment variables correclty configured', async () => {
    const provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
    const signer = new Wallet(process.env.WALLET_PRIVATE_KEY, provider)

    const balance = await signer.getBalance()

    expect(balance).gt(0)
  })
})
