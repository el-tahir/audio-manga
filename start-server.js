// start-server.js
// Note: CommonJS require is necessary for this production server bootstrap file
// as it needs to run before the Next.js build system is available
const fs = require('fs'); // Required for server.js existence check
const path = require('path'); // Required for resolving server.js path

// Removed dotenv logic as individual secrets will be injected directly.

console.log(
  'Relying on environment variables injected directly by Cloud Run for runtime configuration.'
);

// Dynamically determine the server.js path relative to this script
// This assumes server.js from .next/standalone is copied to the WORKDIR /app
const serverPath = path.resolve(__dirname, 'server.js');

if (fs.existsSync(serverPath)) {
  console.log(`Starting Next.js server from: ${serverPath}`);
  // Dynamic require is needed here to load the generated Next.js server
  require(serverPath);
} else {
  console.error(
    `Error: server.js not found at ${serverPath}. Ensure it's copied correctly to the WORKDIR in Dockerfile.`
  );
  process.exit(1);
}
