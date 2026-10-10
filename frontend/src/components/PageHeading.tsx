import type { ReactNode } from 'react';

export default function PageHeading({ title, description, action, provenance = 'Local preview', stage = 'Interface preview' }: {
  title: ReactNode; description: string; action?: ReactNode; provenance?: string; stage?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="provenance-badge"><span />{provenance}<span className="badge-divider">/</span>{stage}</div>
        <h1>{title}</h1><p>{description}</p>
      </div>
      {action}
    </div>
  );
}
