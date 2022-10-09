import { PassportScoreProof } from '@arcxgame/contracts/dist/arc-types/sapphireCore'
import { SapphireCoreContracts } from '@arcxgame/contracts/dist/src/SapphireArc'
import { BaseERC20Factory, FlashLiquidatorFactory } from '@arcxgame/contracts/dist/src/typings'
import { Filter } from '@ethersproject/abstract-provider'
import { BigNumber, ContractTransaction, utils } from 'ethers'
import { checkLiquidatable } from '../helpers/checkLiquidatable'
import ethMulticaller from '../lib/ethMulticaller'
import { loadContract } from '../lib/loadContracts'
import logger from '../lib/logger'
import { CoreParameters } from '../types/coreParameters'

export default class CoreLiquidator {
  activeBorrowers: string[] = []
  lastBlockScanned: number = 0

  constructor (public coreContracts: SapphireCoreContracts, private _contractCreationTx: string) { }

  async init() {
    await this._initializeLastblockScanned()
    await this._checkBalance()
  }

  async pollVaults() {
    try {

      const currentBlock = await this.coreContracts.core.provider.getBlockNumber()

      const liquidatableVaults = await this.getLiquidatableVaults()
      if (liquidatableVaults.length > 0) {
        await this.liquidateVaults(liquidatableVaults)
      }

      this.lastBlockScanned = currentBlock

    } catch (error) {
      logger.error('CoreLiquidator::_pollVaults:', error)
    }
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

    const [newBorrowers, coreParameters] = await Promise.all([
      this._getNewBorrowers(),
      this._getCoreParameters(),
    ])

    await this._updateActiveBorrowers(newBorrowers)

    const liquidatableVaults = (
      await Promise.all(
        this.activeBorrowers.map((account) =>
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

    // Record the liquidator's balance before liquidations
    const { balance: preLiquidationBalance, decimals } = await this._getLiquidatorBalance()

    // liquidate the vaults
    const txSubmitted: ContractTransaction[] = []
    await Promise.all(
      proofOfVaults.map(async (vaultProof) => {
        const txReceipt = await flashLiquidator.liquidate(
          this.coreContracts.core.address,
          vaultProof.account,
          vaultProof,
          {
            gasPrice: await signer.getGasPrice(),
            gasLimit: 2000000,
          },
        )
        txSubmitted.push(txReceipt)
        logger.info(
          `Liquidating vault ${vaultProof.account}... tx hash: https://polygonscan.com/tx/${txReceipt.hash}`,
        )
      }
      )
    )

    await Promise.all(txSubmitted.map((tx) => tx.wait()))

    const { balance: postLiquidationBalance } = await this._getLiquidatorBalance()
    logger.info(
      `@here All specified vaults have been liquidated! The liquidator has gained $${utils.formatUnits(
        postLiquidationBalance.sub(preLiquidationBalance),
        decimals,
      )}`,
    )
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
    return borrowers.filter((borrower) => !this.activeBorrowers.includes(borrower))
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
      logger.error(
        `<@${process.env.DISCORD_NOTIFICATION_ID}> Exterminator has less than 0.5 MATIC (currently at ${utils.formatEther(
          balance,
        )})!`,
      )
    }
  }

  private async _updateActiveBorrowers(newBorrowers: string[]): Promise<void> {
    const core = this.coreContracts.core

    const borrowersToCheck = [...new Set(this.activeBorrowers.concat(newBorrowers))]
    this.activeBorrowers = []

    await Promise.all(
      borrowersToCheck.map(async (borrower) => {
        const { normalizedBorrowedAmount } = await core.vaults(borrower)
        if (!normalizedBorrowedAmount.isZero()) {
          this.activeBorrowers.push(borrower)
        }
      }),
    )
  }
}
