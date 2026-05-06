import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "../components/card"

export const Default = () => (
  <Tabs defaultValue="overview" className="w-[400px]">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="dues">Dues</TabsTrigger>
      <TabsTrigger value="events">Events</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Member overview information goes here.</p>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="dues">
      <Card>
        <CardHeader>
          <CardTitle>Dues</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Dues payment history and status.</p>
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="events">
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Upcoming and past events.</p>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
)

export const TwoTabs = () => (
  <Tabs defaultValue="account" className="w-[400px]">
    <TabsList>
      <TabsTrigger value="account">Account</TabsTrigger>
      <TabsTrigger value="settings">Settings</TabsTrigger>
    </TabsList>
    <TabsContent value="account">
      <p className="text-sm text-muted-foreground pt-4">
        Your account information is displayed here.
      </p>
    </TabsContent>
    <TabsContent value="settings">
      <p className="text-sm text-muted-foreground pt-4">
        Configure your settings here.
      </p>
    </TabsContent>
  </Tabs>
)

export const WithDisabledTab = () => (
  <Tabs defaultValue="tab1" className="w-[400px]">
    <TabsList>
      <TabsTrigger value="tab1">Active Tab</TabsTrigger>
      <TabsTrigger value="tab2" disabled>Disabled Tab</TabsTrigger>
      <TabsTrigger value="tab3">Another Tab</TabsTrigger>
    </TabsList>
    <TabsContent value="tab1">
      <p className="pt-4">Content for active tab.</p>
    </TabsContent>
    <TabsContent value="tab2">
      <p className="pt-4">This tab is disabled.</p>
    </TabsContent>
    <TabsContent value="tab3">
      <p className="pt-4">Content for another tab.</p>
    </TabsContent>
  </Tabs>
)
