const API_URL = "http://192.168.2.33:3000";

export async function checkBackend() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}

export async function createUser(
  username: string,
  password: string
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
    throw new Error(data.error || `Backend returned ${response.status}`);
  }

  return data;
}

export async function loginUser(
  username: string,
  password: string
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
    throw new Error(data.error || `Backend returned ${response.status}`);
  }

  return data;
}

export async function getUser(userId: number) {
  const response = await fetch(`${API_URL}/api/users/${userId}`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Backend returned ${response.status}`);
  }

  return data;
}

export async function getWorkoutTemplates() {
  const response = await fetch(`${API_URL}/api/templates`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Backend returned ${response.status}`);
  }

  return data;
}

export async function getExercises() {
  const response = await fetch(`${API_URL}/api/exercises`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Backend returned ${response.status}`);
  }

  return data;
}

export async function createWorkout(
  userId: number,
  templateId: number | null,
  exercises: { exerciseId: number }[],
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
    sets: {
      setNumber: number;
      weight: string;
      reps: string;
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
      data.error || `Backend returned ${response.status}`,
    );
  }

  return data;
}

export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number,
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

export async function getFriendRequests(userId: number) {
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

export async function getFriendsFeed(userId: number) {
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

export async function getPublicUser(userId: number) {
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