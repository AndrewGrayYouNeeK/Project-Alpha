FROM node:20-alpine AS deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY shared ./shared
WORKDIR /app/server
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server/src/index.js"]
