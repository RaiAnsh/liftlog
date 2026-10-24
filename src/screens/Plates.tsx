import { BackBar, Title } from '../components/PageHeader'
import PlateCalculator from '../components/PlateCalculator'

export default function Plates() {
  return (
    <div className="space-y-3">
      <BackBar />
      <Title sub="What to load on each side">Plate calculator</Title>
      <PlateCalculator />
    </div>
  )
}
