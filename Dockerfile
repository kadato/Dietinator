# Web / Metro dev server only. Native builds (Expo Go, emulators) still run on the host.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

EXPOSE 8081 8082 19000 19001 19002

CMD ["npm", "run", "web"]
