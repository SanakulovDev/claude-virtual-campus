# One image builds the whole monorepo and serves both the API and the web app (the two
# compose services run it with different commands). Local-tool image -- optimised for
# "docker compose up just works", not for minimal size.
FROM node:20-slim

# openssl is required by Prisma's engine + migrate binaries
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

# The web client bundle bakes NEXT_PUBLIC_API_URL at build time. The browser runs on the
# host, so it must reach the API at the published host port.
ENV NEXT_PUBLIC_API_URL=http://localhost:4000

RUN pnpm --filter @campus/api exec prisma generate \
  && pnpm build

EXPOSE 4000 3100
