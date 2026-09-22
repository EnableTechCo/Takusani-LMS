import type { Workspace } from "@/modules/identity/navigation";
import { NavLink } from "./nav-link";
import { navIcon } from "./nav-presentation";

function Items({ workspace }: { workspace: Workspace }) {
  return (
    <ul className="sidenav__list">
      {workspace.items.map((item, index) => (
        <li key={item.href}>
          <NavLink exact={index === 0} href={item.href} icon={navIcon(item.href)} label={item.label} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Side navigation (UX section 3.3). One role: a flat list labelled by its workspace. Several: "My work" first,
 * then a heading per workspace. There is no role switcher.
 */
export function SideNav({ workspaces }: { workspaces: Workspace[] }) {
  if (workspaces.length === 0) {
    return (
      <nav aria-label="Main navigation" className="sidenav">
        <p className="text-small text-muted">No workspaces yet. Your roles are set by an administrator.</p>
      </nav>
    );
  }

  if (workspaces.length === 1) {
    return (
      <nav aria-label={workspaces[0].label} className="sidenav">
        <div className="sidenav__group">
          <Items workspace={workspaces[0]} />
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="sidenav">
      <div className="sidenav__group">
        <ul className="sidenav__list">
          <li>
            <NavLink exact href="/home" icon="house" label="My work" />
          </li>
        </ul>
      </div>
      {workspaces.map((workspace) => (
        <div className="sidenav__group" key={workspace.id}>
          <h2 className="sidenav__heading">{workspace.label}</h2>
          <Items workspace={workspace} />
        </div>
      ))}
    </nav>
  );
}
