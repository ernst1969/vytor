const API_URL = "http://192.168.2.33:3000";

export async function checkBackend() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}

export async function createUser(username: string) {
  const response = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
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