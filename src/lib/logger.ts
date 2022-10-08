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
    this._postDiscord(
      '<@333338999873863682> An error occured, please have a look at me 🙏\nhttps://console.cloud.google.com/logs/query;query=%2528error_group%2528%22CM6_3c-J3YCF7wE%22%2529%20OR%20error_group%2528%22CJWauNzGipqzhwE%22%2529%2529%0Atimestamp%3E%3D%222022-06-13T08:13:13%2B00:00%22;summaryFields=:false:32:beginning:false;cursorTimestamp=2022-06-13T17:24:42Z?authuser=1&project=sapphire-312006',
    )
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
