# Stage 1: Install dependencies
FROM node:20-slim AS deps
# Use slim variant for smaller base, check compatibility if issues arise

WORKDIR /app

# Copy package manager files
COPY package.json package-lock.json* ./

# Install dependencies using npm ci for deterministic installs
# This will install all dependencies, including dotenv if it's in package.json
RUN npm ci

# Stage 2: Build the application
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependencies from the 'deps' stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the application code
COPY . .

# --- Environment Variables for Build Time ---
# Ensure any NEXT_PUBLIC_ variables needed during build are available here.
# If using the single ENV secret approach, those won't be available at build time
# unless passed as build-args and set as ENV here.
# For simplicity, ensure NEXT_PUBLIC_ vars are either not truly secret or handled
# via direct ENV vars if needed during build.
# --- End Environment Variables for Build Time ---

# Build the Next.js application
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
# Prevent Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Copy the standalone output and the start-server.js script
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./ 
# Ensure start-server.js is in the root of your project to be copied by `COPY . .` in builder stage
# Then copy it from builder to runner stage
COPY --from=builder --chown=node:node /app/start-server.js ./start-server.js 
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Copy the full node_modules from the 'deps' stage
# This ensures all modules, including dotenv and its dependencies, are present.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Set user to non-root (good practice)
USER node

EXPOSE 3000

# Expose the port the app runs on
ENV PORT=3000
# Set HOST env variable instead of using the -H flag
ENV HOST=0.0.0.0

# The standalone server should pick up HOST=0.0.0.0
# CMD is now changed to run the start-server.js script first
CMD ["node", "start-server.js"]