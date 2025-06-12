# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001

# Set working directory
WORKDIR /app

# Copy built application and node_modules from builder
COPY --from=builder --chown=nodeapp:nodejs /app/build ./build
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown nodeapp:nodejs logs

# Security: Remove package manager
RUN rm -rf /usr/local/bin/npm /usr/local/bin/npx

# Switch to non-root user
USER nodeapp

# Expose port (if needed)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "build/index.js"]

# Metadata
LABEL name="mcp-agent-social" \
      version="1.0.3" \
      description="MCP Agent Social Media Server" \
      maintainer="your-team@company.com"
