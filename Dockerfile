FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm ci --only=production

# Bundle app source
COPY . .

# Set environment variables
ENV PORT=8081
ENV MOCK_MODE=true

EXPOSE 8081

# Run the application
CMD [ "node", "src/server.js" ]
