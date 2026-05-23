import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

interface CollectionRateCardProps {
  /** Current 30-day trailing collection rate (0-100 integer) */
  currentRate: number
  /** Previous 30-day trailing collection rate for trend comparison */
  previousRate: number
}

export function CollectionRateCard({ currentRate, previousRate }: CollectionRateCardProps) {
  const diff = currentRate - previousRate
  const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Collection Rate (30d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold" aria-label={`Collection rate ${currentRate} percent`}>
            {currentRate}%
          </span>
          <TrendIndicator trend={trend} diff={diff} />
        </div>
      </CardContent>
    </Card>
  )
}

function TrendIndicator({ trend, diff }: { trend: 'up' | 'down' | 'flat'; diff: number }) {
  if (trend === 'up') {
    return (
      <span className="flex items-center text-sm text-green-600" aria-label={`Up ${diff} points`}>
        <ArrowUp className="h-4 w-4" />
        +{diff}
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center text-sm text-red-600" aria-label={`Down ${Math.abs(diff)} points`}>
        <ArrowDown className="h-4 w-4" />
        {diff}
      </span>
    )
  }
  return (
    <span className="flex items-center text-sm text-muted-foreground" aria-label="No change">
      <Minus className="h-4 w-4" />
    </span>
  )
}
