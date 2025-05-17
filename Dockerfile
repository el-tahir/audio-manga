# Use an official Node.js runtime as a parent image.
# Stage 1: Install dependencies
FROM node:20-slim AS deps

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json package-lock.json* ./

# Install project dependencies using npm ci for a clean and reproducible install
RUN npm ci

# Stage 2: Build the application
# Use an official Node.js runtime as a parent image
FROM node:20-slim AS builder
# Set the working directory in the container
WORKDIR /app

# Declare build-time arguments that can be passed during the docker build command
ARG BUILD_TIME_NEXT_PUBLIC_SUPABASE_URL
ARG BUILD_TIME_NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set environment variables for the build process using the build-time arguments
# These are used by the Next.js build to bake values into the client-side bundle
ENV NEXT_PUBLIC_SUPABASE_URL=$BUILD_TIME_NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$BUILD_TIME_NEXT_PUBLIC_SUPABASE_ANON_KEY

# Copy node_modules from the 'deps' stage
# This leverages Docker's layer caching, so dependencies are not re-installed if package files haven't changed
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application code into the container
COPY . .

# Echo the Supabase URL to verify it's being passed correctly during the build
RUN echo "Building with NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
# Build the Next.js application for production
RUN npm run build

# Stage 3: Production image
# Use a slim Node.js runtime for the final image to reduce size
FROM node:20-slim AS runner
# Set the working directory in the container
WORKDIR /app

# Set the environment to production
# This optimizes Next.js for performance
ENV NODE_ENV=production

# Create a non-root user 'node' and switch to it for better security
# Running as a non-root user is a security best practice
USER node

# Copy the public assets from the builder stage
COPY --from=builder --chown=node:node /app/public ./public
# Copy the standalone Next.js server output from the builder stage
# This includes only the necessary files to run the application
COPY --from=builder --chown=node:node /app/.next/standalone ./
# Copy the static Next.js assets (CSS, JS, etc.) from the builder stage
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Copy package.json to ensure all runtime dependencies are available if needed by the standalone server
COPY --from=builder --chown=node:node /app/package.json ./

# Copy the custom server start script
COPY --chown=node:node start-server.js ./

# Expose port 3000 to the host
# This is the default port Next.js runs on
EXPOSE 3000
# Set the PORT environment variable, which might be used by hosting platforms
ENV PORT 3000

# Command to run the application using the custom start script
CMD [ "node", "start-server.js" ]