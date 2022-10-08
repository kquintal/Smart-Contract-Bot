#!/bin/bash
echo """
runtime: nodejs
env: flex
service: prod-liquidator-bot

resources:
  cpu: 1
  memory_gb: 2

manual_scaling:
  instances: 1

env_variables:
  GOOGLE_KEY_PATH: \"/workspace/key.json\"
  POLL_INTERVAL_MS: \"$POLL_INTERVAL_MS\"
  POLYGON_RPC_URL: \"$POLYGON_RPC_URL\"
  WALLET_PRIVATE_KEY: \"$WALLET_PRIVATE_KEY\"
  DISCORD_WEBHOOK_URL: \"$DISCORD_WEBHOOK_URL\"
  NODE_ENV: \"production\"
"""
