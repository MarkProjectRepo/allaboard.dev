import { render, screen, act } from "@testing-library/react";
import FeedClient from "@/app/FeedClient";
import { useAuth } from "@/lib/auth-context";
import { getFeedActivities } from "@/lib/db";
import type { FeedActivity, User } from "@/lib/types";

jest.mock("@/lib/auth-context");
jest.mock("@/lib/db");

// IntersectionObserver is not implemented in jsdom.
global.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

const mockUseAuth = jest.mocked(useAuth);
const mockGetFeedActivities = jest.mocked(getFeedActivities);

const feedUser: User = {
  id: "climber1",
  handle: "climber1",
  displayName: "Climber One",
  avatarColor: "bg-orange-500",
  bio: "",
  homeBoard: "Kilter Board (Original)",
  homeBoardAngle: 40,
  joinedAt: "2026-01-01T00:00:00.000Z",
  followersCount: 0,
  followingCount: 0,
  personalBests: {},
};

const loggedInUser: User = {
  id: "me",
  handle: "me",
  displayName: "Me",
  avatarColor: "bg-blue-500",
  bio: "",
  homeBoard: "Kilter Board (Original)",
  homeBoardAngle: 40,
  joinedAt: "2026-01-01T00:00:00.000Z",
  followersCount: 0,
  followingCount: 0,
  personalBests: {},
};

const mockActivity: FeedActivity = {
  id: "tick-1",
  date: "2026-04-01",
  sent: true,
  rating: 3,
  attempts: 5,
  comment: "Great problem!",
  user: feedUser,
  climb: {
    id: "climb-1",
    name: "Test Problem",
    grade: "V5",
    boardId: "kilter-original",
    boardName: "Kilter Board (Original)",
    angle: 40,
    description: "",
    author: "climber1",
    sends: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("FeedClient — tab visibility", () => {
  beforeEach(() => {
    mockGetFeedActivities.mockResolvedValue({ activities: [], hasMore: false });
  });

  it("always shows the 'All Activity' tab", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn(), updateUser: jest.fn() });
    await act(async () => { render(<FeedClient />); });
    expect(screen.getByText("All Activity")).toBeInTheDocument();
  });

  it("does not show the 'Following' tab when logged out", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn(), updateUser: jest.fn() });
    await act(async () => { render(<FeedClient />); });
    expect(screen.queryByText("Following")).not.toBeInTheDocument();
  });

  it("shows the 'Following' tab when logged in", async () => {
    mockUseAuth.mockReturnValue({ user: loggedInUser, loading: false, logout: jest.fn(), updateUser: jest.fn() });
    await act(async () => { render(<FeedClient />); });
    expect(screen.getByText("Following")).toBeInTheDocument();
  });
});

describe("FeedClient — activity cards", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn(), updateUser: jest.fn() });
    mockGetFeedActivities.mockResolvedValue({ activities: [mockActivity], hasMore: false });
  });

  it("renders the climb name from the API response", async () => {
    render(<FeedClient />);
    expect(await screen.findByText("Test Problem")).toBeInTheDocument();
  });

  it("renders 'Sent' for completed ticks", async () => {
    render(<FeedClient />);
    await screen.findByText("Test Problem");
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("renders the user's handle as a link to their profile page", async () => {
    render(<FeedClient />);
    const handle = await screen.findByText("@climber1");
    expect(handle.closest("a")).toHaveAttribute("href", "/user/climber1");
  });

  it("renders 'Working' for ticks where sent is false", async () => {
    mockGetFeedActivities.mockResolvedValue({ activities: [{ ...mockActivity, sent: false }], hasMore: false });
    render(<FeedClient />);
    await screen.findByText("Working");
  });

  it("shows a comment when one is present", async () => {
    render(<FeedClient />);
    expect(await screen.findByText("Great problem!")).toBeInTheDocument();
  });

  it("shows 'No activity yet.' when the feed is empty", async () => {
    mockGetFeedActivities.mockResolvedValue({ activities: [], hasMore: false });
    render(<FeedClient />);
    expect(await screen.findByText("No activity yet.")).toBeInTheDocument();
  });
});
