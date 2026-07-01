import { apiRequest } from "./client";

export type Role = "customer" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function signup(email: string, password: string) {
  return apiRequest<AuthResult>("/auth/signup", { method: "POST", body: { email, password } });
}

export function login(email: string, password: string) {
  return apiRequest<AuthResult>("/auth/login", { method: "POST", body: { email, password } });
}

export function refresh(refreshToken: string) {
  return apiRequest<AuthResult>("/auth/refresh", { method: "POST", body: { refreshToken } });
}

export function me(accessToken: string) {
  return apiRequest<{ userId: string; email: string; role: Role }>("/auth/me", {
    token: accessToken,
  });
}
