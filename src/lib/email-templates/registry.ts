import type { ComponentType } from 'react'
import { template as startupSubmissionNotification } from './startup-submission-notification'
import { template as skillsAutoPublished } from './skills-auto-published'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'startup-submission-notification': startupSubmissionNotification,
  'skills-auto-published': skillsAutoPublished,
}
