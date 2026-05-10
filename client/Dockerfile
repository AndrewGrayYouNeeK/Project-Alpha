FROM node:20-alpine AS deps
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY client ./client
WORKDIR /app/client
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/client
ENV NODE_ENV=production
COPY --from=build /app/client/dist ./dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
