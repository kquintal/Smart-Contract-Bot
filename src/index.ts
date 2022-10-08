import { SapphireArc } from '@arcxgame/contracts/dist/src/SapphireArc'
import { Wallet } from 'ethers'
import { providers } from 'ethers'
import CoreLiquidator from './coreLiquidator'
import { loadContracts } from './lib/loadContracts'
import './lib/env'
import logger from './lib/logger'

console.log(`Starting in env ${process.env.NODE_ENV} on RPC ${process.env.POLYGON_RPC_URL}`)

async function start() {
  const provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
  const signer = new Wallet(process.env.WALLET_PRIVATE_KEY, provider)

  if (!process.env.POLL_INTERVAL_MS) {
    throw new Error('POLL_INTERVAL_MS is not set')
  }

  // Get polygon core contracts
  const coreContracts = loadContracts({
    network: 'polygon',
    name: 'SapphireCoreProxy',
  })

  const coresDict: { [collateral: string]: { address: string; creationTx: string } } = {}

  for (const core of coreContracts) {
    coresDict[core.group] = {
      address: core.address,
      creationTx: core.txn,
    }
  }
  const arc = new SapphireArc(signer)

  // Add all cores to SapphireArc
  await Promise.all(
    Object.keys(coresDict).map((coreName) =>
      arc.addCores({ [coreName]: coresDict[coreName].address }),
    ),
  )

  const coreLiquidators = arc
    .getCoreNames()
    .map(
      (coreName) =>
        new CoreLiquidator(arc.getCoreContracts(coreName), coresDict[coreName].creationTx),
    )

  coreLiquidators.forEach((liquidator) => {
    // Start polling vaults for each core
    liquidator.start()
  })
}

start().catch((err) => logger.error('root uncaught error', err))
