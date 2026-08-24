export {
    encodeBase64UrlUtf8,
    encodeJsonBase64Url,
} from '../../shared/base64url.js';

function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function fromBase64Url(urlSafe) {
    let b64 = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    return b64;
}

export function decodeBase64UrlUtf8(encoded) {
    const bytes = base64ToBytes(fromBase64Url(encoded));
    return new TextDecoder().decode(bytes);
}

export function decodeJsonBase64Url(encoded) {
    try {
        return JSON.parse(decodeBase64UrlUtf8(encoded));
    } catch (_) {
        return null;
    }
}
