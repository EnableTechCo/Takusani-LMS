import Link from "next/link";
import { INSTITUTION } from "@/config/institution";
import { Icon } from "@/components/ui/icons";
import type { AccountSummary } from "@/modules/identity/access";

/** The account menu in the top bar (UX section 3.7): who you are, your roles, appearance, help and sign out. */
export function AccountMenu({ account }: { account: AccountSummary }) {
  return (
    <details className="menu-wrap">
      <summary aria-label={`Account menu for ${account.name}`} className="btn btn--ghost btn--icon">
        <span aria-hidden="true" className="avatar">
          {account.initials}
        </span>
      </summary>
      <div className="menu menu--end">
        <div className="account__identity">
          <p className="account__name">{account.name}</p>
          <p className="account__email">{account.email}</p>
          <ul className="account__roles">
            {account.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <Link className="menu__item" href="/account">
          <Icon name="user" />
          Profile
        </Link>
        <Link className="menu__item" href="/notifications">
          <Icon name="bell" />
          Notification preferences
        </Link>
        <div className="menu__section">
          <fieldset className="fieldset">
            <legend className="fieldset__legend">Appearance</legend>
            <div className="segmented">
              <label className="segmented__option">
                <input defaultChecked name="theme" type="radio" value="light" />
                <span>Light</span>
              </label>
              <label className="segmented__option">
                <input name="theme" type="radio" value="dark" />
                <span>Dark</span>
              </label>
              <label className="segmented__option">
                <input name="theme" type="radio" value="auto" />
                <span>System</span>
              </label>
            </div>
          </fieldset>
        </div>
        <div className="menu__divider" role="separator" />
        <a className="menu__item" href={`mailto:${INSTITUTION.helpEmail}`}>
          <Icon name="help" />
          Help
        </a>
        <form action="/auth/sign-out" method="post">
          <button className="menu__item" type="submit">
            <Icon name="sign-out" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
