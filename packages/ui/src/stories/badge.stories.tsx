import { Badge } from "../components/badge"

export const Default = () => <Badge>Default</Badge>

export const Secondary = () => (
  <Badge variant="secondary">Secondary</Badge>
)

export const Destructive = () => (
  <Badge variant="destructive">Destructive</Badge>
)

export const Outline = () => <Badge variant="outline">Outline</Badge>

export const AllVariants = () => (
  <div className="flex flex-wrap gap-2">
    <Badge>Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
  </div>
)

export const InContext = () => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span>Status:</span>
      <Badge>Active</Badge>
    </div>
    <div className="flex items-center gap-2">
      <span>Role:</span>
      <Badge variant="secondary">Admin</Badge>
    </div>
    <div className="flex items-center gap-2">
      <span>Alert:</span>
      <Badge variant="destructive">Overdue</Badge>
    </div>
  </div>
)
