#!/bin/bash
set -e

echo "Starting customer table check..."
echo "Current database time: $(date -u +'%Y-%m-%d %H:%M:%S') UTC"

# Start PostgreSQL in the background
docker-entrypoint.sh postgres &

# Wait for PostgreSQL to be ready
until pg_isready -U dhg503; do
    echo "Waiting for PostgreSQL to start..."
    sleep 1
done

# Wait for database to be created
echo "Checking database existence..."
until psql -U dhg503 -d dhg503 -c "SELECT 1" &>/dev/null; do
    echo "Waiting for database creation..."
    sleep 1
done

echo "PostgreSQL is ready with database!"

exists=$(psql -U dhg503 -d dhg503 -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers');")

echo "Table existence check result: '${exists}'"

if [ "$exists" = " f" ]; then
    echo "Customers table not found. Initializing from tutorial.sql..."
    psql -U dhg503 -d dhg503 -f /scripts/tutorial.sql
    echo "Successfully created Customers table with 147 records!"
else
    echo "Customers table already exists. Skipping initialization."
fi

wait $!