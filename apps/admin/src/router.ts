export interface AdminUser {
  email: string
  name: string
  role: 'super' | 'support' | 'analyst'
}

export interface RouterContext {
  auth: {
    user: AdminUser | null
    loading: boolean
  }
}
