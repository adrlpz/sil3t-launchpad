#!/usr/bin/env node
// Fast CREATE2 vanity salt finder using pure Node.js + @noble/hashes keccak
// Ported from the ethers version but much faster

const { keccak256 } = require('@noble/hashes/sha3');
const crypto = require('crypto');
const fs = require('fs');

const FACTORY = process.argv[2] || '0x2208A0710AAD12A20aE17791B94a54FA7123E1ed';
const SUFFIX = process.argv[3] || '51131';
const BYTECODE = process.argv[4] || fs.readFileSync('/tmp/token_bytecode.txt', 'utf8').trim();

const bytecodeHex = BYTECODE.startsWith('0x') ? BYTECODE : `0x${BYTECODE}`;

console.log(`Factory: ${FACTORY}`);
console.log(`Suffix: ${SUFFIX}`);
console.log(`Bytecode length: ${bytecodeHex.length} chars`);

// Compute bytecode hash
const bytecodeBytes = Buffer.from(bytecodeHex.slice(2), 'hex');
const bytecodeHash = keccak256(bytecodeBytes);
console.log(`Bytecode hash: 0x${Buffer.from(bytecodeHash).toString('hex')}`);
console.log('');

const factoryBytes = Buffer.from(FACTORY.slice(2), 'hex');
const suffixBuf = Buffer.from(SUFFIX, 'utf8');

const MAX = 10_000_000;
const start = Date.now();

for (let i = 0; i < MAX; i++) {
  // Generate random 32-byte salt
  const salt = crypto.randomBytes(32);

  // CREATE2: keccak256(0xff ++ factory ++ salt ++ bytecodeHash)
  const preimage = Buffer.concat([
    Buffer.from([0xff]),
    factoryBytes,
    salt,
    Buffer.from(bytecodeHash),
  ]);

  const hash = keccak256(preimage);
  const addrHex = Buffer.from(hash).subarray(12).toString('hex'); // last 20 bytes

  if (addrHex.endsWith(SUFFIX)) {
    const elapsed = (Date.now() - start) / 1000;
    const rate = Math.round(i / elapsed);
    const saltHex = `0x${salt.toString('hex')}`;
    const address = `0x${addrHex}`;

    console.log(`\n✅ FOUND after ${i.toLocaleString()} iterations (${elapsed.toFixed(1)}s, ${rate.toLocaleString()}/s)`);
    console.log(`   Salt: ${saltHex}`);
    console.log(`   Address: ${address}`);

    fs.writeFileSync('/tmp/vanity_salt.json', JSON.stringify({ salt: saltHex, address, iterations: i }, null, 2));
    console.log('   Saved to /tmp/vanity_salt.json');
    process.exit(0);
  }

  if (i % 500_000 === 0 && i > 0) {
    const elapsed = (Date.now() - start) / 1000;
    const rate = Math.round(i / elapsed);
    process.stderr.write(`\rSearching... ${i.toLocaleString()} iterations (${elapsed.toFixed(1)}s, ${rate.toLocaleString()}/s)`);
  }
}

console.log(`\n❌ Not found after ${MAX.toLocaleString()} iterations`);
process.exit(1);
