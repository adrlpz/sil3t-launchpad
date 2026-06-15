#!/usr/bin/env bash
# Fast CREATE2 vanity salt finder using cast (foundry)
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"

FACTORY="0x2208A0710AAD12A20aE17791B94a54FA7123E1ed"
SUFFIX="51131"
BYTECODE_HASH=$(cast keccak "$(cat /tmp/token_bytecode.txt | tr -d '\n' | sed 's/^0x//')")
FACTORY_LOWER=$(echo "$FACTORY" | tr 'A-Z' 'a-z')
echo "Factory: $FACTORY"
echo "Suffix: $SUFFIX"
echo "Bytecode hash: $BYTECODE_HASH"
echo ""

START=$(date +%s)
for i in $(seq 1 10000000); do
  # random 32-byte salt
  SALT=$(openssl rand -hex 32)
  
  # compute CREATE2 address: keccak256(0xff ++ factory ++ salt ++ bytecode_hash)
  PREIMAGE="ff${FACTORY_LOWER#0x}${SALT}${BYTECODE_HASH#0x}"
  HASH=$(cast keccak "$PREIMAGE")
  
  # last 40 hex chars = address
  ADDR="${HASH: -40}"
  
  if [[ "$ADDR" == *"$SUFFIX" ]]; then
    ELAPSED=$(( $(date +%s) - START ))
    echo ""
    echo "✅ FOUND after $i iterations (${ELAPSED}s)"
    echo "   Salt: 0x$SALT"
    echo "   Address: 0x$ADDR"
    echo "{\"salt\":\"0x$SALT\",\"address\":\"0x$ADDR\",\"iterations\":$i}" > /tmp/vanity_salt.json
    exit 0
  fi
  
  if (( i % 100000 == 0 )); then
    ELAPSED=$(( $(date +%s) - START ))
    echo -ne "\rSearching... $i iterations (${ELAPSED}s)..."
  fi
done

echo "Not found after 10M iterations"
exit 1
