import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface MonthlyData {
  month: string
  collected: number
  outstanding: number
}

interface MonthlyTrendChartProps {
  data: MonthlyData[]
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Monthly Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8" role="status">
            No data yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Monthly Collections
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-label="Monthly collections trend chart" role="img">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="collected"
                stroke="#22c55e"
                name="Collected"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="outstanding"
                stroke="#ef4444"
                name="Outstanding"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
