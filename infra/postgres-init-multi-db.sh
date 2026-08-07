#!/bin/bash
# Membuat beberapa database dalam satu instance Postgres.
# Dipicu otomatis oleh image postgres saat container pertama kali dibuat,
# karena file ini di-mount ke /docker-entrypoint-initdb.d/.
# Daftar database diambil dari env var POSTGRES_MULTIPLE_DATABASES (dipisah koma).

set -e
set -u

function create_database() {
  local database=$1
  echo "Creating database '$database'..."
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE "$database";
EOSQL
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
  IFS=',' read -ra DBS <<< "$POSTGRES_MULTIPLE_DATABASES"
  for db in "${DBS[@]}"; do
    create_database "$db"
  done
  echo "Multiple databases created"
fi
