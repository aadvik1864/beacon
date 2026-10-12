import type { ReactNode } from 'react';

export default function PageHeading({ title, description, action }: {
  title: ReactNode; description?: string; action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>{description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
