import Badge, { BadgeVariant } from 'components/Badge'
import styled from 'styled-components/macro'

import { MouseoverTooltip } from '../../components/Tooltip'
import { AlertCircle } from 'react-feather'

const BadgeWrapper = styled.div`
  font-size: 14px;
  display: flex;
  justify-content: flex-end;
`

export default function InfoBadge({ helperText }: { helperText: string }) {
  return (
    <BadgeWrapper>
      <MouseoverTooltip text={<span>{helperText}</span>}>
        <Badge variant={BadgeVariant.DEFAULT}>
          <AlertCircle width={14} height={14} />
          &nbsp;
        </Badge>
      </MouseoverTooltip>
    </BadgeWrapper>
  )
}
