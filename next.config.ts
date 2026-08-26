import type { NextConfig } from "next";

const aiCorsHeaders = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
  { key: "Access-Control-Max-Age", value: "86400" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/api/diagnosis", headers: aiCorsHeaders },
      { source: "/api/assessment", headers: aiCorsHeaders },
      { source: "/api/hqls", headers: aiCorsHeaders },
    ];
  },
};

export default nextConfig;
