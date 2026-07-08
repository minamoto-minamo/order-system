import { Children, isValidElement, type ReactElement } from "react";
import { MenuQtyStepper } from "@/components/controls/MenuQtyStepper";
import { NoticeBanner } from "@/components/display/NoticeBanner";
import { Toast } from "@/components/display/Toast/Toast";

describe("Toast", () => {
  it("uses amber tokens by default", () => {
    const toast = Toast({ message: "saved" }) as ReactElement;

    expect(toast.props.className).toContain("border-amber-border");
    expect(toast.props.className).toContain("bg-amber-bg");
    expect(toast.props.className).toContain("text-amber-fg");
  });

  it("uses danger tokens for danger variant", () => {
    const toast = Toast({ message: "failed", variant: "danger" }) as ReactElement;

    expect(toast.props.className).toContain("border-danger-border");
    expect(toast.props.className).toContain("bg-danger-bg");
    expect(toast.props.className).toContain("text-danger");
  });
});

describe("NoticeBanner", () => {
  it("passes danger variant to Toast", () => {
    const banner = NoticeBanner({ variant: "danger", children: "failed" }) as ReactElement;

    expect(banner.type).toBe(Toast);
    expect(banner.props.variant).toBe("danger");
  });
});

describe("MenuQtyStepper", () => {
  it("keeps a 30px visual circle inside a 44px tap target", () => {
    const stepper = MenuQtyStepper({ qty: 0, onChange: () => undefined }) as ReactElement;
    const button = Children.toArray(stepper.props.children).find(isValidElement) as ReactElement;
    const visual = button.props.children as ReactElement;

    expect(button.props.className).toContain("min-w-11");
    expect(button.props.className).toContain("min-h-11");
    expect(visual.props.className).toContain("w-7.5");
    expect(visual.props.className).toContain("h-7.5");
  });
});
