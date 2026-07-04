# DashZW API — production placeholder image
# TODO(docker): multi-stage builds for each frontend static assets
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend ./backend
COPY frontends ./frontends

RUN npm install --omit=dev -w @dashzw/backend

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start", "-w", "@dashzw/backend"]
