// start-server.js
const fs = require('fs'); // Required for path resolution if server.js is not in current dir
const path = require('path'); // Required for path resolution

// Attempt to load dotenv, but proceed if it's not found (e.g. if it's a devDependency)
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  console.warn("dotenv module not found, proceeding without parsing APPLICATION_ENV_SECRET for .env format. Ensure variables are set directly or this secret is not in .env format.");
}

if (process.env.APPLICATION_ENV_SECRET && dotenv) {
  console.log("Found APPLICATION_ENV_SECRET, attempting to parse and load into process.env");
  try {
    // Assuming APPLICATION_ENV_SECRET contains the raw string content of a .env file
    const envConfig = dotenv.parse(Buffer.from(process.env.APPLICATION_ENV_SECRET, 'utf-8'));

    for (const k in envConfig) {
      if (Object.prototype.hasOwnProperty.call(envConfig, k)) {
        process.env[k] = envConfig[k];
      }
    }
    console.log("Successfully loaded variables from APPLICATION_ENV_SECRET into process.env");
  } catch (e) {
    console.error("Error parsing APPLICATION_ENV_SECRET:", e);
    // Decide if you want to exit or continue if parsing fails
  }
} else if (process.env.APPLICATION_ENV_SECRET && !dotenv) {
  console.warn("APPLICATION_ENV_SECRET is set, but dotenv module is not available to parse it. Please ensure dotenv is a production dependency if the secret is in .env format.");
} else {
  console.log("APPLICATION_ENV_SECRET not found or dotenv not used. Relying on pre-set environment variables for the application.");
}

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