FROM node:22

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm config set fetch-timeout 600000 && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-maxtimeout 180000 && \
    pnpm install --frozen-lockfile --fetch-timeout 600000 --fetch-retries 5
RUN pnpm build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

USER root

EXPOSE 3000

CMD ["pnpm", "start"]