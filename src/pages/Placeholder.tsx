export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <div className="bg-card border rounded-xl shadow-sm p-12 flex items-center justify-center text-muted-foreground italic">
        {title} content is coming soon...
      </div>
    </div>
  )
}
