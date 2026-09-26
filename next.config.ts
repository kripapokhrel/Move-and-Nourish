import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Exercise photos from free-exercise-db (public domain). See lib/workouts/library.ts
    remotePatterns: [new URL("https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/**")],
  },
};

export default nextConfig;
