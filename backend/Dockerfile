# Stage 1: Dependencies & Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Stage 2: Production Runtime
FROM node:20-alpine

WORKDIR /usr/src/app

# Enforce production environment
ENV NODE_ENV=production

# Copy node_modules and application files from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app ./

# Hardening: Run as a non-root user
RUN addgroup -S ciphernest && adduser -S ciphernest -G ciphernest
USER ciphernest

# Expose standard port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
