function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function toBase64Url(standard) {
    return standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(urlSafe) {
    let b64 = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    return b64;
}

export function encodeBase64UrlUtf8(text) {
    const bytes = new TextEncoder().encode(text);
    return toBase64Url(bytesToBase64(bytes));
}

export function decodeBase64UrlUtf8(encoded) {
    const bytes = base64ToBytes(fromBase64Url(encoded));
    return new TextDecoder().decode(bytes);
}

export function encodeJsonBase64Url(value) {
    return encodeBase64UrlUtf8(JSON.stringify(value));
}

export function decodeJsonBase64Url(encoded) {
    try {
        return JSON.parse(decodeBase64UrlUtf8(encoded));
    } catch (_) {
        return null;
    }
}
