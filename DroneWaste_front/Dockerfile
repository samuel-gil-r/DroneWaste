# ── Etapa 1: build React con Vite ────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .

# Las VITE_ vars se inyectan en tiempo de build (no de ejecución)
ARG VITE_GOOGLE_MAPS_KEY
ARG VITE_GEMINI_KEY
ARG VITE_API_URL=http://localhost:8080
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY
ENV VITE_GEMINI_KEY=$VITE_GEMINI_KEY
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Etapa 2: Nginx sirve el build estático ────────────────────────────────
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
