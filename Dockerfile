FROM wolveix/satisfactory-server:latest

# Install Tailscale and NetBird
RUN curl -fsSL https://tailscale.com/install.sh | sh && \
    curl -sSL https://pkgs.netbird.io/install.sh | sh && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY ./dist /service
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

