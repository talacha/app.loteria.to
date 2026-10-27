const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;

export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** JSON with recursively sorted object keys. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return (
      '{' +
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(o[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v);
}

export interface HostKeys {
  priv: CryptoKey;
  pub: string;
}

/** ECDSA P-256 pair; the private key is non-extractable but structured-cloneable (IndexedDB). */
export function generateHostKeyPair(): Promise<CryptoKeyPair> {
  return globalThis.crypto.subtle.generateKey(ALGO, false, ['sign', 'verify']);
}

export async function generateHostKeys(kp?: CryptoKeyPair): Promise<HostKeys> {
  kp ??= await generateHostKeyPair();
  const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', kp.publicKey));
  return { priv: kp.privateKey, pub: b64u(raw) };
}

export async function signMsg(priv: CryptoKey, m: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonical(m));
  return b64u(new Uint8Array(await globalThis.crypto.subtle.sign(SIGN, priv, data)));
}

export async function verifyMsg(pubKey: string, sig: string, m: unknown): Promise<boolean> {
  try {
    const key = await globalThis.crypto.subtle.importKey('raw', unb64u(pubKey), ALGO, false, [
      'verify',
    ]);
    const data = new TextEncoder().encode(canonical(m));
    return await globalThis.crypto.subtle.verify(SIGN, key, unb64u(sig), data);
  } catch {
    return false;
  }
}
