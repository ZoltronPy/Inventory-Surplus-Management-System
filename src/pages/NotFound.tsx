import { Link } from 'react-router-dom'
import { Home, PackageX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-5">
      <PackageX className="w-16 h-16 text-muted-foreground/30" />
      <div className="space-y-1">
        <h2 className="text-4xl font-bold text-muted-foreground/50">404</h2>
        <p className="text-lg font-semibold">Page not found</p>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or was moved.
        </p>
      </div>
      <Link
        to="/dashboard"
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Home className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  )
}
