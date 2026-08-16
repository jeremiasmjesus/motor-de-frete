FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
COPY migrations ./migrations

EXPOSE 3000

# Roda as migrations pendentes antes de subir o servidor — seguro rodar em
# todo deploy porque schema_migrations evita reaplicar o que já foi feito.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
