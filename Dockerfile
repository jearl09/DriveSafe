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

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy everything from the root
COPY . .

# Copy built frontend from Stage 1 into the root's frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Set environment variables
ENV PORT=8080
EXPOSE 8080

# Start the app from the root, pointing to the backend folder
CMD ["python", "backend/serve_prod.py"]
