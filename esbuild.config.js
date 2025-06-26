import { build } from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

await build({
  entryPoints: ["src/content.ts"],
  bundle: true,
  outfile: "dist/content.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    NodeModulesPolyfillPlugin(),
    NodeGlobalsPolyfillPlugin({
      process: true,
      buffer: true,
    }),
  ],
  inject: ["./node-polyfill.js"],
  banner: {
    js: `(() => {
      // Ensure BigInt is available and working
      if (typeof BigInt === 'undefined') {
        throw new Error('BigInt is not supported in this environment');
      }
             // Ensure native BigInt constructor is used with safe wrapper
       const originalBigInt = BigInt;
       globalThis.BigInt = function(value) {
         try {
           // Handle problematic format like "0x0,0,0,0,0,0,0,1"
           if (typeof value === 'string' && value.includes(',')) {
             const cleanHex = value.replace(/^0x/, '').replace(/,/g, '');
             if (cleanHex.match(/^[0-9a-fA-F]+$/)) {
               return originalBigInt('0x' + cleanHex);
             }
           }
           return originalBigInt(value);
         } catch (error) {
           console.warn('BigInt conversion failed for value:', value, 'returning 0');
           return originalBigInt(0);
         }
       };
       // Preserve original BigInt properties
       Object.setPrototypeOf(globalThis.BigInt, originalBigInt);
       globalThis.BigInt.asIntN = originalBigInt.asIntN;
       globalThis.BigInt.asUintN = originalBigInt.asUintN;
      
      // Fix BigInt conversion issues
      if (typeof Buffer !== 'undefined' && Buffer.prototype) {
        // Ensure readBigUInt64LE exists and works correctly
        if (!Buffer.prototype.readBigUInt64LE) {
          Buffer.prototype.readBigUInt64LE = function(offset = 0) {
            const buf = this.slice(offset, offset + 8);
            let result = BigInt(0);
            for (let i = 0; i < 8; i++) {
              result += BigInt(buf[i]) << (BigInt(i) * BigInt(8));
            }
            return result;
          };
        }
      }
      
      // Override toBigIntLE functions that are causing issues
      const safeToBigIntLE = function(bytes, offset = 0, length = 8) {
          try {
            if (typeof bytes === 'string') {
              // Handle hex string input
              const hex = bytes.replace(/^0x/, '').replace(/,/g, '');
              return BigInt('0x' + hex);
            }
            
            if (Array.isArray(bytes)) {
              // Handle array input like [0,0,0,0,0,0,0,1]
              let result = BigInt(0);
              for (let i = 0; i < Math.min(bytes.length, length); i++) {
                result += BigInt(bytes[i] || 0) << (BigInt(i) * BigInt(8));
              }
              return result;
            }
            
            if (bytes instanceof Uint8Array) {
              // Handle Uint8Array
              let result = BigInt(0);
              for (let i = 0; i < Math.min(bytes.length - offset, length); i++) {
                result += BigInt(bytes[offset + i] || 0) << (BigInt(i) * BigInt(8));
              }
              return result;
            }
            
            return BigInt(0);
                     } catch (error) {
             console.warn('toBigIntLE conversion failed, returning 0:', error);
             return BigInt(0);
           }
         };
         
         // Apply the safe function to various possible global locations
         if (typeof window !== 'undefined') {
           window.toBigIntLE = safeToBigIntLE;
           window.toBigIntLE2 = safeToBigIntLE;
         }
         if (typeof globalThis !== 'undefined') {
           globalThis.toBigIntLE = safeToBigIntLE;
           globalThis.toBigIntLE2 = safeToBigIntLE;
         }
    `,
  },
  footer: {
    js: "})();",
  },
}).catch(() => process.exit(1));
