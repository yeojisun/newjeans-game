FROM openjdk:17-jdk-slim

WORKDIR /app

# Copy the backend files
COPY backend /app/backend

# Compile the Java server
RUN javac backend/Server.java

# Expose port 8080 (the port our server listens on)
EXPOSE 8080

# Run the server
CMD ["java", "backend.Server"]
