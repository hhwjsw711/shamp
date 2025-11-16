import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface AnalyticsCardProps {
  icon: ReactNode
  name: string
  value: ReactNode
}

export default function AnalyticsCard({ icon, name, value }: AnalyticsCardProps) {
  return (
    <Card className="flex flex-col gap-0 p-0 rounded-[24px] border-0 shadow-none">
      <section className="flex flex-row items-center gap-4 py-2 px-4">
        {icon}
        <span>{name}</span>
      </section>
      <section className="p-2">
        <section className="p-2 bg-zinc-100 rounded-2xl">
          {value}
        </section>
      </section>
    </Card>
  )
}

