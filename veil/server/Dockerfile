# Veil server — Node 22 (built-in node:sqlite, no native build step).
FROM node:22-alpine AS build
WORKDIR /app
# Install server deps (including dev deps: tsc/tsx are needed to build).
COPY server/package.json ./server/package.json
RUN cd server && npm install --include=dev
COPY server ./server
RUN cd server && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
# HTTP API + optional inbound SMTP
EXPOSE 8787 2525
VOLUME ["/app/server/data"]
CMD ["node", "dist/index.js"]
