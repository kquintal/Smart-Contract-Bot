import { expect } from "chai";
import { utils } from "ethers";
import { getScoreProof } from "../src/lib/getScoreProof";

describe('(int) getScoreProof', () => {
  const classicus = '0xcd78358fb5fC823b9e789605B7b4fDc1dEf14A1E'
  const creditProtocol = 'arcx.credit'

  it('gets score of classicus.eth', async () => {
    const passportScoreProof = await getScoreProof(classicus, creditProtocol)

    const byte32protocol = utils.formatBytes32String(creditProtocol)

    expect(passportScoreProof).to.be.not.null;
    expect(passportScoreProof?.account).to.eq(classicus.toLowerCase());
    expect(passportScoreProof?.protocol).to.eq(byte32protocol);
  })
})