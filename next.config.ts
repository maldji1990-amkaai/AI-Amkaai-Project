import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ignored: [
        "**/node_modules",
        "**/.git",
        "**/C:/pagefile.sys",
        "**/C:/hiberfil.sys",
        "**/C:/swapfile.sys",
        "**/C:/System Volume Information",
        "**/C:/DumpStack.log.tmp",
      ],
    };

    return config;
  },
};

export default nextConfig;