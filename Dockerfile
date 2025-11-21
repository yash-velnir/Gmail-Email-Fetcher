# Use a lightweight Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install only production deps
RUN npm install --production

# Copy the rest of the code
COPY . .

# Expose your app port (change if not 3000)
EXPOSE 3000

# Start application
CMD ["npm", "start"]
