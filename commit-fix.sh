#!/bin/bash
cd "$(dirname "$0")"
git config user.email "amonaayoola@gmail.com"
git config user.name "Noah"
git add -A
git commit -m "fix: correct API key header for Anthropic mind build (401 fix)"
git push
