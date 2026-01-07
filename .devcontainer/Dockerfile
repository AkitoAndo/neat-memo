FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install additional tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace
