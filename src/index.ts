import { providers, Wallet } from 'ethers'
import { ArcxLiquidator } from './ARCx'
import './lib/env'
import logger from './lib/logger'


export async function startServer () {

  verifyEnvVars()
  logger.info(`🚀 Starting Exterminator 🚀`)

  const provider = new providers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
  const signer = new Wallet(process.env.WALLET_PRIVATE_KEY, provider)

  await ArcxLiquidator.getInstance(signer).start()
  console.log('Other process goes here');

}

function verifyEnvVars () {
  const requiredEnvVars = [
    'WALLET_PRIVATE_KEY',
    'POLYGON_RPC_URL',
    'DISCORD_WEBHOOK_URL'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Environment variable ${envVar} is not set`)
    }
  }
}

startServer().catch((err) => logger.error('💀 Uncaught error, stopping Exterminator 💀', err))
