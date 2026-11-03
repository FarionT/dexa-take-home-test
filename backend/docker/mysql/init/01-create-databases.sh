#!/bin/bash
# Run by the MySQL image entrypoint on first start (empty volume only).
# Creates one database per service and grants the app user access to each.
#
# Kept executable and self-contained (plain `mysql` client, no entrypoint
# helpers): Docker Desktop mounts can report a non-executable script as
# executable, so the entrypoint would try to run it rather than source it.
set -euo pipefail

export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"

for db in "$DB_AUTH_NAME" "$DB_EMPLOYEE_NAME" "$DB_ATTENDANCE_NAME"; do
  echo "Creating database: $db"
  mysql --protocol=socket -uroot <<EOSQL
CREATE DATABASE IF NOT EXISTS \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`$db\`.* TO '$MYSQL_USER'@'%';
EOSQL
done

mysql --protocol=socket -uroot -e "FLUSH PRIVILEGES;"
