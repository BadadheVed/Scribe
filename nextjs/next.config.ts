import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@attack-capital/db"],
};

export default nextConfig;
