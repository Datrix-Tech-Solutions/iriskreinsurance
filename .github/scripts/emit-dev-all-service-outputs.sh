#!/usr/bin/env bash

set -euo pipefail

output_file="${1:?GITHUB_OUTPUT path is required}"
services=(
  api-gateway
  auth-service
  hr-service
  notification-service
  subscription-service
  marketing-service
  reinsurance-service
  accounting-service
  nextjs-web
)

echo "force_all=true" >> "$output_file"
printf 'changes=["%s"]\n' "$(IFS='","'; echo "${services[*]}")" >> "$output_file"
for service in "${services[@]}"; do
  echo "${service}=true" >> "$output_file"
done