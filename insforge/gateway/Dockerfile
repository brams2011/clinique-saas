FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production --silent
COPY index.js .
EXPOSE 7130
CMD ["node", "index.js"]
