FROM node:22-bookworm-slim
# Use a supported Node runtime for the built-in HTTP application.
WORKDIR /app
# Install the exact browser dependencies before copying application code.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Copy only the files allowed by .dockerignore.
COPY --chown=node:node . .
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# Run without root privileges and expose the application port.
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
