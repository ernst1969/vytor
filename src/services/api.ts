import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const SESSION_TOKEN_KEY = "vytor_session_token";

async function fetch(input: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return globalThis.fetch(input, { ...init, headers });
}

async function storeSession(data: { id: number; token?: string }) {
  await AsyncStorage.setItem("vytor_user_id", String(data.id));

  if (data.token) {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, data.token);
  }
}

export type ExerciseMeasurementType =
  | "WEIGHT_REPS"
  | "REPS"
  | "DISTANCE_TIME"
  | "TIME"
  | "WEIGHT_DISTANCE";

export type WeightUnit = "KG" | "LBS";

export type DistanceUnit = "KM" | "MI";
export type WorkoutSetType = "WARMUP" | "REGULAR" | "DROP";

export type Exercise = {
  id: number;
  name: string;
  description: string | null;
  measurementType: ExerciseMeasurementType;
};

export type TemplateExercise = {
  id: number;
  order: number;
  exercise: Exercise;
};

export type WorkoutTemplate = {
  id: number;
  name: string;
  userId: number | null;
  exercises: TemplateExercise[];
};

export async function checkBackend() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}

export async function createUser(
  username: string,
  password: string,
) {
  const response = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw Object.assign(
      new Error(data.error || `Backend returned ${response.status}`),
      { status: response.status },
    );
  }

  await storeSession(data);

  return data;
}

export async function loginUser(
  username: string,
  password: string,
) {
  const response = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  await storeSession(data);

  return data;
}

export async function logoutUser() {
  try {
    await fetch(`${API_URL}/api/logout`, { method: "POST" });
  } finally {
    await AsyncStorage.multiRemove(["vytor_user_id", SESSION_TOKEN_KEY, "vytor_active_workout"]);
  }
}

export async function getUser(userId: number) {
  const response = await fetch(`${API_URL}/api/users/${userId}`);

  const data = await response.json();

  if (!response.ok) {
    throw Object.assign(
      new Error(data.error || `Backend returned ${response.status}`),
      { status: response.status },
    );
  }

  return data;
}

export async function updateProfile(
  userId: number,
  profile: { username: string; displayName: string; avatarData?: string | null },
) {
  const response = await fetch(`${API_URL}/api/users/${userId}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const response = await fetch(`${API_URL}/api/templates`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function createWorkoutTemplate(name: string, exerciseIds: number[]): Promise<WorkoutTemplate> {
  const response = await fetch(`${API_URL}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, exerciseIds }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function updateWorkoutTemplate(
  templateId: number,
  name: string,
  exerciseIds: number[],
): Promise<WorkoutTemplate> {
  const response = await fetch(`${API_URL}/api/templates/${templateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, exerciseIds }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function deleteWorkoutTemplate(templateId: number) {
  const response = await fetch(`${API_URL}/api/templates/${templateId}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function getExercises(): Promise<Exercise[]> {
  const response = await fetch(`${API_URL}/api/exercises`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function createWorkout(
  userId: number,
  templateId: number | null,
  exercises: {
    exerciseId: number;
    weightUnit?: WeightUnit;
    distanceUnit?: DistanceUnit;
  }[],
) {
  const response = await fetch(`${API_URL}/api/workouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      templateId,
      exercises,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function finishWorkout(
  workoutId: number,
  exercises: {
    workoutExerciseId: number;
    weightUnit?: WeightUnit;
    distanceUnit?: DistanceUnit;
    sets: {
      setNumber: number;
      weight?: number | null;
      reps?: number | null;
      distance?: number | null;
      durationSeconds?: number | null;
      setType?: WorkoutSetType;
    }[];
  }[],
) {
  const response = await fetch(
    `${API_URL}/api/workouts/${workoutId}/finish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exercises,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number,
  weightUnit: WeightUnit = "KG",
  distanceUnit: DistanceUnit = "KM",
) {
  const response = await fetch(
    `${API_URL}/api/workouts/${workoutId}/exercises`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exerciseId,
        weightUnit,
        distanceUnit,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function getWorkoutHistory(
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/workouts/${userId}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function getLastExerciseWorkout(
  exerciseId: number,
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/exercises/${exerciseId}/last-workout?userId=${userId}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function searchUsers(
  query: string,
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/users/search?query=${encodeURIComponent(
      query,
    )}&userId=${userId}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function getFriends(userId: number) {
  const response = await fetch(
    `${API_URL}/api/friends/${userId}`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function getFriendRequests(
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/friends/${userId}/requests`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function sendFriendRequest(
  requesterId: number,
  recipientId: number,
) {
  const response = await fetch(
    `${API_URL}/api/friends/request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requesterId,
        recipientId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function acceptFriendRequest(
  requestId: number,
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/friends/requests/${requestId}/accept`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function rejectFriendRequest(
  requestId: number,
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/friends/requests/${requestId}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function cancelFriendRequest(requestId: number) {
  const response = await fetch(`${API_URL}/api/friends/requests/${requestId}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function getFriendsFeed(
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/friends/${userId}/feed`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function getPublicUser(
  userId: number,
) {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/public`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function updateWorkoutExerciseSettings(
  workoutExerciseId: number,
  settings: {
    weightUnit?: WeightUnit;
    distanceUnit?: DistanceUnit;
    restSeconds?: number;
  },
) {
  const response = await fetch(
    `${API_URL}/api/workout-exercises/${workoutExerciseId}/settings`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function deleteWorkoutExercise(workoutExerciseId: number) {
  const response = await fetch(`${API_URL}/api/workout-exercises/${workoutExerciseId}`, {
    method: "DELETE",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function updateWorkoutExerciseOrder(
  workoutId: number,
  exerciseIds: number[],
) {
  const response = await fetch(`${API_URL}/api/workouts/${workoutId}/exercises/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exerciseIds }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function getActiveWorkout() {
  const response = await fetch(`${API_URL}/api/workouts/active/current`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function cancelWorkout(workoutId: number) {
  const response = await fetch(`${API_URL}/api/workouts/${workoutId}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export type UserSettings = {
  preferredWeightUnit: WeightUnit;
  preferredDistanceUnit: DistanceUnit;
  restSeconds: number;
  theme: "SYSTEM" | "LIGHT" | "DARK";
};

export async function getSettings(): Promise<UserSettings> {
  const response = await fetch(`${API_URL}/api/settings`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const response = await fetch(`${API_URL}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function getLeaderboard() {
  const response = await fetch(`${API_URL}/api/leaderboard`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}

export async function removeFriend(friendId: number) {
  const response = await fetch(`${API_URL}/api/friends/${friendId}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend returned ${response.status}`);
  return data;
}
