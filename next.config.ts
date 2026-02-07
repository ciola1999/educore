import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wajib untuk Tauri (Static Export)
  output: 'export', 
  
  // Disable Image Optimization API (karena tidak ada Node server di desktop)
  images: {
    unoptimized: true,
  },


  reactCompiler: true,
};

export default nextConfig;