// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Captcha } from "./captcha";
import "./test-dom";

describe("Captcha (S3-06)", () => {
  it("renders nothing until a site key is set", () => {
    const { container } = render(<Captcha siteKey={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the Turnstile widget with the site key when one is set", () => {
    const { container } = render(<Captcha siteKey="1x00000000000000000000AA" />);
    expect(container.querySelector(".cf-turnstile")).toHaveAttribute("data-sitekey", "1x00000000000000000000AA");
  });
});
