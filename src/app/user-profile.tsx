import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
    getFriends,
    getPublicUser,
    sendFriendRequest,
} from "@/services/api";

type User = {
  id: number;
  username: string;
  createdAt: string;
};

type Friend = {
  id: number;
  username: string;
};

function getInitial(username: string) {
  return username.trim().charAt(0).toUpperCase() || "?";
}

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    userId?: string;
  }>();

  const profileId = Number(params.userId);

  const [user, setUser] = useState<User | null>(null);
  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);

  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const storedUserId =
          await AsyncStorage.getItem("vytor_user_id");

        const loggedInUserId = Number(storedUserId);

        if (!Number.isInteger(loggedInUserId)) {
          throw new Error("No logged-in user found.");
        }

        if (!Number.isInteger(profileId)) {
          throw new Error("Invalid user.");
        }

        setCurrentUserId(loggedInUserId);

        const [profile, friends] = await Promise.all([
          getPublicUser(profileId),
          getFriends(loggedInUserId),
        ]);

        setUser(profile);

        setIsFriend(
          friends.some(
            (friend: Friend) =>
              friend.id === profileId,
          ),
        );
      } catch (err) {
        console.error(
          "Failed to load user profile:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [profileId]);

  async function handleAddFriend() {
    if (
      !currentUserId ||
      !user ||
      sending ||
      isFriend ||
      requestSent
    ) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      await sendFriendRequest(
        currentUserId,
        user.id,
      );

      setRequestSent(true);
    } catch (err) {
      console.error(
        "Failed to send friend request:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to send friend request.",
      );
    } finally {
      setSending(false);
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

  if (!user) {
    return (
      <View
        style={[
          styles.center,
          { paddingTop: insets.top },
        ]}
      >
        <Text style={styles.errorText}>
          {error ?? "User not found."}
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const viewingOwnProfile =
    currentUserId === user.id;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        {/* Back */}
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ‹ Friends
          </Text>
        </Pressable>

        {/* Profile */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitial(user.username)}
            </Text>
          </View>

          <Text style={styles.username}>
            {user.username}
          </Text>

          <Text style={styles.memberText}>
            Vytor member
          </Text>
        </View>

        {/* ADD FRIEND */}
        {!viewingOwnProfile && (
          <View style={styles.friendAction}>
            {isFriend ? (
              <View style={styles.friendStatus}>
                <Text style={styles.friendStatusText}>
                  ✓ Friends
                </Text>
              </View>
            ) : requestSent ? (
              <View style={styles.friendStatus}>
                <Text style={styles.friendStatusText}>
                  Request Sent
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleAddFriend}
                disabled={sending}
                style={({ pressed }) => [
                  styles.addFriendButton,
                  pressed &&
                    styles.addFriendButtonPressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator
                    size="small"
                    color={Colors.background}
                  />
                ) : (
                  <>
                    <Text style={styles.plus}>
                      +
                    </Text>

                    <Text
                      style={styles.addFriendText}
                    >
                      Add Friend
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {error && (
          <Text style={styles.errorText}>
            {error}
          </Text>
        )}

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              12
            </Text>

            <Text style={styles.statLabel}>
              LEVEL
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>
              #42
            </Text>

            <Text style={styles.statLabel}>
              RANK
            </Text>
          </View>
        </View>

        {/* Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Recent activity
          </Text>

          <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View>
                <Text style={styles.activityTitle}>
                  Training activity
                </Text>

                <Text style={styles.activitySubtitle}>
                  Last 14 days
                </Text>
              </View>

              <Text style={styles.activityCount}>
                5
              </Text>
            </View>

            <View style={styles.activityGrid}>
              {Array.from({ length: 14 }).map(
                (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.activityDay,
                      index % 3 !== 0 &&
                        styles.activityDayActive,
                    ]}
                  />
                ),
              )}
            </View>
          </View>
        </View>

        {/* Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              More profile information will appear
              here as Vytor develops.
            </Text>
          </View>
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
    padding: 24,
    backgroundColor: Colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  back: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    marginBottom: 20,
  },

  backText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textMuted,
  },

  profileHeader: {
    alignItems: "center",
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  avatarText: {
    fontSize: 38,
    fontWeight: "800",
    color: Colors.text,
  },

  username: {
    marginTop: 16,
    fontSize: 29,
    fontWeight: "800",
    color: Colors.text,
  },

  memberText: {
    marginTop: 5,
    fontSize: 13,
    color: Colors.textMuted,
  },

  friendAction: {
    alignItems: "center",
    marginTop: 22,
  },

  addFriendButton: {
  minWidth: 210,
  height: 52,
  paddingHorizontal: 26,
  borderRadius: 26,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#FFFFFF",
  borderWidth: 2,
  borderColor: "#FFFFFF",
},

addFriendButtonPressed: {
  opacity: 0.75,
  transform: [{ scale: 0.98 }],
},

plus: {
  marginRight: 8,
  fontSize: 22,
  lineHeight: 23,
  fontWeight: "500",
  color: "#000000",
},

addFriendText: {
  fontSize: 16,
  fontWeight: "800",
  color: "#000000",
},

  friendStatus: {
    minWidth: 210,
    height: 52,
    paddingHorizontal: 26,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  friendStatusText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textMuted,
  },

  errorText: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 13,
    color: "#D9534F",
  },

  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    paddingVertical: 22,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  stat: {
    width: 120,
    alignItems: "center",
  },

  statValue: {
    fontSize: 25,
    fontWeight: "800",
    color: Colors.text,
  },

  statLabel: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: Colors.textMuted,
  },

  divider: {
    width: 1,
    height: 38,
    backgroundColor: Colors.border,
  },

  section: {
    marginTop: 28,
  },

  sectionTitle: {
    marginBottom: 12,
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },

  activityCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  activityTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },

  activitySubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textMuted,
  },

  activityCount: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.tint,
  },

  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 20,
  },

  activityDay: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  activityDayActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },

  infoCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },

  backButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.tint,
  },

  backButtonText: {
    fontWeight: "700",
    color: Colors.background,
  },
});