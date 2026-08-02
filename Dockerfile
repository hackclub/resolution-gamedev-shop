FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
ENV PORT=3000
VOLUME ["/app/data"]
CMD ["bun", "./build/index.js"]
