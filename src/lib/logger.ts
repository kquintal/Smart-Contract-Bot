import axios from 'axios'
import axiosRetry from 'axios-retry'

axiosRetry(axios, {
  retryDelay: (retryCount, error) => {
    const data = error.response?.data as { retry_after: number }

    return data ? data.retry_after : axiosRetry.exponentialDelay(retryCount)
  },
})

class Logger {
  private static logger: Logger

  private constructor() {}

  public static getLogger(): Logger {
    if (!Logger.logger) {
      Logger.logger = new Logger()
    }

    return Logger.logger
  }

  /**
   * Logs to console and posts to Discord webhook if present
   */
  info(...args: any[]) {
    console.log(...args)
    this._postDiscord(args.join(' '))
  }

  debug(...args: any[]) {
    console.debug(...args)
  }

  error(...args: any[]) {
    console.error(...args)
    this._postDiscord(`<@${process.env.DISCORD_NOTIFICATION_ID}> An unexpected error occured, please have a look 🙏\n ${args}`)
  }

  private _postDiscord(content: string) {
    if (process.env.DISCORD_WEBHOOK_URL) {
      axios
        .post(process.env.DISCORD_WEBHOOK_URL, {
          content,
        })
        .catch((e) => {
          console.error('Logger::_postDiscord: ' + e)
        })
    }
  }
}

const logger = Logger.getLogger()

export default logger
