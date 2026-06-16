FROM eclipse-temurin:17-jdk

WORKDIR /app

# Copy the backend files
COPY backend /app/backend

# Compile the Java server
RUN javac backend/Server.java

# Expose port 8080
EXPOSE 8080

# Run the server
CMD ["java", "backend.Server"]
