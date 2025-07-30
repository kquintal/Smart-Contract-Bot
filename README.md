# Smart Contract Bot - Loan Closer

The place where we close DeFi contracts for positions that are over their risk thresholds. This service will automatically liquidate undercollateralized ARCx Sapphire vaults.

## Usage

Ensure you have the **required** environment variables specified below inside the `.env` file, then start the bot with

```
yarn build && yarn start
````

It loads all the Sapphire Core contracts from the ARCx core contracts package, then continuously watches the opened vaults every hour, unless `REFRESH_INTERVAL` specifies otherwise. When a vault can be liquidated, it executes the `liquidate()` function on the ARCx liquidation contract (TODO link), that:

1. Takes a flash loan from Aave
2. Liquidates the vault
3. Swaps the earned collateral into a supported stablecoin (taken from the core's pool)
4. Transfers the profit to the wallet of the specified `WALLET_PRIVATE_KEY`
5. Repays the flash loan

## Configuration

### Environment Variables

|ENV Variable|Description|
|-|-|
|WALLET_PRIVATE_KEY|**REQUIRED** Ethereum private key the dYdX account owner that will do the liquidations. Make sure that "0x" is at the start of it (MetaMask exports private keys without it).|
|POLYGON_RPC_URL|**REQUIRED** The URL of the Polygon node to use|
|DISCORD_WEBHOOK_URL|A webhook URL if you'd like this bot to publish its `logger.info()` calls to a discord channel.
