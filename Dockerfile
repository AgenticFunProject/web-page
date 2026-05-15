FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY server.js index.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY mock/ ./mock/
EXPOSE 4000
ENV PORT=4000 \
    EQUIPMENT_URL=https://equipments-service.nicefield-3b22b31f.northeurope.azurecontainerapps.io \
    AUTH_JWT_SECRET=equipments-prod-dev-secret-change-me-2026 \
    AUTH_JWT_ISSUER=platform-auth \
    AUTH_JWT_AUDIENCE=equipments-service \
    QUOTES_URL=http://localhost:8000
CMD ["node", "server.js"]
