FROM node:18-alpine

ENV NODE_ENV=production
ENV PORT=8080
# Override at runtime: `docker run -e DESTINATION_URL=https://www.easyfun.gg/...`
# Only hostnames listed in ALLOWED_HOSTNAMES (src/index.js) are accepted.
ENV DESTINATION_URL=https://www.easyfun.gg/cloud-games/roblox.html
ARG NPM_BUILD="npm install --omit=dev"
EXPOSE 8080/tcp

LABEL maintainer="PuffProxy"
LABEL summary="PuffProxy Image"
LABEL description="Minimal Scramjet-powered proxy that auto-loads a configured destination fullscreen"

WORKDIR /app

COPY ["package.json", "package-lock.json", "./"]
RUN apk add --upgrade --no-cache python3 make g++
RUN $NPM_BUILD

COPY . .

ENTRYPOINT [ "node" ]
CMD ["src/index.js"]
