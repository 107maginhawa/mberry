import { useState } from 'react'
import { GlassCard } from '@/components/motion/glass-card'
import { Button, Input, Textarea } from '@monobase/ui'
import { Smartphone, Monitor } from 'lucide-react'

const SAMPLE_DATA: Record<string, string> = {
  'member.name': 'Dr. Maria Santos',
  'org.name': 'Philippine Dental Association',
  'member.duesAmount': '₱2,500',
  'member.memberNumber': 'PDA-2024-0001',
}

interface TemplateSplitEditorProps {
  body: string
  subject?: string
  onChange: (body: string) => void
  onSubjectChange?: (subject: string) => void
}

/**
 * Split-pane template editor: left = raw content, right = live preview.
 * Merge fields render with sample data. Unknown fields highlighted.
 * Mobile toggle shows narrow-width preview.
 */
export function TemplateSplitEditor({ body, subject, onChange, onSubjectChange }: TemplateSplitEditorProps) {
  const [mobilePreview, setMobilePreview] = useState(false)

  return (
    <div data-testid="split-editor" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Editor pane */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">Editor</h4>
        {onSubjectChange && (
          <Input
            aria-label="Subject"
            placeholder="Subject line..."
            value={subject ?? ''}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        )}
        <Textarea
          aria-label="Template body"
          className="min-h-[200px] font-mono resize-y"
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your template..."
        />
      </div>

      {/* Preview pane */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">Preview</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobilePreview(!mobilePreview)}
            aria-label={mobilePreview ? 'Desktop preview' : 'Mobile preview'}
            className="h-6 px-2"
          >
            {mobilePreview ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
          </Button>
        </div>
        <GlassCard className={`p-4 ${mobilePreview ? 'max-w-[375px] mx-auto' : ''}`}>
          {!body.trim() ? (
            <p className="text-sm text-[var(--color-muted)] italic">Start typing to see preview</p>
          ) : (
            <div className="space-y-2">
              {subject && (
                <p className="text-sm font-medium">{renderMergeFields(subject)}</p>
              )}
              <div className="text-sm whitespace-pre-wrap">
                {renderBody(body)}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

/** Render merge fields with sample data, highlight unknown fields */
function renderBody(text: string): React.ReactNode {
  const parts = text.split(/(\{\{[\w.]+\}\})/)
  return parts.map((part, i) => {
    const match = part.match(/^\{\{([\w.]+)\}\}$/)
    if (!match) return <span key={i}>{part}</span>
    const key = match[1] as string
    const value = SAMPLE_DATA[key]
    if (value) {
      return <span key={i} className="font-medium text-[var(--color-primary)]">{value}</span>
    }
    // Unknown merge field — highlight
    return (
      <span
        key={i}
        data-testid="unresolved-merge-field"
        className="bg-amber-100 text-amber-800 px-0.5 rounded text-xs font-mono"
      >
        {part}
      </span>
    )
  })
}

function renderMergeFields(text: string): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => SAMPLE_DATA[key] ?? `{{${key}}}`)
}
