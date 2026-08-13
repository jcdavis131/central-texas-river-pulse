# Veil web client — build static assets, serve with nginx.
FROM node:22-alpine AS build
WORKDIR /app/web
COPY web/package.json ./package.json
RUN npm install
COPY web ./
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/web/dist /usr/share/nginx/html
# SPA fallback so client-side state routes resolve to index.html.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
