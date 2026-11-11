import { Card, PageHeader } from '../../components/app/ui'

/**
 * Temporary destination for workspace sections that land with the operations
 * schema. It states the truth rather than showing empty tables that look
 * broken.
 */
export default function PendingFeaturePage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <div className="state">
          <h2>Not wired up yet</h2>
          <p>
            This section needs the operations schema (donations, allocations,
            routes). Until those endpoints exist it stays empty on purpose
            instead of showing invented figures.
          </p>
        </div>
      </Card>
    </>
  )
}
