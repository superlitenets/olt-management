FROM node:20-alpine AS base

WORKDIR /app

# Install build dependencies for native modules (bcrypt, better-sqlite3, etc.)
RUN apk add --no-cache python3 make g++ linux-headers

FROM base AS deps
COPY package*.json ./
RUN npm ci --include=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install runtime dependencies for bcrypt, OpenVPN for VPN tunnels, and other native modules
RUN apk add --no-cache libstdc++ curl openvpn

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Set ownership
RUN chown -R expressjs:nodejs /app

USER expressjs

# Expose ports: 5000 for web app, 7547 for TR-069/ACS
EXPOSE 5000
EXPOSE 7547

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.cjs"]
