import { INSTITUTION } from "@/config/institution";
import { Menu, MenuButton, MenuDivider, MenuLink, MenuSection } from "@/components/ui/menu";
import type { Theme } from "@/lib/theme";
import type { AccountSummary } from "@/modules/identity/access";
import { ThemeControl } from "./theme-control";

/** The account menu in the top bar (UX section 3.7): who you are, your roles, appearance, help and sign out. */
export function AccountMenu({ account, theme }: { account: AccountSummary; theme: Theme }) {
  return (
    <Menu
      align="end"
      label={`Account menu for ${account.name}`}
      trigger={
        <span aria-hidden="true" className="avatar">
          {account.initials}
        </span>
      }
    >
      <div className="account__identity">
        <p className="account__name">{account.name}</p>
        <p className="account__email">{account.email}</p>
        <ul className="account__roles">
          {account.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <MenuLink href="/account" icon="user">
        Profile
      </MenuLink>
      <MenuLink href="/notifications" icon="bell">
        Notification preferences
      </MenuLink>
      <MenuSection>
        <ThemeControl current={theme} />
      </MenuSection>
      <MenuDivider />
      <MenuLink href={`mailto:${INSTITUTION.helpEmail}`} icon="help">
        Help
      </MenuLink>
      <form action="/auth/sign-out" method="post">
        <MenuButton icon="sign-out" type="submit">
          Sign out
        </MenuButton>
      </form>
    </Menu>
  );
}
