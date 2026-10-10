import type { Plugin } from "vite";
import { createAuthHandler } from "./http.js";
import { getAuthRuntime } from "./runtime.js";

export default function authDevPlugin(): Plugin {
  return {
    name: "flux-auth-api",
    configureServer(server) {
      const handler = createAuthHandler(getAuthRuntime);
      server.middlewares.use("/api/auth", (request, response) => {
        void handler(request, response);
      });
    },
  };
}
