import type { NextConfig } from "next";
import { validateFrontendEnvironment } from "./scripts/environment-policy.mjs";

validateFrontendEnvironment(process.env, { development: process.env.NODE_ENV === "development" });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
