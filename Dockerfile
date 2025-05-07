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

# Explicitly declare ARGs for build-time secrets
ARG SUPABASE_URL_ARG
ARG SUPABASE_ANON_KEY_ARG

# Set ENV variables for Next.js build process using the ARGs
# IMPORTANT: Use the names Next.js expects, e.g., NEXT_PUBLIC_*
ENV NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_ARG
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_ARG

# Copy dependencies from the 'deps' stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the application code
COPY . .

# --- Environment Variables for Build Time ---
# Ensure any OTHER NEXT_PUBLIC_ variables needed during build are available here.
# If using the single ENV secret approach, those won't be available at build time
# unless passed as build-args and set as ENV here.
# For simplicity, ensure NEXT_PUBLIC_ vars are either not truly secret or handled
# via other means if they are also sourced from the APPLICATION_ENV_SECRET at runtime.

RUN echo "Building with NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
RUN npm run build

# Stage 3: Production image
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# ENV NEXT_TELEMETRY_DISABLED 1 # Uncomment to disable Next.js telemetry

# Set the user to "node"
USER node

# Create a non-root user and group for security
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs
# USER nextjs

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/package.json ./

# Copy the start-server.js script
COPY --chown=node:node start-server.js ./

# Copy node_modules, ensuring devDependencies are not included if they were pruned
# In this setup, node_modules from 'deps' (which includes all) is copied to 'builder',
# and then .next/standalone handles copying only necessary production node_modules.
# If you have specific node_modules that .next/standalone misses, you might need to copy them.

EXPOSE 3000
ENV PORT 3000

# CMD [ "node", "server.js" ]
# Use the custom start script that loads the environment secret
CMD [ "node", "start-server.js" ]