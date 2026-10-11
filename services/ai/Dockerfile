FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
ENV PORT=8090
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 appuser
COPY --chown=10001:10001 main.py ./main.py
USER 10001:10001
EXPOSE 8090
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port \"${PORT:-8090}\" --no-access-log"]
