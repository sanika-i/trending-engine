# Slim Python base — small image, quick to pull, no build tools we don't need.
FROM python:3.12-slim

WORKDIR /app

# Copy requirements first so Docker can cache the pip install layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

# --host 0.0.0.0 is required inside Docker so the port maps out to the host.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
