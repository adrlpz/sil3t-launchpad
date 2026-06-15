const { findSalt } = require('./findSalt.js');
const fs = require('fs');

const FACTORY = '0x2208A0710AAD12A20aE17791B94a54FA7123E1ed';
const SUFFIX = '51131';

// Read bytecode from forge output
const bytecode = fs.readFileSync('/tmp/token_bytecode.txt', 'utf8').trim();
const bytecodeHex = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;

console.log(`Factory: ${FACTORY}`);
console.log(`Suffix: ${SUFFIX}`);
console.log(`Bytecode length: ${bytecodeHex.length} chars`);
console.log('');

const result = findSalt(FACTORY, SUFFIX, bytecodeHex);

if (result) {
  console.log('\n=== RESULT ===');
  console.log(`Salt: ${result.salt}`);
  console.log(`Address: ${result.address}`);
  console.log(`Iterations: ${result.iterations}`);
  
  // Save to file for use in forge script
  fs.writeFileSync('/tmp/vanity_salt.json', JSON.stringify(result, null, 2));
  console.log('\nSaved to /tmp/vanity_salt.json');
}
