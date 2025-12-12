#!/bin/sh

# Ensure Docker containers are cleaned up regardless of test outcome
cleanup() {
  echo "Cleaning up Docker containers..."
  docker compose down
}

# Set trap to run cleanup on exit (success or failure)
trap cleanup EXIT

# Start Docker containers
echo "Starting Docker containers..."
docker compose up -d

# Wait a moment for containers to be ready
sleep 2

# Run e2e tests
echo "Running e2e tests..."
cd e2e
E2E_BASE_URL=http://localhost npm test

# Exit with the test exit code (trap will still run cleanup)
exit $?
