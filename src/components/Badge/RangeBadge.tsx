import Badge, { BadgeVariant } from 'components/Badge'
import styled from 'styled-components/macro'

import { MouseoverTooltip } from '../../components/Tooltip'
import { AlertCircle } from 'react-feather'

const BadgeWrapper = styled.div`
  font-size: 14px;
  display: flex;
  justify-content: flex-end;
`

const BadgeText = styled.div`
  font-weight: 500;
  font-size: 14px;
`

const ActiveDot = styled.span`
  background-color: ${({ theme }) => theme.success};
  border-radius: 50%;
  height: 8px;
  width: 8px;
  margin-right: 4px;
`

export default function RangeBadge({
  removed,
  inRange,
}: {
  removed: boolean | undefined
  inRange: boolean | undefined
}) {
  return (
    <BadgeWrapper>
      {removed ? (
        <MouseoverTooltip text={<span>Your position has 0 liquidity, and is not earning fees.</span>}>
          <Badge variant={BadgeVariant.DEFAULT}>
            <AlertCircle width={14} height={14} />
            &nbsp;
            <BadgeText>
              <span>Closed</span>
            </BadgeText>
          </Badge>
        </MouseoverTooltip>
      ) : inRange ? (
        <MouseoverTooltip
          text={
            <span>The price of this pool is within your selected range. Your position is currently earning fees.</span>
          }
        >
          <Badge variant={BadgeVariant.DEFAULT}>
            <ActiveDot /> &nbsp;
            <BadgeText>
              <span>In range</span>
            </BadgeText>
          </Badge>
        </MouseoverTooltip>
      ) : (
        <MouseoverTooltip
          text={
            <span>
              The price of this pool is outside of your selected range. Your position is not currently earning fees.
            </span>
          }
        >
          <Badge variant={BadgeVariant.WARNING}>
            <AlertCircle width={14} height={14} />
            &nbsp;
            <BadgeText>
              <span>Out of range</span>
            </BadgeText>
          </Badge>
        </MouseoverTooltip>
      )}
    </BadgeWrapper>
  )
}
