# Microsoft公式のDev Container用Pythonイメージ（非rootユーザー設定済み）
FROM mcr.microsoft.com/devcontainers/python:3.12

# Pythonの動作を最適化
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 必要なシステムツール群および Node.js 20 LTS のインストール
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    curl \
    git \
    nano \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get -y install --no-install-recommends nodejs \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# FastAPI関連ライブラリのグローバルインストール
# ※実運用では requirements.txt や pyproject.toml での管理に移行してください
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    sqlalchemy \
    pydantic \
    pydantic-settings

# Antigravity CLIのインストール
# インストール先を /usr/local/bin に指定
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- --dir /usr/local/bin

# テスト実行
RUN agy --version
