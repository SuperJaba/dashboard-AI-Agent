#!/bin/bash
set -e

# Legacy deployment script entry point - forwards to optimized deployment
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/deploy-ct8-optimized.sh" "$@"
