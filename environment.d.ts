// declare global env variable to define types
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      POLYGON_RPC_URL: string
      WALLET_PRIVATE_KEY: string
      REFRESH_INTERVAL: number
      DISCORD_WEBHOOK_URL: string
    }
  }
}

export {}
