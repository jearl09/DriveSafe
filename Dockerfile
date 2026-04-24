# --- Stage 1: Build Frontend ---
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Final Image ---
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libmariadb-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy backend and install requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the rest of the backend
COPY backend/ ./backend/

# Set environment variables
ENV PORT=8080
EXPOSE 8080

# Start the app
CMD ["python", "backend/serve_prod.py"]
