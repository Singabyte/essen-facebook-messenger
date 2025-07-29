# Build stage for React app
FROM node:18-alpine as client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy server files
COPY server/ ./

# Copy built React app
COPY --from=client-build /app/client/dist /app/client/dist

# Expose port
EXPOSE 4000

# Start server
CMD ["node", "src/index.js"]