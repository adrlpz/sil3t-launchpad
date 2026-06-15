#!/usr/bin/env node

/**
 * siL3t Vanity Salt Finder
 * 
 * Finds a CREATE2 salt that produces a token address ending with "51131"
 * 
 * Usage:
 *   node findSalt.js [factory] [suffix] [bytecode]
 *   node findSalt.js 0x1234... sil3t 0x6080...
 * 
 * Or import as module:
 *   const { findSalt } = require('./findSalt');
 */

const { keccak256 } = require('@ethersproject/keccak256');
const { concat } = require('@ethersproject/bytes');

// ─── Default Config ────────────────────────────────────────

const DEFAULT_SUFFIX = '51131';
const MAX_ITERATIONS = 10_000_000; // 10M max (5 chars ≈ 1M avg)

// ─── Core: Salt Finder ────────────────────────────────────

/**
 * Find a salt that produces a CREATE2 address ending with suffix (hex-valid)
 * @param {string} factory - Factory contract address (checksummed)
 * @param {string} suffix - Suffix to match (e.g., "51131")
 * @param {string} bytecode - Contract creation bytecode (hex string with 0x prefix)
 * @param {function} onProgress - Progress callback (optional)
 * @returns {{ salt: string, address: string, iterations: number }}
 */
function findSalt(factory, suffix, bytecode, onProgress) {
  factory = factory.toLowerCase();
  suffix = suffix.toLowerCase();
  bytecode = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;

  const factoryBytes = factory.slice(2).padStart(40, '0');
  const bytecodeHash = keccak256(bytecode).slice(2);

  const suffixBytes = Buffer.from(suffix, 'utf8');
  const suffixHex = suffixBytes.toString('hex');

  let iterations = 0;
  const startTime = Date.now();

  while (iterations < MAX_ITERATIONS) {
    // Generate random salt (32 bytes)
    const salt = generateSalt(iterations);
    const saltHex = salt.toString('hex').padStart(64, '0');

    // Compute CREATE2 address
    // hash = keccak256(0xff ++ factory ++ salt ++ keccak256(bytecode))
    const preimage = `ff${factoryBytes}${saltHex}${bytecodeHash}`;
    const hash = keccak256(`0x${preimage}`);

    // Get last 40 chars (20 bytes) = address without 0x
    const addressHex = hash.slice(2 + 24); // skip 12 bytes (24 hex chars)

    // Check if address ends with suffix
    if (addressHex.endsWith(suffixHex)) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(iterations / elapsed);
      console.log(`\n✅ FOUND after ${iterations.toLocaleString()} iterations (${elapsed.toFixed(1)}s, ${rate.toLocaleString()}/s)`);
      console.log(`   Salt: 0x${saltHex}`);
      console.log(`   Address: 0x${addressHex}`);
      return {
        salt: `0x${saltHex}`,
        address: `0x${addressHex}`,
        iterations,
      };
    }

    iterations++;

    // Progress log
    if (iterations % 100000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(iterations / elapsed);
      const msg = `   Searching... ${iterations.toLocaleString()} iterations (${elapsed.toFixed(1)}s, ${rate.toLocaleString()}/s)`;
      if (onProgress) onProgress(iterations, msg);
      else process.stderr.write(`\r${msg}`);
    }

    // Also try incrementing salt with random offset
    iterations++;
    const salt2 = generateSalt(iterations + 123456789);
    const saltHex2 = salt2.toString('hex').padStart(64, '0');
    const preimage2 = `ff${factoryBytes}${saltHex2}${bytecodeHash}`;
    const hash2 = keccak256(`0x${preimage2}`);
    const addressHex2 = hash2.slice(2 + 24);

    if (addressHex2.endsWith(suffixHex)) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(iterations / elapsed);
      console.log(`\n✅ FOUND after ${iterations.toLocaleString()} iterations (${elapsed.toFixed(1)}s, ${rate.toLocaleString()}/s)`);
      console.log(`   Salt: 0x${saltHex2}`);
      console.log(`   Address: 0x${addressHex2}`);
      return {
        salt: `0x${saltHex2}`,
        address: `0x${addressHex2}`,
        iterations,
      };
    }
  }

  console.log(`\n❌ Not found after ${MAX_ITERATIONS.toLocaleString()} iterations`);
  return null;
}

// ─── Helpers ──────────────────────────────────────────────

function generateSalt(seed) {
  // Use seed-based pseudo-random for reproducibility
  const crypto = require('crypto');
  const hash = keccak256(`0x${seed.toString(16).padStart(64, '0')}`);
  return Buffer.from(hash.slice(2), 'hex');
}

// ─── CLI ──────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse args
  const factory = args[0] || process.env.FACTORY_ADDRESS;
  const suffix = args[1] || DEFAULT_SUFFIX;
  const bytecode = args[2] || process.env.TOKEN_BYTECODE;

  if (!factory) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║         siL3t Vanity Salt Finder                          ║
╚═══════════════════════════════════════════════════════════╝

Usage:
  node findSalt.js <factory_address> [suffix] [bytecode]

Args:
  factory_address  CREATE2 factory address (required)
  suffix           Address suffix to find (default: "51131")
  bytecode         Token creation bytecode (hex, optional)

Environment:
  FACTORY_ADDRESS  Factory address (alternative to arg)
  TOKEN_BYTECODE   Token bytecode (alternative to arg)

Example:
  # With bytecode
  node findSalt.js 0x1234...5678 sil3t 0x6080604052...

  # Or let script compute bytecode from SiL3tToken defaults
  node findSalt.js 0x1234...5678 sil3t

Output:
  Salt: 0x...
  Address: 0x...sil3t
  
  Use this salt in SiL3tFactory.deployToken(salt, ...)
`);
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         siL3t Vanity Salt Finder                          ║
╚═══════════════════════════════════════════════════════════╝

Factory: ${factory}
Suffix:  ${suffix} (hex-valid ✓)
Mode:    ${bytecode ? 'custom bytecode' : 'default SiL3tToken bytecode'}
`);

  // If no bytecode provided, use a placeholder (user needs to provide actual bytecode)
  if (!bytecode) {
    console.log('⚠️  No bytecode provided. Use TOKEN_BYTECODE env var or pass as 3rd arg.');
    console.log('   Get bytecode from: forge inspect SiL3tToken bytecode');
    console.log('   Example: node findSalt.js 0xFACTORY sil3t "$(forge inspect SiL3tToken bytecode)"');
    process.exit(1);
  }

  console.log('Starting search...\n');
  findSalt(factory, suffix, bytecode);
}

module.exports = { findSalt };
