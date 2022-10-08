import { Contract as MulticallContract, Provider } from 'ethers-multicall'
import { Contract as EthersContract } from '@ethersproject/contracts'
import { FormatTypes } from 'ethers/lib/utils'

interface FunctionCall {
  name: string
  params: any[]
}

export default async function ethMulticaller<T extends any[]>(
  contract: EthersContract,
  functionCalls: FunctionCall[],
) {
  const ethcallProvider = new Provider(contract.provider)
  await ethcallProvider.init()

  const abi = contract.interface.format(FormatTypes.full) as string[]
  const contractMulticall = new MulticallContract(contract.address, abi)

  const res = await ethcallProvider.all<T>(
    functionCalls.map(({ name, params }) => contractMulticall[name](...params)),
  )

  return res
}
