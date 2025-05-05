# Stage 1: Install dependencies
FROM node:20-slim AS deps
# Use slim variant for smaller base, check compatibility if issues arise

WORKDIR /app

# Copy package manager files
COPY package.json package-lock.json* ./

# Install dependencies using npm ci for deterministic installs
RUN npm ci

# Stage 2: Build the application
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependencies from the 'deps' stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the application code
COPY . .

# --- Environment Variables for Build Time ---
# Set NEXT_PUBLIC variables needed during the build.
# You might need to pass these as build arguments for flexibility.
# Example:
# ARG NEXT_PUBLIC_SUPABASE_URL
# ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
# ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
# ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
# --- End Environment Variables for Build Time ---

# Build the Next.js application
# Ensure NEXT_PUBLIC_ variables required by client-side code are available here
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
# Use Alpine for the final, smallest image. Requires testing for native dependencies.

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
# Prevent Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Install OS-level dependencies (like unrar if needed for background processing)
# IMPORTANT: Only include this if the background processor *needs* to run in this container AND processes .cbr files.
# If background processing is handled elsewhere, remove this RUN command.

# Copy the standalone output from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Set user to non-root (good practice)
USER node

EXPOSE 3000

# Expose the port the app runs on
ENV PORT=3000
# Set HOST env variable instead of using the -H flag
ENV HOST=0.0.0.0
# The standalone server should pick up HOST=0.0.0.0
CMD ["node", "server.js"]