import { GlassCard } from '@/components/motion/glass-card'

const SAMPLE_DATA: Record<string, string> = {
  'member.name': 'Dr. Maria Santos',
  'org.name': 'Philippine Dental Association',
  'member.duesAmount': '\u20B12,500',
  'member.memberNumber': 'PDA-2024-0001',
}

function renderMergeFields(text: string): string {
  return text.replace(/\{\{(\w+\.\w+)\}\}/g, (_, key) => SAMPLE_DATA[key] ?? `{{${key}}}`)
}

interface TemplatePreviewProps {
  body: string
  subject?: string
}

export function TemplatePreview({ body, subject }: TemplatePreviewProps) {
  const renderedBody = renderMergeFields(body)
  const renderedSubject = subject ? renderMergeFields(subject) : undefined

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">Preview</h3>
      <GlassCard className="p-5 space-y-3">
        {renderedSubject && (
          <div>
            <p className="text-xs font-medium text-[var(--color-muted)] mb-1">Subject</p>
            <p className="text-sm font-medium">{renderedSubject}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-[var(--color-muted)] mb-1">Body</p>
          <p className="text-sm whitespace-pre-wrap">{renderedBody}</p>
        </div>
      </GlassCard>
    </div>
  )
}
