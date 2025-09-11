// chess.js
// Simple web-based chess game with basic AI

const canvas = document.getElementById('chessboard');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const newGameBtn = document.getElementById('new-game');
const resignBtn = document.getElementById('resign');

const SQUARE_SIZE = 60;
const BOARD_SIZE = 8;
const LIGHT_COLOR = '#f0d9b5';
const DARK_COLOR = '#b58863';

// Unicode chess pieces
const PIECES = {
    wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
    bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F'
};

let gameState = {};
let selected = null;
let legalMoves = [];

function initGame() {
    gameState = {
        board: [
            ['bR','bN','bB','bQ','bK','bB','bN','bR'],
            ['bP','bP','bP','bP','bP','bP','bP','bP'],
            [null,null,null,null,null,null,null,null],
            [null,null,null,null,null,null,null,null],
            [null,null,null,null,null,null,null,null],
            [null,null,null,null,null,null,null,null],
            ['wP','wP','wP','wP','wP','wP','wP','wP'],
            ['wR','wN','wB','wQ','wK','wB','wN','wR']
        ],
        turn: 'w',
        status: 'playing',
        history: [],
        canCastle: {wK: true, wQ: true, bK: true, bQ: true},
        enPassant: null
    };
    selected = null;
    legalMoves = [];
    drawBoard();
    updateStatus();
}

function drawBoard() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? LIGHT_COLOR : DARK_COLOR;
            ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            if (selected && selected.r === r && selected.c === c) {
                ctx.fillStyle = 'rgba(0,255,0,0.3)';
                ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }
            if (legalMoves.some(m => m.r === r && m.c === c)) {
                ctx.fillStyle = 'rgba(0,0,255,0.2)';
                ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }
            let piece = gameState.board[r][c];
            if (piece) {
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = piece[0] === 'w' ? '#fff' : '#222';
                ctx.fillText(PIECES[piece], c * SQUARE_SIZE + SQUARE_SIZE/2, r * SQUARE_SIZE + SQUARE_SIZE/2);
            }
        }
    }
}

function updateStatus() {
    if (gameState.status === 'playing') {
        statusDiv.textContent = (gameState.turn === 'w' ? "White's" : "Black's") + ' turn';
    } else {
        statusDiv.textContent = gameState.status;
    }
}

canvas.addEventListener('mousedown', handleBoardClick);
newGameBtn.addEventListener('click', initGame);
resignBtn.addEventListener('click', () => {
    if (gameState.status === 'playing') {
        gameState.status = gameState.turn === 'w' ? 'Black Wins!' : 'White Wins!';
        updateStatus();
    }
});

function handleBoardClick(e) {
    if (gameState.status !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const r = Math.floor(y / SQUARE_SIZE);
    const c = Math.floor(x / SQUARE_SIZE);
    const piece = gameState.board[r][c];
    if (selected) {
        if (legalMoves.some(m => m.r === r && m.c === c)) {
            makeMove(selected.r, selected.c, r, c);
            selected = null;
            legalMoves = [];
            drawBoard();
            updateStatus();
            if (gameState.status === 'playing' && gameState.turn === 'b') {
                setTimeout(aiMove, 500);
            }
            return;
        }
        selected = null;
        legalMoves = [];
        drawBoard();
        return;
    }
    if (piece && piece[0] === gameState.turn) {
        selected = {r, c};
        legalMoves = getLegalMoves(r, c);
        drawBoard();
    }
}

function makeMove(sr, sc, dr, dc) {
    // ...existing code...
    // Basic move logic, update board, switch turn, check for checkmate/stalemate
    const piece = gameState.board[sr][sc];
    const dest = gameState.board[dr][dc];
    gameState.board[dr][dc] = piece;
    gameState.board[sr][sc] = null;
    gameState.history.push({from: [sr, sc], to: [dr, dc], piece, dest});
    // TODO: Castling, en passant, pawn promotion
    // Check for checkmate/stalemate
    if (isCheckmate(gameState.turn === 'w' ? 'b' : 'w')) {
        gameState.status = (gameState.turn === 'w' ? 'White Wins! Checkmate!' : 'Black Wins! Checkmate!');
    } else if (isStalemate(gameState.turn === 'w' ? 'b' : 'w')) {
        gameState.status = 'Stalemate!';
    } else {
        gameState.turn = gameState.turn === 'w' ? 'b' : 'w';
    }
}

function getLegalMoves(r, c) {
    // ...existing code...
    // Returns array of {r, c} for legal moves for piece at r,c
    // TODO: Implement full chess rules
    const piece = gameState.board[r][c];
    if (!piece) return [];
    let moves = [];
    // Example: Pawn moves
    if (piece[1] === 'P') {
        let dir = piece[0] === 'w' ? -1 : 1;
        let nr = r + dir;
        if (nr >= 0 && nr < 8 && !gameState.board[nr][c]) {
            moves.push({r: nr, c});
            // First move double
            if ((piece[0] === 'w' && r === 6) || (piece[0] === 'b' && r === 1)) {
                if (!gameState.board[r + 2*dir][c]) moves.push({r: r + 2*dir, c});
            }
        }
        // Captures
        for (let dc of [-1,1]) {
            let nc = c + dc;
            if (nc >= 0 && nc < 8 && nr >= 0 && nr < 8) {
                let target = gameState.board[nr][nc];
                if (target && target[0] !== piece[0]) moves.push({r: nr, c: nc});
            }
        }
    }
    // TODO: Other pieces
    return moves;
}

function isCheckmate(color) {
    // TODO: Implement checkmate detection
    return false;
}
function isStalemate(color) {
    // TODO: Implement stalemate detection
    return false;
}

function aiMove() {
    // Simple AI: pick a random legal move
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let piece = gameState.board[r][c];
            if (piece && piece[0] === 'b') {
                let lm = getLegalMoves(r, c);
                for (let m of lm) moves.push({from: {r, c}, to: m});
            }
        }
    }
    if (moves.length === 0) return;
    // Minimax depth 1: prefer captures
    let best = moves[0];
    let bestScore = -Infinity;
    for (let move of moves) {
        let target = gameState.board[move.to.r][move.to.c];
        let score = target ? getPieceValue(target) : 0;
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    makeMove(best.from.r, best.from.c, best.to.r, best.to.c);
    drawBoard();
    updateStatus();
}
function getPieceValue(piece) {
    switch (piece[1]) {
        case 'P': return 1;
        case 'N': case 'B': return 3;
        case 'R': return 5;
        case 'Q': return 9;
        case 'K': return 100;
        default: return 0;
    }
}

window.onload = initGame;
