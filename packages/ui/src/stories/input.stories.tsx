import { Input } from "../components/input"
import { Label } from "../components/label"

export const Default = () => <Input placeholder="Enter text..." />

export const WithLabel = () => (
  <div className="flex flex-col gap-2 w-[300px]">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" placeholder="you@example.com" />
  </div>
)

export const Disabled = () => (
  <Input placeholder="Disabled input" disabled />
)

export const Password = () => (
  <Input type="password" placeholder="Enter password" />
)

export const Number = () => (
  <Input type="number" placeholder="0" min={0} max={100} />
)

export const AllTypes = () => (
  <div className="flex flex-col gap-3 w-[300px]">
    <Input placeholder="Text input" />
    <Input type="email" placeholder="Email input" />
    <Input type="password" placeholder="Password input" />
    <Input type="number" placeholder="Number input" />
    <Input disabled placeholder="Disabled input" />
  </div>
)
