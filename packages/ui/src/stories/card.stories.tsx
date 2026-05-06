import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/card"
import { Button } from "../components/button"

export const Default = () => (
  <Card className="w-[350px]">
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
      <CardDescription>
        Card description with supporting text that explains the purpose of this
        card component.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p>Card content goes here. This is the main body of the card.</p>
    </CardContent>
    <CardFooter className="flex justify-between">
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </CardFooter>
  </Card>
)

export const Simple = () => (
  <Card className="w-[300px]">
    <CardHeader>
      <CardTitle>Simple Card</CardTitle>
    </CardHeader>
    <CardContent>
      <p>Minimal card with just header and content.</p>
    </CardContent>
  </Card>
)

export const WithoutFooter = () => (
  <Card className="w-[350px]">
    <CardHeader>
      <CardTitle>No Footer</CardTitle>
      <CardDescription>A card with header and content only.</CardDescription>
    </CardHeader>
    <CardContent>
      <p>No footer section in this variant.</p>
    </CardContent>
  </Card>
)
