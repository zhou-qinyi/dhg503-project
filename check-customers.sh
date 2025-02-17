#!/bin/bash
set -e

echo "Starting customer table check..."
echo "Current database time: $(date -u +'%Y-%m-%d %H:%M:%S') UTC"

docker-entrypoint.sh postgres &

until pg_isready -U dhg503 -d dhg503; do
    echo "Waiting for PostgreSQL to start..."
    sleep 1
done

echo "PostgreSQL is ready!"

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