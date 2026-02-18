#!/bin/bash
set -e

# Start Tailscale in background if TS_AUTH_KEY is provided
if [ -n "$TS_AUTH_KEY" ]; then
    echo "Starting Tailscale..."

    # Set up Tailscale state directory
    TS_STATE_DIR="${TS_STATE_DIR:-/var/lib/tailscale}"
    mkdir -p "$TS_STATE_DIR"

    # Start tailscaled daemon
    /usr/sbin/tailscaled --state="$TS_STATE_DIR/tailscaled.state" \
        --socket=/var/run/tailscale/tailscaled.sock \
        --port=41641 &

    # Wait for tailscaled to be ready
    sleep 2

    # Run tailscale up with auth key and optional arguments
    TS_ARGS="--authkey=$TS_AUTH_KEY"
    [ -n "$TS_HOSTNAME" ] && TS_ARGS="$TS_ARGS --hostname=$TS_HOSTNAME"
    [ -n "$TS_EXTRA_ARGS" ] && TS_ARGS="$TS_ARGS $TS_EXTRA_ARGS"

    /usr/bin/tailscale up $TS_ARGS

    echo "Tailscale connected:"
    /usr/bin/tailscale status --self
fi

# Start NetBird in background if NB_SETUP_KEY is provided
if [ -n "$NB_SETUP_KEY" ]; then
    echo "Starting NetBird..."

    # Run netbird service in background
    /usr/bin/netbird service run &

    # Wait for netbird service to be ready
    sleep 2

    # Run netbird up with setup key and optional arguments
    NB_ARGS="--setup-key=$NB_SETUP_KEY"
    [ -n "$NB_MANAGEMENT_URL" ] && NB_ARGS="$NB_ARGS --management-url=$NB_MANAGEMENT_URL"
    [ -n "$NB_HOSTNAME" ] && NB_ARGS="$NB_ARGS --hostname=$NB_HOSTNAME"
    
    # Disable DNS as requested
    NB_ARGS="$NB_ARGS --disable-dns"

    /usr/bin/netbird up $NB_ARGS

    echo "NetBird connected:"
    /usr/bin/netbird status
fi

# バックグラウンドでbotを起動（ログをファイルに出力）
/service/satisfactory-service >> /service/satisfactory-service.log 2>&1 &

# 元のinit.shを実行（フォアグラウンド）
exec /init.sh "$@"
