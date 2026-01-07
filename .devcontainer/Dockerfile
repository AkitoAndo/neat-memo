FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install additional tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    bash-completion \
    && rm -rf /var/lib/apt/lists/*

# Enable git completion for bash
RUN echo '\n# Enable git completion\nif [ -f /usr/share/bash-completion/completions/git ]; then\n    . /usr/share/bash-completion/completions/git\nfi' >> /etc/bash.bashrc

# Set working directory
WORKDIR /workspace
