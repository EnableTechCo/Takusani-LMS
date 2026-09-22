import { ButtonLink } from "@/components/ui/link";

export const metadata = { title: "Page not found" };

// G-08 system state: not found, which is also the answer for anything outside your scope (SRS 5.3).
export default function NotFound() {
  return (
    <main className="page page--prose" id="main" tabIndex={-1}>
      <header className="page-header">
        <h1 className="page-header__title">Page not found</h1>
        <p className="page-header__lead">
          This page does not exist, or it is not part of your work. Check the address, or go back to your home page.
        </p>
      </header>
      <ButtonLink href="/" variant="primary">
        Go to your home page
      </ButtonLink>
    </main>
  );
}
