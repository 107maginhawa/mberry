import {
  ClipboardList,
  Star,
  BarChart3,
  Users,
  Zap,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@monobase/ui'

export interface SurveyTemplate {
  id: string
  name: string
  description: string
  icon: React.ElementType
  surveyType: 'nps' | 'satisfaction' | 'poll' | 'custom'
  questions: Array<{
    type: 'nps' | 'rating' | 'single_choice' | 'multi_choice' | 'text' | 'yes_no'
    text: string
    required: boolean
    options?: string[]
  }>
}

const TEMPLATES: SurveyTemplate[] = [
  {
    id: 'post-event',
    name: 'Post-Event Feedback',
    description: 'Gather feedback after events, seminars, or workshops',
    icon: Star,
    surveyType: 'custom',
    questions: [
      { type: 'rating', text: 'How would you rate this event overall?', required: true },
      { type: 'yes_no', text: 'Would you attend a similar event in the future?', required: true },
      { type: 'text', text: 'What could we improve for next time?', required: false },
    ],
  },
  {
    id: 'post-training',
    name: 'Post-Training Evaluation',
    description: 'Evaluate CPD/CE training programs and sessions',
    icon: ClipboardList,
    surveyType: 'custom',
    questions: [
      { type: 'rating', text: 'How relevant was the training content to your practice?', required: true },
      { type: 'rating', text: 'How would you rate the instructor/facilitator?', required: true },
      { type: 'single_choice', text: 'Would you recommend this training to colleagues?', required: true, options: ['Strongly recommend', 'Recommend', 'Neutral', 'Would not recommend'] },
      { type: 'text', text: 'What topics would you like covered in future trainings?', required: false },
      { type: 'text', text: 'Any additional comments or suggestions?', required: false },
    ],
  },
  {
    id: 'nps',
    name: 'NPS Survey',
    description: 'Measure member satisfaction with Net Promoter Score',
    icon: BarChart3,
    surveyType: 'nps',
    questions: [
      { type: 'nps', text: 'How likely are you to recommend our association to a colleague?', required: true },
      { type: 'text', text: 'What is the primary reason for your score?', required: false },
    ],
  },
  {
    id: 'membership-satisfaction',
    name: 'Membership Satisfaction',
    description: 'Annual member satisfaction and engagement survey',
    icon: Users,
    surveyType: 'satisfaction',
    questions: [
      { type: 'nps', text: 'How likely are you to recommend membership to a colleague?', required: true },
      { type: 'rating', text: 'How satisfied are you with the value of your membership?', required: true },
      { type: 'rating', text: 'How satisfied are you with communication from the association?', required: true },
      { type: 'single_choice', text: 'Which benefit is most valuable to you?', required: true, options: ['CPD/CE credits', 'Networking events', 'Professional development', 'Advocacy', 'Publications'] },
      { type: 'text', text: 'What new services or benefits would you like to see?', required: false },
      { type: 'text', text: 'Any other feedback about your membership experience?', required: false },
    ],
  },
  {
    id: 'chapter-pulse',
    name: 'Chapter Pulse Check',
    description: 'Quarterly check-in on chapter health and member engagement',
    icon: Zap,
    surveyType: 'satisfaction',
    questions: [
      { type: 'nps', text: 'How would you rate your chapter experience this quarter?', required: true },
      { type: 'single_choice', text: 'How often did you participate in chapter activities?', required: true, options: ['Every event', 'Most events', 'Some events', 'Rarely', 'Not at all'] },
      { type: 'single_choice', text: 'What would increase your participation?', required: true, options: ['Better scheduling', 'More relevant topics', 'Online options', 'More social events', 'Other'] },
      { type: 'text', text: 'What is one thing your chapter does well?', required: false },
    ],
  },
  {
    id: 'quick-poll',
    name: 'Quick Poll',
    description: 'Single-question poll for quick decisions',
    icon: MessageCircle,
    surveyType: 'poll',
    questions: [
      { type: 'single_choice', text: 'Your question here', required: true, options: ['Option 1', 'Option 2', 'Option 3'] },
    ],
  },
]

interface SurveyTemplatesProps {
  onSelect: (template: SurveyTemplate) => void
  onSkip: () => void
}

export function SurveyTemplates({ onSelect, onSkip }: SurveyTemplatesProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Start from a template</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Choose a template or start from scratch
          </p>
        </div>
        <Button variant="outline" onClick={onSkip}>
          Create Blank Survey
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="border rounded-lg p-4 hover:border-[var(--color-primary)] hover:bg-primary/5 transition-colors cursor-pointer group"
            onClick={() => onSelect(t)}
          >
            <div className="flex items-center gap-2 mb-2">
              <t.icon className="w-5 h-5 text-[var(--color-primary)]" />
              <span className="font-medium text-sm">{t.name}</span>
            </div>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              {t.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">
                {t.questions.length} question{t.questions.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              >
                Use Template
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
