#!/bin/sh
set -eu
umask 077
# No secret values in argv, image layers, rendered host files, or stdout.
BEACON_GATEWAY_SECRET="$(cat /run/secrets/gateway_key)"
export BEACON_GATEWAY_SECRET
case "$BEACON_GATEWAY_SECRET" in *[!A-Za-z0-9_-]*|'') echo 'Invalid gateway key' >&2; exit 1;; esac
test "${#BEACON_GATEWAY_SECRET}" -ge 43
test "${#BEACON_GATEWAY_SECRET}" -le 128
case "${BEACON_HOST:-}" in *[!a-z0-9.-]*|'') echo 'Invalid canonical host' >&2; exit 1;; esac
envsubst '${BEACON_HOST} ${BEACON_GATEWAY_SECRET}' < /etc/beacon/nginx.conf.template > /tmp/nginx.conf
unset BEACON_GATEWAY_SECRET
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
