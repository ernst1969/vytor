import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
  acceptFriendRequest,
  getFriendRequests,
  getFriends,
  getFriendsFeed,
  searchUsers,
} from "@/services/api";

type User = {
  id: number;
  username: string;
};

type FriendRequest = {
  id: number;
  user: User;
  createdAt: string;
};

type Friend = User;

type FeedWorkout = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  user: User;
  template: {
    id: number;
    name: string;
  } | null;
  exercises: Array<{
    id: number;
    exercise: {
      id: number;
      name: string;
    };
    sets: Array<{
      id: number;
      weight: number | null;
      reps: number | null;
    }>;
  }>;
};

function getInitial(username: string) {
  return username.trim().charAt(0).toUpperCase() || "?";
}

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return "Yesterday";
  }

  return `${diffDays}d ago`;
}

function getDuration(
  startedAt: string,
  endedAt: string | null,
) {
  if (!endedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  const minutes = Math.max(
    0,
    Math.round((end - start) / 60000),
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userId, setUserId] = useState<number | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [feed, setFeed] = useState<FeedWorkout[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError(null);

        const storedUserId =
          await AsyncStorage.getItem("vytor_user_id");

        const id = Number(storedUserId);

        if (!Number.isInteger(id)) {
          throw new Error("No logged-in user found.");
        }

        setUserId(id);

        const [
          friendsData,
          requestsData,
          feedData,
        ] = await Promise.all([
          getFriends(id),
          getFriendRequests(id),
          getFriendsFeed(id),
        ]);

        setFriends(friendsData);
        setRequests(requestsData);
        setFeed(feedData);
      } catch (err) {
        console.error("Failed to load friends:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load friends.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData(false);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);

    if (!userId || !query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);

      const results = await searchUsers(
        query.trim(),
        userId,
      );

      setSearchResults(results);
    } catch (err) {
      console.error("Failed to search users:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleAcceptRequest(requestId: number) {
    if (!userId) {
      return;
    }

    try {
      await acceptFriendRequest(
        requestId,
        userId,
      );

      await loadData(false);
    } catch (err) {
      console.error(
        "Failed to accept friend request:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to accept friend request.",
      );
    }
  }

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={Colors.tint}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.tint}
          />
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 100,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              COMMUNITY
            </Text>

            <Text style={styles.title}>
              Friends
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.findButton,
              pressed && styles.findButtonPressed,
            ]}
            onPress={() => {
              setShowSearch((value) => !value);

              if (showSearch) {
                setSearchQuery("");
                setSearchResults([]);
              }
            }}
          >
            <Text style={styles.findButtonText}>
              {showSearch ? "Done" : "Find friends"}
            </Text>
          </Pressable>
        </View>

        {/* Find Friends */}
        {showSearch && (
          <View style={styles.searchSection}>
            <TextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search username..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />

            {searching && (
              <View style={styles.searchLoading}>
                <ActivityIndicator
                  size="small"
                  color={Colors.tint}
                />
              </View>
            )}

            {!searching &&
              searchQuery.trim().length > 0 &&
              searchResults.length === 0 && (
                <Text style={styles.noResults}>
                  No users found.
                </Text>
              )}

            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((user) => (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => [
                      styles.searchResult,
                      pressed &&
                        styles.searchResultPressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/user-profile",
                        params: {
                          userId: String(user.id),
                        },
                      })
                    }
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {getInitial(user.username)}
                      </Text>
                    </View>

                    <View style={styles.userInfo}>
                      <Text style={styles.username}>
                        {user.username}
                      </Text>

                      <Text
                        style={styles.userSubtitle}
                      >
                        View profile
                      </Text>
                    </View>

                    <Text style={styles.friendArrow}>
                      ›
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {/* Friend Requests */}
        {requests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Friend requests
              </Text>

              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {requests.length}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              {requests.map((request, index) => (
                <View
                  key={request.id}
                  style={[
                    styles.requestRow,
                    index < requests.length - 1 &&
                      styles.rowBorder,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitial(
                        request.user.username,
                      )}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.username}>
                      {request.user.username}
                    </Text>

                    <Text
                      style={styles.userSubtitle}
                    >
                      Wants to be your friend
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.acceptButton,
                      pressed &&
                        styles.acceptButtonPressed,
                    ]}
                    onPress={() =>
                      handleAcceptRequest(
                        request.id,
                      )
                    }
                  >
                    <Text
                      style={styles.acceptButtonText}
                    >
                      Accept
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Friend Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Friend activity
              </Text>

              <Text style={styles.sectionSubtitle}>
                Workouts from the last 7 days
              </Text>
            </View>
          </View>

          {feed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>
                ✦
              </Text>

              <Text style={styles.emptyTitle}>
                Nothing here yet
              </Text>

              <Text style={styles.emptyText}>
                When your friends complete workouts,
                they will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.feed}>
              {feed.map((workout) => {
                const duration = getDuration(
                  workout.startedAt,
                  workout.endedAt,
                );

                const exerciseCount =
                  workout.exercises.length;

                const setCount =
                  workout.exercises.reduce(
                    (total, exercise) =>
                      total + exercise.sets.length,
                    0,
                  );

                return (
                  <View
                    key={workout.id}
                    style={styles.workoutCard}
                  >
                    <View style={styles.workoutTop}>
                      <View
                        style={styles.workoutUser}
                      >
                        <View style={styles.avatarSmall}>
                          <Text
                            style={
                              styles.avatarSmallText
                            }
                          >
                            {getInitial(
                              workout.user.username,
                            )}
                          </Text>
                        </View>

                        <View>
                          <Text
                            style={styles.workoutUsername}
                          >
                            {workout.user.username}
                          </Text>

                          <Text
                            style={styles.workoutTime}
                          >
                            {getRelativeTime(
                              workout.endedAt ??
                                workout.startedAt,
                            )}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={styles.completedBadge}
                      >
                        <Text
                          style={
                            styles.completedBadgeText
                          }
                        >
                          WORKOUT
                        </Text>
                      </View>
                    </View>

                    <View
                      style={styles.workoutBody}
                    >
                      <Text
                        style={styles.workoutTitle}
                      >
                        {workout.template?.name ??
                          "Workout"}
                      </Text>

                      <View
                        style={styles.workoutStats}
                      >
                        <View
                          style={styles.workoutStat}
                        >
                          <Text
                            style={
                              styles.workoutStatValue
                            }
                          >
                            {exerciseCount}
                          </Text>

                          <Text
                            style={
                              styles.workoutStatLabel
                            }
                          >
                            EXERCISES
                          </Text>
                        </View>

                        <View
                          style={styles.statDivider}
                        />

                        <View
                          style={styles.workoutStat}
                        >
                          <Text
                            style={
                              styles.workoutStatValue
                            }
                          >
                            {setCount}
                          </Text>

                          <Text
                            style={
                              styles.workoutStatLabel
                            }
                          >
                            SETS
                          </Text>
                        </View>

                        {duration && (
                          <>
                            <View
                              style={
                                styles.statDivider
                              }
                            />

                            <View
                              style={
                                styles.workoutStat
                              }
                            >
                              <Text
                                style={
                                  styles.workoutStatValue
                                }
                              >
                                {duration}
                              </Text>

                              <Text
                                style={
                                  styles.workoutStatLabel
                                }
                              >
                                TIME
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Friends List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Your friends
              </Text>

              <Text style={styles.sectionSubtitle}>
                {friends.length === 0
                  ? "Build your network"
                  : `${friends.length} ${
                      friends.length === 1
                        ? "friend"
                        : "friends"
                    }`}
              </Text>
            </View>
          </View>

          {friends.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>
                +
              </Text>

              <Text style={styles.emptyTitle}>
                No friends yet
              </Text>

              <Text style={styles.emptyText}>
                Use Find friends to search for
                people on Vytor.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed &&
                    styles.emptyButtonPressed,
                ]}
                onPress={() =>
                  setShowSearch(true)
                }
              >
                <Text
                  style={styles.emptyButtonText}
                >
                  Find friends
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              {friends.map((friend, index) => (
                <Pressable
                  key={friend.id}
                  style={({ pressed }) => [
                    styles.friendRow,
                    index < friends.length - 1 &&
                      styles.rowBorder,
                    pressed &&
                      styles.friendRowPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname:
                        "/user-profile",
                      params: {
                        userId: String(
                          friend.id,
                        ),
                      },
                    })
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitial(
                        friend.username,
                      )}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.username}>
                      {friend.username}
                    </Text>

                    <Text
                      style={styles.userSubtitle}
                    >
                      View profile
                    </Text>
                  </View>

                  <Text
                    style={styles.friendArrow}
                  >
                    ›
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: Colors.tint,
    marginBottom: 5,
  },

  title: {
    fontSize: 34,
    fontWeight: "800",
    color: Colors.text,
  },

  findButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  findButtonPressed: {
    opacity: 0.65,
  },

  findButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
  },

  searchSection: {
    marginBottom: 26,
  },

  searchInput: {
    height: 50,
    paddingHorizontal: 17,
    borderRadius: 15,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 15,
  },

  searchLoading: {
    position: "absolute",
    right: 17,
    top: 16,
  },

  noResults: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 13,
    color: Colors.textMuted,
  },

  searchResults: {
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchResult: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  searchResultPressed: {
    opacity: 0.65,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  avatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },

  userInfo: {
    flex: 1,
    marginLeft: 13,
  },

  username: {
    fontSize: 15,
    fontWeight: "750",
    color: Colors.text,
  },

  userSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textMuted,
  },

  friendArrow: {
    marginLeft: 10,
    fontSize: 28,
    fontWeight: "300",
    color: Colors.textMuted,
  },

  errorCard: {
    padding: 14,
    marginBottom: 20,
    borderRadius: 15,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  errorText: {
    textAlign: "center",
    fontSize: 13,
    color: "#D9534F",
  },

  section: {
    marginBottom: 32,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: Colors.text,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textMuted,
  },

  countBadge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    marginLeft: 9,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.tint,
  },

  countText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.background,
  },

  card: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  requestRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  friendRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  friendRowPressed: {
    opacity: 0.65,
  },

  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  acceptButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: Colors.tint,
  },

  acceptButtonPressed: {
    opacity: 0.7,
  },

  acceptButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.background,
  },

  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 25,
    paddingVertical: 35,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  emptyIcon: {
    fontSize: 25,
    fontWeight: "300",
    color: Colors.tint,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },

  emptyText: {
    maxWidth: 280,
    marginTop: 7,
    textAlign: "center",
    lineHeight: 19,
    fontSize: 13,
    color: Colors.textMuted,
  },

  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.tint,
  },

  emptyButtonPressed: {
    opacity: 0.7,
  },

  emptyButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.background,
  },

  feed: {
    gap: 13,
  },

  workoutCard: {
    padding: 17,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  workoutTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  workoutUser: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  avatarSmallText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },

  workoutUsername: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },

  workoutTime: {
    marginLeft: 10,
    marginTop: 2,
    fontSize: 11,
    color: Colors.textMuted,
  },

  completedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  completedBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: Colors.tint,
  },

  workoutBody: {
    marginTop: 17,
  },

  workoutTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: Colors.text,
  },

  workoutStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  workoutStat: {
    flex: 1,
    alignItems: "center",
  },

  workoutStatValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },

  workoutStatLabel: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },

  statDivider: {
    width: 1,
    height: 27,
    backgroundColor: Colors.border,
  },
});