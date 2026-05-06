import { Button } from "../components/button"

export const Default = () => <Button>Default Button</Button>

export const Destructive = () => (
  <Button variant="destructive">Destructive</Button>
)

export const Outline = () => <Button variant="outline">Outline</Button>

export const Secondary = () => (
  <Button variant="secondary">Secondary</Button>
)

export const Ghost = () => <Button variant="ghost">Ghost</Button>

export const Link = () => <Button variant="link">Link</Button>

export const Small = () => <Button size="sm">Small</Button>

export const Large = () => <Button size="lg">Large</Button>

export const Icon = () => <Button size="icon">+</Button>

export const Loading = () => (
  <Button disabled>Loading...</Button>
)

export const AllVariants = () => (
  <div className="flex flex-wrap gap-2">
    <Button>Default</Button>
    <Button variant="destructive">Destructive</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Link</Button>
    <Button size="sm">Small</Button>
    <Button size="lg">Large</Button>
    <Button disabled>Disabled</Button>
  </div>
)
