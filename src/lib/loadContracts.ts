import mainnetAddresses from '@arcxgame/contracts/deployments/mainnet/deployed.json'
import polygonAddresses from '@arcxgame/contracts/deployments/polygon/deployed.json'
import mumbaiAddresses from '@arcxgame/contracts/deployments/mumbai/deployed.json'
import rinkebyAddresses from '@arcxgame/contracts/deployments/rinkeby/deployed.json'
import { ContractDetails, LoadContractParams } from '@arcxgame/contracts/dist/deployments/src'
import _ from 'lodash'

export function loadContract(params: LoadContractParams) {
  const results = loadContracts(params)

  if (results.length === 0) {
    throw Error(`No contracts found for ${JSON.stringify(params, null, 2)}`)
  }

  if (results.length > 1) {
    throw Error(`More than one contract found for ${JSON.stringify(params, null, 2)}`)
  }

  return results[0]
}

export function loadContracts(params: LoadContractParams): Array<ContractDetails> {
  const contracts = loadContractsForNetwork(params.network)

  // If nothing was passed in
  if (_.isNil(params)) {
    throw Error('No name, type, source or group passed in')
  }

  // Remove the network from since we are already looking
  // in the right network
  const paramsWithoutNetwork = _.omit(params, 'network')

  return _.filter(
    contracts,
    _.matches(_.pickBy(paramsWithoutNetwork, _.identity)),
  ) as Array<ContractDetails>
}

export function loadContractsForNetwork(chainId: string) {
  switch (chainId) {
    case 'homestead':
    case '1':
      return mainnetAddresses
    case 'rinkeby':
    case '4':
      return rinkebyAddresses
    case 'polygon':
    case '137':
      return polygonAddresses
    case 'mumbai':
    case '80001':
      return mumbaiAddresses
    default:
      return []
  }
}
