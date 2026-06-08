FROM python:3.12-slim

WORKDIR /app

# Install deps (shioaji ships native wheels for linux/x86_64).
COPY pyproject.toml ./
RUN pip install --no-cache-dir "shioaji>=1.2" "fastapi>=0.110" "uvicorn[standard]>=0.29" "python-dotenv>=1.0"

COPY main.py ./

EXPOSE 8001

# Credentials are injected as env vars / secrets at runtime, never baked in.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
