# syntax=docker/dockerfile:1

# ---- Etapa 1: instala as dependências em um virtualenv isolado ----
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt

# ---- Etapa 2: imagem final, enxuta e sem root ----
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DATABASE_URL=sqlite:////app/data/cashya.db

RUN groupadd --system cashya && useradd --system --gid cashya --home-dir /app cashya

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=cashya:cashya alembic.ini ./
COPY --chown=cashya:cashya migrations ./migrations
COPY --chown=cashya:cashya app ./app

# Pasta do banco SQLite; monte um volume aqui para persistir os dados.
RUN mkdir -p /app/data && chown cashya:cashya /app/data
VOLUME ["/app/data"]

USER cashya
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"

# --no-server-header: o hardening já envia "Server: cashya"; evita vazar "uvicorn".
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
