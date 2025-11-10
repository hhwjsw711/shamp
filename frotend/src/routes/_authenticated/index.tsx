import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  component: App,
})

function App() {
  return (
    <section className="flex flex-col gap-2 p-4">
      <h1>Hello World</h1>
    </section>
  )
}
