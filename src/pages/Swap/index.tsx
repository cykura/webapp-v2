import JupiterForm from 'components/JupiterForm'
import { RouteComponentProps } from 'react-router-dom'
import AppBody from '../AppBody'

export default function Swap({ history }: RouteComponentProps) {
  return (
    <AppBody>
      <JupiterForm />
    </AppBody>
  )
}
