import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import {
  Button,
  TextField,
  Checkbox,
  Switch,
  Card,
  EmptyState,
  ErrorState,
  Chip,
  Badge,
  Tabs,
} from "@legalir/ui";

// Wrap components that need theme context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <div dir="rtl">{children}</div>;
}

describe("Button", () => {
  it("renders with label", () => {
    render(
      <TestWrapper>
        <Button>کلیک کنید</Button>
      </TestWrapper>
    );
    expect(screen.getByRole("button", { name: /کلیک کنید/ })).toBeInTheDocument();
  });

  it("renders disabled state", () => {
    render(
      <TestWrapper>
        <Button disabled>غیرفعال</Button>
      </TestWrapper>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders loading state", () => {
    render(
      <TestWrapper>
        <Button loading>در حال ارسال</Button>
      </TestWrapper>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick", () => {
    const handleClick = vi.fn();
    render(
      <TestWrapper>
        <Button onClick={handleClick}>کلیک</Button>
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("TextField", () => {
  it("renders with label", () => {
    render(
      <TestWrapper>
        <TextField label="نام" />
      </TestWrapper>
    );
    expect(screen.getByLabelText("نام")).toBeInTheDocument();
  });

  it("displays error text", () => {
    render(
      <TestWrapper>
        <TextField label="ایمیل" errorText="ایمیل نامعتبر است" />
      </TestWrapper>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("ایمیل نامعتبر است");
  });

  it("shows character count", () => {
    render(
      <TestWrapper>
        <TextField label="توضیحات" maxLength={200} showCharCount value="سلام" onChange={/* noop */ () => undefined} />
      </TestWrapper>
    );
    expect(screen.getByText("4/200")).toBeInTheDocument();
  });
});

describe("Checkbox", () => {
  it("renders with label", () => {
    render(
      <TestWrapper>
        <Checkbox label="قبول دارم" />
      </TestWrapper>
    );
    expect(screen.getByLabelText("قبول دارم")).toBeInTheDocument();
  });

  it("can be checked", () => {
    function Controlled() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          label="موافقت"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
      );
    }
    render(
      <TestWrapper>
        <Controlled />
      </TestWrapper>
    );
    const checkbox = screen.getByLabelText("موافقت");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});

describe("Switch", () => {
  it("renders with label", () => {
    render(
      <TestWrapper>
        <Switch label="اعلان‌ها" />
      </TestWrapper>
    );
    expect(screen.getByRole("switch", { name: "اعلان‌ها" })).toBeInTheDocument();
  });

  it("toggles state", () => {
    function Controlled() {
      const [on, setOn] = useState(false);
      return <Switch label="فعال" checked={on} onChange={(e) => setOn(e.target.checked)} />;
    }
    render(
      <TestWrapper>
        <Controlled />
      </TestWrapper>
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(sw).toBeChecked();
  });
});

describe("Card", () => {
  it("renders content", () => {
    render(
      <TestWrapper>
        <Card>
          <p>محتوای کارت</p>
        </Card>
      </TestWrapper>
    );
    expect(screen.getByText("محتوای کارت")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and action", () => {
    render(
      <TestWrapper>
        <EmptyState
          title="خالی است"
          description="هنوز چیزی نیست"
          action={{ label: "ساخت", onClick: /* noop */ () => undefined }}
        />
      </TestWrapper>
    );
    expect(screen.getByText("خالی است")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ساخت" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders with retry button", () => {
    const onRetry = vi.fn();
    render(
      <TestWrapper>
        <ErrorState onRetry={onRetry} />
      </TestWrapper>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تلاش مجدد/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("Chip", () => {
  it("renders label", () => {
    render(
      <TestWrapper>
        <Chip label="برچسب" />
      </TestWrapper>
    );
    expect(screen.getByText("برچسب")).toBeInTheDocument();
  });

  it("calls onRemove when removable", () => {
    const onRemove = vi.fn();
    render(
      <TestWrapper>
        <Chip label="قابل حذف" removable onRemove={onRemove} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByLabelText("حذف قابل حذف"));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("Badge", () => {
  it("renders content", () => {
    render(
      <TestWrapper>
        <Badge content={5} variant="error">
          <span>پیام</span>
        </Badge>
      </TestWrapper>
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders dot mode", () => {
    const { container: _container } = render(
      <TestWrapper>
        <Badge dot variant="success">
          <span>status</span>
        </Badge>
      </TestWrapper>
    );
    // Dot badge should not have text content, just a dot
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("Tabs", () => {
  it("renders tab labels", () => {
    render(
      <TestWrapper>
        <Tabs
          tabs={[
            { value: "1", label: "تب اول" },
            { value: "2", label: "تب دوم" },
          ]}
          value="1"
          onChange={/* noop */ () => undefined}
        />
      </TestWrapper>
    );
    expect(screen.getByText("تب اول")).toBeInTheDocument();
    expect(screen.getByText("تب دوم")).toBeInTheDocument();
  });

  it("marks active tab as selected", () => {
    render(
      <TestWrapper>
        <Tabs
          tabs={[
            { value: "a", label: "فعال" },
            { value: "b", label: "غیرفعال" },
          ]}
          value="a"
          onChange={/* noop */ () => undefined}
        />
      </TestWrapper>
    );
    expect(screen.getByRole("tab", { name: "فعال" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "غیرفعال" })).toHaveAttribute("aria-selected", "false");
  });
});
