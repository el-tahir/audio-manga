# Stage 1: Base image with Node.js and system dependencies (including unrar)
FROM node:18-slim AS base

# Set working directory
WORKDIR /app

# Install unrar (essential for your .cbr processing)
# Combine steps to reduce layers
RUN apt-get update && \
    apt-get install -y --no-install-recommends unrar && \
    # Clean up APT cache to reduce image size
    rm -rf /var/lib/apt/lists/*

# Stage 2: Install production Node.js dependencies
FROM base AS deps
WORKDIR /app

# Copy package.json and lock file
COPY package.json package-lock.json* ./

# Install production dependencies using npm ci for consistency
# Use --omit=dev if not using npm ci, or if you need devDeps in the build stage below
RUN npm ci --omit=dev --prefer-offline --no-audit

# Stage 3: Build the Next.js application
FROM base AS builder
WORKDIR /app

# Copy dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application code
COPY . .

# Set build-time environment variables if needed (e.g., NEXT_PUBLIC_*)
# ARG NEXT_PUBLIC_SOME_VAR
# ENV NEXT_PUBLIC_SOME_VAR=$NEXT_PUBLIC_SOME_VAR

# Build the Next.js application using the standalone output mode
RUN npm run build

# Stage 4: Production image
# Use the base image again to keep it small and include unrar
FROM base AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV production

# Create a non-root user and group for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# USER nextjs # Switch user later after copying files owned by root

# Copy built assets from the builder stage
# Important: Copy the standalone output and public/static folders
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose the port the app runs on (default for Next.js is 3000)
EXPOSE 3000

# Set the port environment variable (used by Cloud Run)
ENV PORT 3000

# Command to run the application using the Node.js server from standalone output
CMD ["node", "server.js"]