/** Page title block (.page-header). Use inside <div className="page">. */
export function PageHeader({ workspace, title, lead }: { workspace?: string; title: string; lead?: string }) {
  return (
    <header className="page-header">
      {workspace ? <p className="page-header__workspace">{workspace}</p> : null}
      <h1 className="page-header__title">{title}</h1>
      {lead ? <p className="page-header__lead">{lead}</p> : null}
    </header>
  );
}
