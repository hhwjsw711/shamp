import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useTranslation } from 'react-i18next'
import type { ChartConfig } from "@/components/ui/chart"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card } from "@/components/ui/card"

interface VendorPerformanceData {
  vendorId: string
  businessName: string
  ticketCount: number
  averageResponseTimeHours: number | null
  averageFixTimeHours: number | null
}

interface VendorPerformanceChartProps {
  data: Array<VendorPerformanceData>
}

export default function VendorPerformanceChart({
  data,
}: VendorPerformanceChartProps) {
  const { t } = useTranslation()

  // Limit to top 5 vendors for better readability
  const topVendors = data.slice(0, 5)

  // Prepare chart data - show empty state if no vendors
  const chartData = topVendors.length > 0
    ? topVendors.map((vendor) => ({
        vendor: vendor.businessName.length > 15
          ? `${vendor.businessName.substring(0, 15)}...`
          : vendor.businessName,
        responseTime: vendor.averageResponseTimeHours ?? 0,
        fixTime: vendor.averageFixTimeHours ?? 0,
        tickets: vendor.ticketCount,
      }))
    : [
        {
          vendor: t($ => $.dashboard.vendorPerformance.noVendorsYet),
          responseTime: 0,
          fixTime: 0,
          tickets: 0,
        },
      ]

  const chartConfig = {
    responseTime: {
      label: t($ => $.dashboard.vendorPerformance.responseTime),
      color: "hsl(var(--chart-1))",
    },
    fixTime: {
      label: t($ => $.dashboard.vendorPerformance.fixTime),
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  return (
    <Card className="flex flex-col gap-0 p-0 rounded-[24px] border-0 shadow-none">
      <section className="flex flex-col gap-1 py-2 px-4">
        <h3>{t($ => $.dashboard.vendorPerformance.title)}</h3>
        <p className="text-xs text-muted-foreground">{t($ => $.dashboard.vendorPerformance.description)}</p>
      </section>
      <section className="p-2">
        <section className="p-2 bg-zinc-100 rounded-2xl">
          <section className="w-full">
            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="vendor"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}h`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `${t($ => $.dashboard.vendorPerformance.vendorLabel)}: ${value}`}
                  formatter={(value, name) => {
                    const key = name as keyof typeof chartConfig
                    const config = chartConfig[key]
                    return [
                      `${Number(value).toFixed(2)} ${t($ => $.dashboard.vendorPerformance.hours)}`,
                      config.label,
                    ]
                  }}
                />
              }
            />
            <Bar
              dataKey="responseTime"
              fill="var(--color-responseTime)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="fixTime"
              fill="var(--color-fixTime)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
        </section>
        </section>
      </section>
    </Card>
  )
}

