#!/bin/bash
set -e

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
