// start-server.js
const fs = require('fs'); // Required for path resolution if server.js is not in current dir
const path = require('path'); // Required for path resolution

// Removed dotenv logic as individual secrets will be injected directly.

console.log("Relying on environment variables injected directly by Cloud Run for runtime configuration.");

// Dynamically determine the server.js path relative to this script
// This assumes server.js from .next/standalone is copied to the WORKDIR /app
const serverPath = path.resolve(__dirname, 'server.js');

if (fs.existsSync(serverPath)) {
  console.log(`Starting Next.js server from: ${serverPath}`);
  require(serverPath);
} else {
  console.error(`Error: server.js not found at ${serverPath}. Ensure it's copied correctly to the WORKDIR in Dockerfile.`);
  process.exit(1);
} 