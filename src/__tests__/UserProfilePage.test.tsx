import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserProfilePage from "@/app/user/[handle]/page";
import { useAuth } from "@/lib/auth-context";
import {
  getUserById,
  getUserTicks,
  getFollowers,
  getFollowing,
  checkFollowing,
  followUser,
  unfollowUser,
} from "@/lib/db";
import type { User } from "@/lib/types";

jest.mock("@/lib/auth-context");
jest.mock("@/lib/db");
jest.mock("@/components/TickModal", () => ({ __esModule: true, default: () => null }));
jest.mock("next/navigation", () => ({
  useParams: jest.fn().mockReturnValue({ handle: "targetuser" }),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockGetUserById = jest.mocked(getUserById);
const mockGetUserTicks = jest.mocked(getUserTicks);
const mockGetFollowers = jest.mocked(getFollowers);
const mockGetFollowing = jest.mocked(getFollowing);
const mockCheckFollowing = jest.mocked(checkFollowing);
const mockFollowUser = jest.mocked(followUser);
const mockUnfollowUser = jest.mocked(unfollowUser);

const targetUser: User = {
  id: "targetuser",
  handle: "targetuser",
  displayName: "Target User",
  avatarColor: "bg-orange-500",
  bio: "I love climbing",
  homeBoard: "Kilter Board (Original)",
  homeBoardAngle: 40,
  joinedAt: "2026-01-01T00:00:00.000Z",
  followersCount: 12,
  followingCount: 5,
  personalBests: {},
};

const otherUser: User = {
  id: "otheruser",
  handle: "otheruser",
  displayName: "Other User",
  avatarColor: "bg-blue-500",
  bio: "",
  homeBoard: "Kilter Board (Original)",
  homeBoardAngle: 40,
  joinedAt: "2026-01-01T00:00:00.000Z",
  followersCount: 0,
  followingCount: 0,
  personalBests: {},
};

beforeEach(() => {
  mockGetUserById.mockResolvedValue(targetUser);
  mockGetUserTicks.mockResolvedValue([]);
  mockGetFollowers.mockResolvedValue([]);
  mockGetFollowing.mockResolvedValue([]);
  mockCheckFollowing.mockResolvedValue(false);
  mockFollowUser.mockResolvedValue(undefined);
  mockUnfollowUser.mockResolvedValue(undefined);
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve([
      { id: "kilter-original", name: "Kilter Board (Original)", type: "standard" },
    ]),
  });
});

describe("UserProfilePage — profile display", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn(), updateUser: jest.fn() });
  });

  it("shows the user's display name and handle", async () => {
    render(<UserProfilePage />);
    expect(await screen.findByText("Target User")).toBeInTheDocument();
    expect(screen.getByText("@targetuser")).toBeInTheDocument();
  });

  it("shows the user's bio", async () => {
    render(<UserProfilePage />);
    expect(await screen.findByText("I love climbing")).toBeInTheDocument();
  });

  it("shows the followers count in the stat tiles", async () => {
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
  });

  it("renders Ticks, Followers, and Following tabs with counts", async () => {
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    // Tab labels include counts — e.g. "Ticks (0)", "Followers (12)", "Following (5)"
    expect(screen.getByText("Ticks (0)")).toBeInTheDocument();
    expect(screen.getByText("Followers (12)")).toBeInTheDocument();
    expect(screen.getByText("Following (5)")).toBeInTheDocument();
  });

  it("shows 'No ticks yet.' when the tick list is empty", async () => {
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    expect(screen.getByText("No ticks yet.")).toBeInTheDocument();
  });
});

describe("UserProfilePage — own profile", () => {
  beforeEach(() => {
    // Current user is the profile being viewed
    mockUseAuth.mockReturnValue({ user: targetUser, loading: false, logout: jest.fn(), updateUser: jest.fn() });
  });

  it("does not show a Follow or Unfollow button on your own profile", async () => {
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    expect(screen.queryByText("Follow")).not.toBeInTheDocument();
    expect(screen.queryByText("Unfollow")).not.toBeInTheDocument();
  });

  it("shows the Detailed Stats link on your own profile", async () => {
    render(<UserProfilePage />);
    expect(await screen.findByText("Detailed Stats")).toBeInTheDocument();
  });

  it("shows an Unfollow button in the Following list on your own profile", async () => {
    mockGetFollowing.mockResolvedValue([otherUser]);
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    fireEvent.click(screen.getByText("Following (5)"));
    expect(await screen.findByText("Unfollow")).toBeInTheDocument();
  });

  it("removes a user from the Following list after clicking Unfollow", async () => {
    mockGetFollowing.mockResolvedValue([otherUser]);
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    fireEvent.click(screen.getByText("Following (5)"));
    fireEvent.click(await screen.findByText("Unfollow"));
    await waitFor(() =>
      expect(screen.queryByText("Other User")).not.toBeInTheDocument()
    );
    expect(mockUnfollowUser).toHaveBeenCalledWith("otheruser");
  });
});

describe("UserProfilePage — viewing another user's profile", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: otherUser, loading: false, logout: jest.fn(), updateUser: jest.fn() });
  });

  it("shows a Follow button when not yet following", async () => {
    mockCheckFollowing.mockResolvedValue(false);
    render(<UserProfilePage />);
    expect(await screen.findByText("Follow")).toBeInTheDocument();
  });

  it("shows an Unfollow button when already following", async () => {
    mockCheckFollowing.mockResolvedValue(true);
    render(<UserProfilePage />);
    expect(await screen.findByText("Unfollow")).toBeInTheDocument();
  });

  it("does not show the Detailed Stats link on another user's profile", async () => {
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    expect(screen.queryByText("Detailed Stats")).not.toBeInTheDocument();
  });

  it("calls followUser and switches button to Unfollow when Follow is clicked", async () => {
    mockCheckFollowing.mockResolvedValue(false);
    render(<UserProfilePage />);
    fireEvent.click(await screen.findByText("Follow"));
    await waitFor(() => expect(mockFollowUser).toHaveBeenCalledWith("targetuser"));
    expect(await screen.findByText("Unfollow")).toBeInTheDocument();
  });

  it("calls unfollowUser and switches button to Follow when Unfollow is clicked", async () => {
    mockCheckFollowing.mockResolvedValue(true);
    render(<UserProfilePage />);
    fireEvent.click(await screen.findByText("Unfollow"));
    await waitFor(() => expect(mockUnfollowUser).toHaveBeenCalledWith("targetuser"));
    expect(await screen.findByText("Follow")).toBeInTheDocument();
  });
});

describe("UserProfilePage — followers list", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn(), updateUser: jest.fn() });
  });

  it("shows followers after clicking the Followers tab", async () => {
    mockGetFollowers.mockResolvedValue([otherUser]);
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    fireEvent.click(screen.getByText("Followers (12)"));
    expect(await screen.findByText("Other User")).toBeInTheDocument();
  });

  it("shows 'No followers yet.' when the list is empty", async () => {
    render(<UserProfilePage />);
    await screen.findByText("Target User");
    fireEvent.click(screen.getByText("Followers (12)"));
    expect(screen.getByText("No followers yet.")).toBeInTheDocument();
  });
});
