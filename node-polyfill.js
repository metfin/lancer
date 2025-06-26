// Node.js polyfills for browser environment
const process = {
  env: { NODE_ENV: "production" },
  nextTick: (fn) => setTimeout(fn, 0),
  platform: "browser",
  version: "v16.0.0",
  versions: { node: "16.0.0" },
  cwd: () => "/",
  chdir: () => {},
  exit: () => {},
  argv: [],
  pid: 1,
  title: "browser",
  arch: "x64",
  execPath: "/usr/bin/node",
  execArgv: [],
};

// TextEncoder/TextDecoder polyfill
if (typeof TextEncoder === "undefined") {
  globalThis.TextEncoder = class TextEncoder {
    encode(str) {
      const encoder = new Array(str.length);
      for (let i = 0; i < str.length; i++) {
        encoder[i] = str.charCodeAt(i);
      }
      return new Uint8Array(encoder);
    }
  };
}

if (typeof TextDecoder === "undefined") {
  globalThis.TextDecoder = class TextDecoder {
    decode(bytes) {
      return String.fromCharCode(...bytes);
    }
  };
}

// Basic Buffer polyfill
const Buffer = globalThis.Buffer || {
  from: (data, encoding) => {
    if (typeof data === "string") {
      const encoder = new TextEncoder();
      return encoder.encode(data);
    }
    return new Uint8Array(data);
  },
  isBuffer: (obj) => obj instanceof Uint8Array,
  concat: (arrays) => {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  },
  alloc: (size, fill = 0) => {
    const buf = new Uint8Array(size);
    buf.fill(fill);
    return buf;
  },
};

// Make these available globally
globalThis.process = process;
globalThis.Buffer = Buffer;
globalThis.global = globalThis;

// Export for the inject mechanism
export { process, Buffer };
