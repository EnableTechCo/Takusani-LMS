import { Icon } from "@/components/ui/icons";
import { PageHeader } from "./app-shell";

/** A destination in the navigation whose screen has not been designed or built yet. */
export function NotBuilt({ workspace, title }: { workspace: string; title: string }) {
  return (
    <div className="page">
      <PageHeader workspace={workspace} title={title} />
      <div className="card">
        <div className="empty">
          <span className="empty__icon">
            <Icon className="icon icon--lg" name="clock" />
          </span>
          <p className="empty__title">Not built yet</p>
          <p className="empty__body">This screen arrives with its feature. The navigation already points here.</p>
        </div>
      </div>
    </div>
  );
}
