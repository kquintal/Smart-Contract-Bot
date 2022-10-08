// import { PassportScoreProof } from '@arcxgame/contracts/dist/arc-types/sapphireCore'
import { PassportScoreProof } from '@arcxgame/contracts/dist/arc-types/sapphireCore'
import { SapphireCoreContracts } from '@arcxgame/contracts/dist/src/SapphireArc'
import { BaseERC20Factory, FlashLiquidatorFactory } from '@arcxgame/contracts/dist/src/typings'
import { Filter } from '@ethersproject/abstract-provider'
import { BigNumber, ContractTransaction, utils } from 'ethers'
import { checkLiquidatable } from './helpers/checkLiquidatable'
import { delay } from './lib/delay'
import ethMulticaller from './lib/ethMulticaller'
import { loadContract } from './lib/loadContracts'
import logger from './lib/logger'
import { CoreParameters } from './types/coreParameters'

export default class CoreLiquidator {
  knownBorrowers: string[] = []
  lastBlockScanned: number = 0
  lockPolling: boolean = false
  // readonly liquidatorContract: FlashLiquidator

  constructor(public coreContracts: SapphireCoreContracts, private _contractCreationTx: string) {}

  async start() {
    await this._initializeLastblockScanned()
    logger.info('Watching core', this.coreContracts.core.address, '...')
    this._pollVaults()
  }

  private async _initializeLastblockScanned() {
    if (this.lastBlockScanned === 0) {
      const provider = this.coreContracts.core.provider
      const contractCreationTxReceipt = await provider.getTransactionReceipt(
        this._contractCreationTx,
      )
      this.lastBlockScanned = contractCreationTxReceipt?.blockNumber
    }
  }

  async getLiquidatableVaults(): Promise<PassportScoreProof[]> {
    const newBorrowers = await this._getNewBorrowers()
    this.knownBorrowers = this.knownBorrowers.concat(newBorrowers)

    const coreParameters = await this._getCoreParameters()

    const liquidatableVaults = (
      await Promise.all(
        this.knownBorrowers.map((account) =>
          checkLiquidatable(account, this.coreContracts.core, coreParameters),
        ),
      )
    ).filter(({ isLiquidatable }) => isLiquidatable)

    return liquidatableVaults.map(({ proof }) => proof)
  }

  async liquidateVaults(proofOfVaults: PassportScoreProof[]) {
    const signer = this.coreContracts.core.signer

    // Get liquidation contract
    const network = await signer.provider!.getNetwork()
    const flashLiquidatorContractDetails = loadContract({
      network: network.chainId.toString(),
      name: 'FlashLiquidator',
    })
    const flashLiquidator = FlashLiquidatorFactory.connect(
      flashLiquidatorContractDetails.address,
      signer,
    )

    // Record the current user's balance
    const { balance: preLiquidationBalance, decimals } = await this._getLiquidatorBalance()

    // liquidate the vaults one by one
    const txs: ContractTransaction[] = []
    for (const vaultProof of proofOfVaults) {
      const tx = await flashLiquidator.liquidate(
        this.coreContracts.core.address,
        vaultProof.account,
        vaultProof,
        {
          gasPrice: await signer.getGasPrice(),
          gasLimit: 1000000,
        },
      )
      txs.push(tx)
      logger.info(
        `Liquidating vault ${vaultProof.account}... tx hash: https://polygonscan.com/tx/${tx.hash}`,
      )
    }

    await Promise.all(txs.map((tx) => tx.wait()))

    const { balance: postLiquidationBalance } = await this._getLiquidatorBalance()
    logger.info(
      `@here All specified vaults have been liquidated! The liquidator has gained $${utils.formatUnits(
        postLiquidationBalance.sub(preLiquidationBalance),
        decimals,
      )}`,
    )
  }

  private async _pollVaults() {
    while (true) {
      if (!this.lockPolling) {
        this.lockPolling = true

        await this._checkBalance()

        logger.debug('Polling vaults...')
        try {
          const liquidatableVaults = await this.getLiquidatableVaults()
          if (liquidatableVaults.length > 0) {
            logger.info(
              `${liquidatableVaults.length} can be liquidated! These are: ${liquidatableVaults
                .map((v) => v.account)
                .join(', ')}`,
            )

            await this.liquidateVaults(liquidatableVaults)
          }

          const nextPollingTimestamp = Math.round(
            (Date.now() + parseInt(process.env.POLL_INTERVAL_MS!)) / 1000,
          )
          const nrActiveBorrowers = await this._getActiveBorrowersCount()
          logger.debug(`[${this.coreContracts.core.address}] Polling complete`)
          logger.info(
            `[${this.coreContracts.core.address}] There are currently ${this.knownBorrowers.length} known borrowers and **${nrActiveBorrowers} active borrowers**.\nNext polling is in <t:${nextPollingTimestamp}:R>`,
          )
        } catch (error) {
          logger.error('CoreLiquidator::_pollVaults:', error)
        } finally {
          this.lockPolling = false
        }
      }

      await delay(parseInt(process.env.POLL_INTERVAL_MS!))
    }
  }

  private async _getCoreParameters(): Promise<CoreParameters> {
    const { core, oracle, assessor } = this.coreContracts

    const [highCRatio, lowCRatio, currentBorrowIndex, protocol] = await ethMulticaller<
      [BigNumber, BigNumber, BigNumber, string]
    >(core, [
      { name: 'highCollateralRatio', params: [] },
      { name: 'lowCollateralRatio', params: [] },
      { name: 'currentBorrowIndex', params: [] },
      { name: 'getProofProtocol', params: ['0'] },
    ])

    const [{ price }, maxScore] = await Promise.all([
      oracle.fetchCurrentPrice(),
      assessor.maxScore(),
    ])

    if (highCRatio.isZero()) {
      throw new Error('CoreLiquidator::_getCoreParameters: highCRatio is zero')
    }
    if (lowCRatio.isZero()) {
      throw new Error('CoreLiquidator::_getCoreParameters: lowCRatio is zero')
    }
    if (currentBorrowIndex.isZero()) {
      throw new Error('CoreLiquidator::_getCoreParameters: currentBorrowIndex is zero')
    }
    if (!protocol) {
      throw new Error('CoreLiquidator::_getCoreParameters: protocol is undefined')
    }

    return {
      highCRatio,
      lowCRatio,
      currentBorrowIndex,
      currentPrice: price,
      maxScore,
      protocol,
    }
  }

  private async _getNewBorrowers(): Promise<string[]> {
    const core = this.coreContracts.core
    const provider = core.provider
    const borrowLogFilter: Filter = {
      address: core.address,
      topics: core.filters.Borrowed(null, null, null, null, null, null).topics,
      toBlock: 'latest',
      fromBlock: this.lastBlockScanned,
    }
    const logs = await provider.getLogs(borrowLogFilter)
    const borrowers = this._getUniqueBorrowersFromLogs(logs)
    return borrowers.filter((borrower) => !this.knownBorrowers.includes(borrower))
  }

  private _getUniqueBorrowersFromLogs(logs: any[]): string[] {
    const borrowersFromAllTxs = logs.map((log) => utils.hexStripZeros(log.topics[1]))
    const uniqueBorrowers = borrowersFromAllTxs.filter(
      (addr, index, self) => self.indexOf(addr) === index,
    )

    return uniqueBorrowers
  }

  private async _getLiquidatorBalance(): Promise<{ balance: BigNumber; decimals: number }> {
    const signer = this.coreContracts.core.signer
    const borrowAssetAddress = (await this.coreContracts.core.getSupportedBorrowAssets())[0]
    const borrowAsset = BaseERC20Factory.connect(borrowAssetAddress, signer)

    const [balance, decimals] = await Promise.all([
      borrowAsset.balanceOf(await signer.getAddress()),
      borrowAsset.decimals(),
    ])

    return { balance, decimals }
  }

  private async _checkBalance() {
    const balance = await this.coreContracts.core.signer.getBalance()

    if (balance.lt(utils.parseEther('0.5'))) {
      logger.info(
        `<@${process.env.DISCORD_NOTIFICATION_ID}> I have less than 0.5 MATIC (currently at ${utils.formatEther(
          balance,
        )}). Please top me up sempai 😩!`,
      )
    }
  }

  private async _getActiveBorrowersCount(): Promise<number> {
    let nrActiveBorrowers = 0
    const core = this.coreContracts.core

    for (const vaultAddy of this.knownBorrowers) {
      const vault = await core.vaults(vaultAddy)
      if (vault.normalizedBorrowedAmount.gt(0)) {
        nrActiveBorrowers++
      }
    }

    return nrActiveBorrowers
  }
}
