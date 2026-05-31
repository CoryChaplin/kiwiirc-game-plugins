export const PIECE_GLYPHS = {
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
    k: '♚',
};
export function getPieceGlyph(type) {
    return PIECE_GLYPHS[type] || '';
}
