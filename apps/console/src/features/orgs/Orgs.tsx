import { useNavigate } from '@tanstack/react-router'
import { useOrgs } from './use-orgs'
import { usePlatformStats } from './use-platform-stats'
import { useAssociations } from './use-associations'
import OrgsView from './OrgsView'

export default function Orgs() {
  const navigate = useNavigate()
  const { orgs, total, status: orgsStatus } = useOrgs()
  const { stats, status: statsStatus, hasSnapshot } = usePlatformStats()
  const { associations } = useAssociations()

  return (
    <OrgsView
      orgs={orgs}
      total={total}
      orgsStatus={orgsStatus}
      associationsCount={associations.length}
      stats={stats}
      statsStatus={statsStatus}
      hasSnapshot={hasSnapshot}
      onCreate={() => navigate({ to: '/orgs/new' })}
    />
  )
}
