// Advanced Chess Practice - JavaScript Application
class ChessApp {
    constructor() {
        this.gameId = null;
        this.gameState = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.playerColor = 'white';
        this.gameStartTime = null;
        this.gameTimer = null;
        this.moveHistory = [];
        this.isPlayerTurn = true;
        
        // Chess piece Unicode symbols
        this.pieces = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
        };
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.setupEventListeners();
        this.createBoard();
        this.updateChessTips();
    }
    
    setupEventListeners() {
        // Game setup controls
        document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
        document.getElementById('hint-btn').addEventListener('click', () => this.getHint());
        document.getElementById('analysis-btn').addEventListener('click', () => this.getAnalysis());
        document.getElementById('resign-btn').addEventListener('click', () => this.resignGame());
        
        // Move input
        document.getElementById('make-move-btn').addEventListener('click', () => this.makeTextMove());
        document.getElementById('move-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.makeTextMove();
        });
        
        // Modal controls
        document.getElementById('new-game-modal-btn').addEventListener('click', () => {
            this.hideModal('game-over-modal');
            this.startNewGame();
        });
        
        document.getElementById('analyze-game-btn').addEventListener('click', () => {
            this.hideModal('game-over-modal');
            this.getAnalysis();
        });
        
        // Game mode change
        document.getElementById('game-mode').addEventListener('change', (e) => {
            const difficultyGroup = document.getElementById('difficulty').parentElement;
            if (e.target.value === 'analysis') {
                difficultyGroup.style.display = 'none';
            } else {
                difficultyGroup.style.display = 'block';
            }
        });
    }
    
    createBoard() {
        const board = document.getElementById('chess-board');
        board.innerHTML = '';
        
        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                const squareName = String.fromCharCode(97 + file) + rank;
                
                square.className = `square ${(rank + file) % 2 === 0 ? 'dark' : 'light'}`;
                square.dataset.square = squareName;
                square.addEventListener('click', () => this.handleSquareClick(squareName));
                
                board.appendChild(square);
            }
        }
    }
    
    async startNewGame() {
        const mode = document.getElementById('game-mode').value;
        const difficulty = document.getElementById('difficulty').value;
        this.playerColor = document.getElementById('player-color').value;
        
        this.showLoading();
        
        try {
            const response = await fetch('/api/new_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mode: mode,
                    difficulty: difficulty
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameId = data.game_id;
                this.gameState = data.game_state;
                this.gameStartTime = new Date();
                this.moveHistory = [];
                this.selectedSquare = null;
                this.legalMoves = [];
                this.isPlayerTurn = true;
                
                this.updateBoard();
                this.updateGameStatus();
                this.updateGameStats();
                this.clearMoveHistory();
                this.startGameTimer();
                
                // If player is black and it's AI mode, AI makes first move
                if (this.playerColor === 'black' && mode === 'ai') {
                    this.isPlayerTurn = false;
                    setTimeout(() => this.waitForAIMove(), 1000);
                }
            } else {
                this.showError('Failed to start new game: ' + data.error);
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    async handleSquareClick(squareName) {
        if (!this.gameId || !this.isPlayerTurn || this.gameState.game_over) {
            return;
        }
        
        // If a square is already selected
        if (this.selectedSquare) {
            if (this.selectedSquare === squareName) {
                // Deselect the same square
                this.clearSelection();
                return;
            }
            
            // Try to make a move
            const moveUci = this.selectedSquare + squareName;
            if (this.legalMoves.includes(moveUci)) {
                await this.makeMove(moveUci);
                return;
            }
        }
        
        // Select a new square if it has a piece of the current player
        const piece = this.getPieceAt(squareName);
        if (piece && this.isPieceOwnedByPlayer(piece)) {
            this.selectSquare(squareName);
        } else {
            this.clearSelection();
        }
    }
    
    selectSquare(squareName) {
        this.clearSelection();
        this.selectedSquare = squareName;
        
        // Get legal moves for this square
        this.legalMoves = this.gameState.legal_moves.filter(move => 
            move.startsWith(squareName)
        );
        
        this.highlightSquares();
    }
    
    clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.clearHighlights();
    }
    
    highlightSquares() {
        this.clearHighlights();
        
        if (this.selectedSquare) {
            const selectedElement = document.querySelector(`[data-square="${this.selectedSquare}"]`);
            if (selectedElement) {
                selectedElement.classList.add('selected');
            }
        }
        
        // Highlight legal move destinations
        this.legalMoves.forEach(move => {
            const toSquare = move.substring(2, 4);
            const element = document.querySelector(`[data-square="${toSquare}"]`);
            if (element) {
                const piece = this.getPieceAt(toSquare);
                if (piece) {
                    element.classList.add('capture-move');
                } else {
                    element.classList.add('legal-move');
                }
            }
        });
    }
    
    clearHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'legal-move', 'capture-move', 'last-move', 'check');
        });
    }
    
    async makeMove(moveUci) {
        if (!this.gameId) return;
        
        this.showLoading();
        this.isPlayerTurn = false;
        
        try {
            const response = await fetch('/api/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameId,
                    move: moveUci
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.game_state;
                this.clearSelection();
                this.updateBoard();
                this.updateGameStatus();
                this.updateGameStats();
                this.addMoveToHistory(moveUci);
                
                // Highlight last move
                this.highlightLastMove(moveUci);
                
                if (this.gameState.game_over) {
                    this.endGame();
                } else if (data.ai_move) {
                    // AI made a move
                    this.addMoveToHistory(data.ai_move);
                    this.highlightLastMove(data.ai_move);
                    this.isPlayerTurn = true;
                } else {
                    this.isPlayerTurn = true;
                }
                
                // Clear move input
                document.getElementById('move-input').value = '';
            } else {
                this.showError('Invalid move: ' + data.error);
                this.isPlayerTurn = true;
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
            this.isPlayerTurn = true;
        } finally {
            this.hideLoading();
        }
    }
    
    async makeTextMove() {
        const moveInput = document.getElementById('move-input');
        const moveText = moveInput.value.trim().toLowerCase();
        
        if (moveText.length >= 4) {
            await this.makeMove(moveText);
        }
    }
    
    async waitForAIMove() {
        // This is called when AI should move first (player is black)
        this.showLoading();
        
        // Wait a bit for the AI to "think"
        setTimeout(async () => {
            try {
                const response = await fetch(`/api/game/${this.gameId}`);
                const data = await response.json();
                
                if (data.success) {
                    this.gameState = data.game_state;
                    this.updateBoard();
                    this.updateGameStatus();
                    this.updateGameStats();
                    this.isPlayerTurn = true;
                }
            } catch (error) {
                this.showError('Error getting game state: ' + error.message);
            } finally {
                this.hideLoading();
            }
        }, 1500);
    }
    
    async getHint() {
        if (!this.gameId || !this.isPlayerTurn) return;
        
        try {
            const response = await fetch('/api/hint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: this.gameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const hint = data.hint;
                const fromSquare = hint.substring(0, 2);
                const toSquare = hint.substring(2, 4);
                
                // Highlight the hint move
                this.clearHighlights();
                const fromElement = document.querySelector(`[data-square="${fromSquare}"]`);
                const toElement = document.querySelector(`[data-square="${toSquare}"]`);
                
                if (fromElement) fromElement.classList.add('selected');
                if (toElement) toElement.classList.add('legal-move');
                
                // Update hints remaining
                document.getElementById('hints-remaining').textContent = data.hints_remaining;
                
                // Show hint in move input
                document.getElementById('move-input').value = hint;
                
                this.showMessage(`Hint: ${fromSquare} to ${toSquare}`, 'info');
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Error getting hint: ' + error.message);
        }
    }
    
    async getAnalysis() {
        if (!this.gameId) return;
        
        try {
            const response = await fetch(`/api/analysis/${this.gameId}`);
            const data = await response.json();
            
            if (data.success) {
                const analysis = data.analysis;
                
                // Update analysis display
                document.getElementById('analysis-material').textContent = 
                    analysis.material_balance > 0 ? `+${analysis.material_balance}` : 
                    analysis.material_balance < 0 ? `${analysis.material_balance}` : '0';
                
                document.getElementById('analysis-center').textContent = 
                    analysis.center_control > 0 ? `+${analysis.center_control}` : 
                    analysis.center_control < 0 ? `${analysis.center_control}` : '0';
                
                // Update suggestions
                const suggestionsList = document.getElementById('suggestions-list');
                suggestionsList.innerHTML = '';
                
                analysis.suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    li.textContent = suggestion;
                    suggestionsList.appendChild(li);
                });
                
                if (analysis.suggestions.length === 0) {
                    const li = document.createElement('li');
                    li.textContent = 'Position looks good!';
                    suggestionsList.appendChild(li);
                }
            }
        } catch (error) {
            this.showError('Error getting analysis: ' + error.message);
        }
    }
    
    resignGame() {
        if (!this.gameId || this.gameState.game_over) return;
        
        if (confirm('Are you sure you want to resign?')) {
            this.gameState.game_over = true;
            this.gameState.result = this.playerColor === 'white' ? 'Black wins by resignation' : 'White wins by resignation';
            this.endGame();
        }
    }
    
    updateBoard() {
        if (!this.gameState) return;
        
        const fen = this.gameState.fen;
        const position = this.parseFEN(fen);
        
        // Clear all squares
        document.querySelectorAll('.square').forEach(square => {
            square.innerHTML = '';
        });
        
        // Place pieces
        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 0; file < 8; file++) {
                const squareName = String.fromCharCode(97 + file) + rank;
                const piece = position[squareName];
                
                if (piece) {
                    const square = document.querySelector(`[data-square="${squareName}"]`);
                    if (square) {
                        const pieceElement = document.createElement('span');
                        pieceElement.className = 'piece';
                        pieceElement.textContent = this.pieces[piece];
                        square.appendChild(pieceElement);
                    }
                }
            }
        }
        
        // Highlight check
        if (this.gameState.is_check) {
            const kingSquare = this.findKingSquare(this.gameState.turn);
            if (kingSquare) {
                const kingElement = document.querySelector(`[data-square="${kingSquare}"]`);
                if (kingElement) {
                    kingElement.classList.add('check');
                }
            }
        }
    }
    
    updateGameStatus() {
        const turnIndicator = document.getElementById('current-turn');
        const gameResult = document.getElementById('game-result');
        
        if (this.gameState.game_over) {
            turnIndicator.style.display = 'none';
            gameResult.style.display = 'block';
            gameResult.textContent = this.gameState.result;
            
            // Add appropriate class for styling
            gameResult.className = 'game-result';
            if (this.gameState.result.includes('wins')) {
                if ((this.playerColor === 'white' && this.gameState.result.includes('White')) ||
                    (this.playerColor === 'black' && this.gameState.result.includes('Black'))) {
                    gameResult.classList.add('win');
                } else {
                    gameResult.classList.add('loss');
                }
            } else {
                gameResult.classList.add('draw');
            }
        } else {
            turnIndicator.style.display = 'flex';
            gameResult.style.display = 'none';
            
            const currentPlayer = this.gameState.turn === 'white' ? 'White' : 'Black';
            const icon = this.gameState.turn === 'white' ? '♔' : '♚';
            turnIndicator.innerHTML = `<i class="fas fa-chess-pawn"></i><span>${currentPlayer} to move</span>`;
            
            if (this.gameState.is_check) {
                turnIndicator.innerHTML += ' <span style="color: #e74c3c; font-weight: bold;">(Check!)</span>';
            }
        }
    }
    
    updateGameStats() {
        document.getElementById('move-count').textContent = this.gameState.move_count;
        document.getElementById('hints-remaining').textContent = 3 - this.gameState.hints_used;
        
        // Update material balance
        const materialElement = document.getElementById('material-balance');
        // This would need to be calculated from the position
        materialElement.textContent = 'Equal'; // Simplified for now
    }
    
    addMoveToHistory(moveUci) {
        const movesContainer = document.getElementById('moves-list');
        const moveNumber = Math.floor(this.moveHistory.length / 2) + 1;
        const isWhiteMove = this.moveHistory.length % 2 === 0;
        
        if (isWhiteMove) {
            // Create new move pair
            const movePair = document.createElement('div');
            movePair.className = 'move-pair';
            
            const moveNumberSpan = document.createElement('span');
            moveNumberSpan.className = 'move-number';
            moveNumberSpan.textContent = moveNumber + '.';
            
            const whiteMove = document.createElement('span');
            whiteMove.className = 'move-white';
            whiteMove.textContent = this.moveToSAN(moveUci);
            
            const blackMove = document.createElement('span');
            blackMove.className = 'move-black';
            blackMove.textContent = '...';
            
            movePair.appendChild(moveNumberSpan);
            movePair.appendChild(whiteMove);
            movePair.appendChild(blackMove);
            
            movesContainer.appendChild(movePair);
        } else {
            // Update existing move pair with black move
            const lastMovePair = movesContainer.lastElementChild;
            if (lastMovePair) {
                const blackMoveSpan = lastMovePair.querySelector('.move-black');
                if (blackMoveSpan) {
                    blackMoveSpan.textContent = this.moveToSAN(moveUci);
                }
            }
        }
        
        this.moveHistory.push(moveUci);
        movesContainer.scrollTop = movesContainer.scrollHeight;
    }
    
    clearMoveHistory() {
        document.getElementById('moves-list').innerHTML = '';
        this.moveHistory = [];
    }
    
    highlightLastMove(moveUci) {
        this.clearHighlights();
        
        const fromSquare = moveUci.substring(0, 2);
        const toSquare = moveUci.substring(2, 4);
        
        const fromElement = document.querySelector(`[data-square="${fromSquare}"]`);
        const toElement = document.querySelector(`[data-square="${toSquare}"]`);
        
        if (fromElement) fromElement.classList.add('last-move');
        if (toElement) toElement.classList.add('last-move');
    }
    
    startGameTimer() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.gameTimer = setInterval(() => {
            if (this.gameStartTime) {
                const elapsed = new Date() - this.gameStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                document.getElementById('game-time').textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    endGame() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.isPlayerTurn = false;
        this.showModal('game-over-modal');
        
        const title = document.getElementById('game-over-title');
        const message = document.getElementById('game-over-message');
        
        title.textContent = 'Game Over';
        message.textContent = this.gameState.result;
    }
    
    // Utility methods
    parseFEN(fen) {
        const position = {};
        const parts = fen.split(' ');
        const boardPart = parts[0];
        const ranks = boardPart.split('/');
        
        for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
            const rank = 8 - rankIndex;
            const rankData = ranks[rankIndex];
            let file = 0;
            
            for (let char of rankData) {
                if (char >= '1' && char <= '8') {
                    file += parseInt(char);
                } else {
                    const squareName = String.fromCharCode(97 + file) + rank;
                    position[squareName] = char;
                    file++;
                }
            }
        }
        
        return position;
    }
    
    getPieceAt(squareName) {
        if (!this.gameState) return null;
        const position = this.parseFEN(this.gameState.fen);
        return position[squareName] || null;
    }
    
    isPieceOwnedByPlayer(piece) {
        if (!piece) return false;
        
        const isWhitePiece = piece === piece.toUpperCase();
        const isPlayerWhite = this.playerColor === 'white';
        const isCurrentTurn = this.gameState.turn === (isWhitePiece ? 'white' : 'black');
        
        return (isWhitePiece === isPlayerWhite) && isCurrentTurn;
    }
    
    findKingSquare(color) {
        if (!this.gameState) return null;
        
        const position = this.parseFEN(this.gameState.fen);
        const kingPiece = color === 'white' ? 'K' : 'k';
        
        for (let square in position) {
            if (position[square] === kingPiece) {
                return square;
            }
        }
        
        return null;
    }
    
    moveToSAN(moveUci) {
        // Simplified move notation - in a real app, you'd convert UCI to SAN properly
        const fromSquare = moveUci.substring(0, 2);
        const toSquare = moveUci.substring(2, 4);
        const piece = this.getPieceAt(fromSquare);
        
        if (!piece) return moveUci;
        
        const pieceType = piece.toLowerCase();
        let notation = '';
        
        if (pieceType === 'p') {
            // Pawn move
            if (fromSquare[0] !== toSquare[0]) {
                // Capture
                notation = fromSquare[0] + 'x' + toSquare;
            } else {
                notation = toSquare;
            }
        } else {
            // Piece move
            const pieceSymbol = pieceType.toUpperCase();
            const capturedPiece = this.getPieceAt(toSquare);
            
            notation = pieceSymbol;
            if (capturedPiece) {
                notation += 'x';
            }
            notation += toSquare;
        }
        
        return notation;
    }
    
    updateChessTips() {
        const tips = [
            {
                title: "Opening Principles",
                content: [
                    "Control the center with pawns (e4, d4)",
                    "Develop knights before bishops",
                    "Castle early for king safety",
                    "Don't move the same piece twice"
                ]
            },
            {
                title: "Tactical Patterns",
                content: [
                    "Look for forks, pins, and skewers",
                    "Check for back-rank weaknesses",
                    "Watch for discovered attacks",
                    "Calculate forcing moves first"
                ]
            },
            {
                title: "Endgame Tips",
                content: [
                    "Activate your king in the endgame",
                    "Push passed pawns",
                    "Centralize your pieces",
                    "Learn basic checkmate patterns"
                ]
            }
        ];
        
        const tipsContainer = document.getElementById('chess-tips');
        tipsContainer.innerHTML = '';
        
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        
        const tipElement = document.createElement('div');
        tipElement.className = 'tip';
        
        const titleElement = document.createElement('strong');
        titleElement.textContent = randomTip.title + ':';
        
        const listElement = document.createElement('ul');
        randomTip.content.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item;
            listElement.appendChild(listItem);
        });
        
        tipElement.appendChild(titleElement);
        tipElement.appendChild(listElement);
        tipsContainer.appendChild(tipElement);
    }
    
    // UI Helper methods
    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
    
    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }
    
    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }
    
    showMessage(message, type = 'info') {
        // Create a temporary message element
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(messageElement);
        
        setTimeout(() => {
            messageElement.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, 3000);
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
}

// Initialize the chess application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChessApp();
});

// Add CSS for message animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
