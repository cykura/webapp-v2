import { Currency, Token } from '@cykura/sdk-core'
import { BN } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
import { Tags, TokenInfo } from '@uniswap/token-lists'
import { TokenList } from '@uniswap/token-lists/dist/types'
import { isAddress } from '../../utils'

type TagDetails = Tags[keyof Tags]
interface TagInfo extends TagDetails {
  id: string
}
/**
 * Token instances created from token info on a token list.
 */
export class WrappedTokenInfo implements Token {
  public readonly isNative: false = false
  public readonly isToken: true = true
  public readonly list: TokenList

  public readonly tokenInfo: TokenInfo

  constructor(tokenInfo: TokenInfo, list: TokenList) {
    this.tokenInfo = tokenInfo
    this.list = list
  }

  private _checksummedAddress: PublicKey | null = null

  public get address(): PublicKey {
    if (this._checksummedAddress) return this._checksummedAddress
    const checksummedAddress = isAddress(this.tokenInfo.address)
    if (!checksummedAddress) throw new Error(`Invalid token address: ${this.tokenInfo.address}`)
    console.log('converting to address', checksummedAddress)
    return (this._checksummedAddress = new PublicKey(checksummedAddress))
  }

  public get chainId(): number {
    return this.tokenInfo.chainId
  }

  public get decimals(): number {
    return this.tokenInfo.decimals
  }

  public get name(): string {
    return this.tokenInfo.name
  }

  public get symbol(): string {
    return this.tokenInfo.symbol
  }

  public get logoURI(): string | undefined {
    return this.tokenInfo.logoURI
  }

  private _tags: TagInfo[] | null = null
  public get tags(): TagInfo[] {
    if (this._tags !== null) return this._tags
    if (!this.tokenInfo.tags) return (this._tags = [])
    const listTags = this.list.tags
    if (!listTags) return (this._tags = [])

    return (this._tags = this.tokenInfo.tags.map((tagId) => {
      return {
        ...listTags[tagId],
        id: tagId,
      }
    }))
  }

  equals(other: Currency): boolean {
    return other.chainId === this.chainId && other.isToken && other.address === this.address
  }

  sortsBefore(other: Token): boolean {
    if (this.equals(other)) throw new Error('Addresses should not be equal')

    const thisKeyAsNumber = new BN(this.address.toBuffer())
    const otherKeyAsNumber = new BN(other.address.toBuffer())

    return thisKeyAsNumber.lt(otherKeyAsNumber)
  }

  public get wrapped(): Token {
    return this
  }
}
