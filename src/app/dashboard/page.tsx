export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
      <p className="text-muted-foreground mt-1">
        Overview of your PauseAI network.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">Total Contacts</p>
          <p className="mt-1 text-3xl font-bold">—</p>
        </div>
        <div className="rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">New This Month</p>
          <p className="mt-1 text-3xl font-bold">—</p>
        </div>
        <div className="rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">Active Members</p>
          <p className="mt-1 text-3xl font-bold">—</p>
        </div>
      </div>
    </div>
  )
}
