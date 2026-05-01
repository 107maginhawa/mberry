import { createFileRoute } from '@tanstack/react-router'
import { ToggleLeft } from 'lucide-react'

export const Route = createFileRoute('/feature-flags/')({
  component: FeatureFlagsPage,
})

const placeholderModules = [
  'person',
  'booking',
  'billing',
  'audit',
  'notifs',
  'comms',
  'storage',
  'email',
  'reviews',
]

function TogglePlaceholder({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={`w-10 h-6 rounded-full flex items-center px-1 ${
        enabled ? 'bg-green-500 justify-end' : 'bg-muted justify-start'
      }`}
    >
      <div className="w-4 h-4 rounded-full bg-white shadow" />
    </div>
  )
}

function FeatureFlagsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <ToggleLeft className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Module x target matrix &mdash; control which modules are enabled per
            scope
          </p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                Module
              </th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">
                Global
              </th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">
                Per Association
              </th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">
                Per Organization
              </th>
            </tr>
          </thead>
          <tbody>
            {placeholderModules.map((mod) => (
              <tr key={mod} className="border-b last:border-b-0">
                <td className="p-4 text-sm font-medium">{mod}</td>
                <td className="p-4">
                  <div className="flex justify-center">
                    <TogglePlaceholder enabled={true} />
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex justify-center">
                    <TogglePlaceholder enabled={false} />
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex justify-center">
                    <TogglePlaceholder enabled={false} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground mt-4">
        Toggles are read-only placeholders. Connect SDK to enable live control.
      </p>
    </div>
  )
}
