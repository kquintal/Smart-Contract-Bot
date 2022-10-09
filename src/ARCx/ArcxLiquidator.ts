import { SapphireArc } from "@arcxgame/contracts/dist/src/SapphireArc";
import { Wallet } from "ethers";
import { loadContracts } from "../lib/loadContracts";
import logger from "../lib/logger";
import CoreLiquidator from "./CoreLiquidator";

export class ArcxLiquidator {
  static readonly DISCORD_NOTIFICATION_ID = '307217499819081729' //  Classicus
  private POLL_INTERVAL_MS = 300000

  private lastReportDate: Date = new Date(0);
  private REPORT_INTERVAL_MS = 1000 * 60 * 60 * 24 // Daily report
  private static _instance: ArcxLiquidator

  protected constructor (private signer: Wallet) { }

  static getInstance (signer: Wallet): ArcxLiquidator {
    if (!this._instance) {
      this._instance = new ArcxLiquidator(signer)
    }
    return this._instance
  }


  async start () {
    // Get polygon core contracts
    const coreContracts = loadContracts({ network: "polygon", name: "SapphireCoreProxy", });

    const coresDict: {
      [collateral: string]: { address: string; creationTx: string };
    } = {};

    for (const core of coreContracts) {
      coresDict[core.group] = {
        address: core.address,
        creationTx: core.txn,
      };
    }

    const arc = new SapphireArc(this.signer);

    // Add all cores to SapphireArc
    await Promise.all(
      Object.keys(coresDict).map((coreName) =>
        arc.addCores({ [coreName]: coresDict[coreName].address })
      )
    );

    const coreLiquidators = arc
      .getCoreNames()
      .map(
        (coreName) =>
          new CoreLiquidator(
            arc.getCoreContracts(coreName),
            coresDict[coreName].creationTx
          )
      );

    coreLiquidators.forEach(async (liquidator) => await liquidator.init());

    // Initial call
    await this.pollVaults(coreLiquidators);
    await this.report(coreLiquidators);

    // Polling (none-blocking)
    setInterval(async () => {
      await this.pollVaults(coreLiquidators);
      await this.report(coreLiquidators);

    }, Number(this.POLL_INTERVAL_MS));
  }

  private async pollVaults (coreLiquidators: CoreLiquidator[]) {
    await Promise.all(
      coreLiquidators.map(async (liquidator) => {
        await liquidator.pollVaults();
      })
    );
  }

  private async report (coreLiquidators: CoreLiquidator[]) {
    const now = new Date()
    console.log({ lastReportDate: this.lastReportDate.getTime(), now: now.getTime(), diff: now.getTime() - this.lastReportDate.getTime() });
    if (now.getTime() - this.lastReportDate.getTime() < this.REPORT_INTERVAL_MS) {
      return
    }

    const totalActiveBorrowers = coreLiquidators.reduce((acc, liquidator) => {
      return acc + liquidator.activeBorrowers.length;
    }, 0);

    const pollFrequencyMins = this.POLL_INTERVAL_MS / (60 * 1000)

    logger.info(`💰 ARCx Liquidator: Tracking **${totalActiveBorrowers} positions**. Polling is set every **${pollFrequencyMins} mins**`);

    this.lastReportDate = now;
  }
}
