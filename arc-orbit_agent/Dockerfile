# Base stage for shared setup
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy lockfile and package.json
COPY package.json pnpm-lock.yaml ./

# Build stage
FROM base AS build

# Install all dependencies (including devDependencies for build steps)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the NestJS application
RUN pnpm run build

# Prune devDependencies to keep the final image size minimal
RUN pnpm prune --prod

# Production stage
FROM node:20-alpine AS production

# Install pnpm globally in runtime container
RUN npm install -g pnpm

WORKDIR /app

# Copy pruned node_modules and built dist folder from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Expose port (Render sets PORT env variable dynamically)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Run start script in production mode
CMD ["pnpm", "run", "start:prod"]
