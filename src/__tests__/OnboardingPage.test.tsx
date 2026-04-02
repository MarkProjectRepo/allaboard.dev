import { render, screen, fireEvent, act } from "@testing-library/react";
import OnboardingPage from "@/app/onboarding/page";

const mockBoards = [
  { id: "kilter-original",  name: "Kilter Board (Original)" },
  { id: "moonboard-2016",   name: "Moonboard 2016" },
  { id: "tension-board-1",  name: "Tension Board 1 (TB1)" },
];

function setupFetch({ handleAvailable = true, submitOk = true } = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if ((url as string).includes("/api/boards")) {
      return Promise.resolve({ json: () => Promise.resolve(mockBoards) });
    }
    if ((url as string).includes("/api/users/check-handle")) {
      return Promise.resolve({
        json: () => Promise.resolve({ available: handleAvailable }),
      });
    }
    if ((url as string).includes("/api/onboarding")) {
      return Promise.resolve({ ok: submitOk, json: () => Promise.resolve({ error: "Handle taken" }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
}

// jsdom emits a console.error whenever window.location is mutated because it
// tries to navigate. Suppress that specific "not implemented" noise here so it
// doesn't pollute test output. The underlying assertions still work correctly.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const err = args[0];
    if (err && typeof err === "object" && (err as { type?: string }).type === "not implemented") return;
    originalConsoleError(...args);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).location;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).location = { href: "" };
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  setupFetch();
  window.location.href = "";
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("OnboardingPage — form structure", () => {
  it("renders the display name input", async () => {
    // wrap in act so the async board fetch settles before the assertion
    await act(async () => { render(<OnboardingPage />); });
    expect(screen.getByPlaceholderText(/e\.g\. Alex Sends/i)).toBeInTheDocument();
  });

  it("renders all three default boards as radio options", async () => {
    render(<OnboardingPage />);
    expect(await screen.findByText("Kilter Board (Original)")).toBeInTheDocument();
    expect(screen.getByText("Moonboard 2016")).toBeInTheDocument();
    expect(screen.getByText("Tension Board 1 (TB1)")).toBeInTheDocument();
  });

  it("submit button is disabled before a handle has been validated", async () => {
    render(<OnboardingPage />);
    await screen.findByText("Kilter Board (Original)");
    expect(screen.getByText("Start climbing")).toBeDisabled();
  });
});

describe("OnboardingPage — handle availability", () => {
  it("shows the derived handle as the user types a display name", async () => {
    render(<OnboardingPage />);
    await screen.findByText("Kilter Board (Original)");
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Sends/i), {
      target: { value: "Alex Sends" },
    });
    expect(screen.getByText("@alex_sends")).toBeInTheDocument();
  });

  it("shows 'Available' and enables submit after the debounce when the handle is free", async () => {
    render(<OnboardingPage />);
    await screen.findByText("Kilter Board (Original)");

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Sends/i), {
      target: { value: "Alex Sends" },
    });

    // Advance past the 400 ms debounce and flush promises
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(await screen.findByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Start climbing")).not.toBeDisabled();
  });

  it("shows 'Already taken' and keeps submit disabled when the handle is unavailable", async () => {
    setupFetch({ handleAvailable: false });
    render(<OnboardingPage />);
    await screen.findByText("Kilter Board (Original)");

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Sends/i), {
      target: { value: "Alex Sends" },
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(await screen.findByText("Already taken")).toBeInTheDocument();
    expect(screen.getByText("Start climbing")).toBeDisabled();
  });
});

describe("OnboardingPage — submission", () => {
  async function fillAndValidate() {
    render(<OnboardingPage />);
    await screen.findByText("Kilter Board (Original)");

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Sends/i), {
      target: { value: "Alex Sends" },
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await screen.findByText("Available");
  }

  it("calls the onboarding API with displayName and boardId on submit", async () => {
    await fillAndValidate();
    await act(async () => {
      fireEvent.submit(screen.getByText("Start climbing").closest("form")!);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/onboarding",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Alex Sends"),
      }),
    );
  });

  it("redirects to '/' after a successful submission", async () => {
    await fillAndValidate();
    await act(async () => {
      fireEvent.submit(screen.getByText("Start climbing").closest("form")!);
    });
    expect(window.location.href).toMatch(/\/$/);  // jsdom normalizes "/" → "http://localhost/"
  });
});
