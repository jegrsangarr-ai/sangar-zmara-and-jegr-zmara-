#!/bin/bash
set -e

# Start MariaDB if not already running
if ! service mariadb status >/dev/null 2>&1; then
    echo "Starting MariaDB service..."
    service mariadb start 2>/dev/null || /etc/init.d/mariadb start 2>/dev/null || true
fi

echo "Starting Sangar & Jegr POS PHP Server on port 3000..."
exec php -S 0.0.0.0:3000 router.php
