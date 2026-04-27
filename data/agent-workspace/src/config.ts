export const CONFIG = {
  appName: "Sample App",
  version: "1.0.0",
  debug: true, // TODO: set to false in production
  maxRetries: 3,
  timeout: 5000,
} as const;

export const API_ENDPOINTS = {
  users: "/api/v1/users",
  posts: "/api/v1/posts",
  // TODO: add comments endpoint
} as const;
