import { render, screen } from "@testing-library/react";
import GradeBadge from "@/components/GradeBadge";

describe("GradeBadge", () => {
  it("renders the grade label", () => {
    render(<GradeBadge grade="V5" />);
    expect(screen.getByText("V5")).toBeInTheDocument();
  });
});
