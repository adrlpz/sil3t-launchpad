import { keccak256, toBytes, hexToBytes, bytesToHex, concat } from 'viem';
import { writeFileSync } from 'fs';

const FACTORY = '0x2208A0710AAD12A20aE17791B94a54FA7123E1ed';
const SUFFIX = '51131';
const BYTECODE = process.argv[2];

if (!BYTECODE) {
  console.error('Usage: node find.mjs <bytecode_hex>');
  process.exit(1);
}

const factoryBytes = hexToBytes(FACTORY);
const bytecodeHash = keccak256(BYTECODE).slice(2);
const bytecodeHashBytes = hexToBytes(`0x${bytecodeHash}`);

const suffixBytes = toBytes(SUFFIX);
const suffixHex = Buffer.from(SUFFIX, 'utf8').toString('hex');

console.log(`Factory: ${FACTORY}`);
console.log(`Suffix: ${SUFFIX} (hex: ${suffixHex})`);
console.log(`Bytecode hash: 0x${bytecodeHash}`);
console.log('');

const MAX = 10_000_000;
const start = Date.now();

for (let i = 0; i < MAX; i++) {
  // Generate salt from counter + random
  const salt = new Uint8Array(32);
  const view = new DataView(salt.buffer);
  view.setBigUint64(0, BigInt(i));
  view.setBigUint64(8, BigInt(Date.now() + i));
  // Fill rest with random
  for (let j = 16; j < 32; j++) salt[j] = Math.floor(Math.random() * 256);

  // CREATE2: keccak256(0xff ++ factory ++ salt ++ bytecodeHash)
  const preimage = concat([
    new Uint8Array([0xff]),
    factoryBytes,
    salt,
    bytecodeHashBytes,
  ]);

  const hash = keccak256(preimage);
  const addrHex = hash.slice(2 + 24); // last 20 bytes = 40 hex chars

  if (addrHex.endsWith(suffixHex)) {
    const elapsed = (Date.now() - start) / 1000;
    const rate = Math.round(i / elapsed);
    const saltHex = bytesToHex(salt);

    console.log(`✅ FOUND after ${i.toLocaleString()} iterations (${elapsed.toFixed(1)}s, ${rate.toLocaleString()}/s)`);
    console.log(`   Salt: ${saltHex}`);
    console.log(`   Address: 0x${addrHex}`);

    writeFileSync('/tmp/vanity_salt.json', JSON.stringify({
      salt: saltHex,
      address: `0x${addrHex}`,
      iterations: i,
    }, null, 2));

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
