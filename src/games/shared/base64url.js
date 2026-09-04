function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function toBase64Url(standard) {
    return standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function encodeBase64UrlUtf8(text) {
    const bytes = new TextEncoder().encode(text);
    return toBase64Url(bytesToBase64(bytes));
}

export function encodeJsonBase64Url(value) {
    return encodeBase64UrlUtf8(JSON.stringify(value));
}
