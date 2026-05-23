import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface StatusDistribution {
  active: number
  dueSoon: number
  overdue: number
  lapsed: number
}

interface StatusDistributionChartProps {
  data: StatusDistribution
}

const COLORS = {
  active: '#22c55e',
  dueSoon: '#eab308',
  overdue: '#ef4444',
  lapsed: '#6b7280',
}

const LABELS: Record<string, string> = {
  active: 'Active',
  dueSoon: 'Due Soon',
  overdue: 'Overdue',
  lapsed: 'Lapsed',
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const total = data.active + data.dueSoon + data.overdue + data.lapsed

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Member Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8" role="status">
            No members yet
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: LABELS[key] ?? key,
      value,
      color: COLORS[key as keyof typeof COLORS],
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Member Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-label={`Member status distribution: ${total} total members`} role="img">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
