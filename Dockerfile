
# Use official Node.js image as base
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json./
RUN npm install

# Copy all project files
COPY..

# Expose port (make sure it matches your app)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
