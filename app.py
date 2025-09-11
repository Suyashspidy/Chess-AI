from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import chess
import chess.engine
import chess.svg
import random
import json
import time
from datetime import datetime
import os
import google.generativeai as genai

genai.configure(api_key="gemini key")

app = Flask(__name__)
app.config['SECRET_KEY'] = 'chess_secret_key_2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Game storage (in production, use a database)
games = {}
player_stats = {}

class ChessGame:
    def __init__(self, game_id, mode='ai', difficulty='medium'):
        self.game_id = game_id
        self.board = chess.Board()
        self.mode = mode  # 'ai', 'human', 'analysis'
        self.difficulty = difficulty
        self.move_history = []
        self.start_time = datetime.now()
        self.white_player = None
        self.black_player = None
        self.current_player = 'white'
        self.game_over = False
        self.result = None
        self.hints_used = 0
        self.analysis_enabled = True
        
    def make_move(self, move_uci):
        try:
            move = chess.Move.from_uci(move_uci)
            if move in self.board.legal_moves:
                # Store move with timestamp and evaluation
                move_data = {
                    'move': move_uci,
                    'san': self.board.san(move),
                    'timestamp': datetime.now().isoformat(),
                    'position_before': self.board.fen(),
                }
                
                self.board.push(move)
                move_data['position_after'] = self.board.fen()
                self.move_history.append(move_data)
                
                # Check game state
                if self.board.is_checkmate():
                    self.game_over = True
                    winner = 'black' if self.board.turn == chess.WHITE else 'white'
                    self.result = f"{winner.title()} wins by checkmate"
                elif self.board.is_stalemate():
                    self.game_over = True
                    self.result = "Draw by stalemate"
                elif self.board.is_insufficient_material():
                    self.game_over = True
                    self.result = "Draw by insufficient material"
                elif self.board.is_seventyfive_moves():
                    self.game_over = True
                    self.result = "Draw by 75-move rule"
                elif self.board.is_fivefold_repetition():
                    self.game_over = True
                    self.result = "Draw by repetition"
                
                self.current_player = 'black' if self.current_player == 'white' else 'white'
                return True
            return False
        except:
            return False
    
    def get_ai_move(self):
        if self.board.is_game_over():
            return None
            
        legal_moves = list(self.board.legal_moves)
        if not legal_moves:
            return None
            
        if self.difficulty == 'easy':
            # Random move with slight preference for captures
            captures = [move for move in legal_moves if self.board.is_capture(move)]
            if captures and random.random() < 0.3:
                return random.choice(captures)
            return random.choice(legal_moves)
            
        elif self.difficulty == 'medium':
            # Simple evaluation-based move selection
            best_move = None
            best_score = float('-inf')
            
            for move in legal_moves:
                self.board.push(move)
                score = self.evaluate_position()
                
                # Add some randomness
                score += random.uniform(-0.2, 0.2)
                
                if score > best_score:
                    best_score = score
                    best_move = move
                    
                self.board.pop()
            
            return best_move
        
        elif self.difficulty == 'gemini':
            return self.get_gemini_move()
            
        else:  # hard
            # Minimax with alpha-beta pruning (depth 3)
            return self.minimax_move(depth=3)
    
    def evaluate_position(self):
        if self.board.is_checkmate():
            return -1000 if self.board.turn == chess.BLACK else 1000
        if self.board.is_stalemate() or self.board.is_insufficient_material():
            return 0
            
        piece_values = {
            chess.PAWN: 1,
            chess.KNIGHT: 3,
            chess.BISHOP: 3,
            chess.ROOK: 5,
            chess.QUEEN: 9,
            chess.KING: 0
        }
        
        score = 0
        for square in chess.SQUARES:
            piece = self.board.piece_at(square)
            if piece:
                value = piece_values[piece.piece_type]
                if piece.color == chess.WHITE:
                    score += value
                else:
                    score -= value
        
        # Add positional bonuses
        score += self.get_positional_score()
        
        return score if self.board.turn == chess.WHITE else -score
    
    def get_positional_score(self):
        score = 0
        
        # Center control
        center_squares = [chess.D4, chess.D5, chess.E4, chess.E5]
        for square in center_squares:
            piece = self.board.piece_at(square)
            if piece:
                if piece.color == chess.WHITE:
                    score += 0.3
                else:
                    score -= 0.3
        
        # King safety (simplified)
        white_king = self.board.king(chess.WHITE)
        black_king = self.board.king(chess.BLACK)
        
        if white_king and chess.square_rank(white_king) == 0:
            score += 0.5  # King on back rank is safer in opening/middlegame
        if black_king and chess.square_rank(black_king) == 7:
            score -= 0.5
            
        return score
    
    def minimax_move(self, depth):
        def minimax(board, depth, alpha, beta, maximizing):
            if depth == 0 or board.is_game_over():
                return self.evaluate_position()
            
            if maximizing:
                max_eval = float('-inf')
                for move in board.legal_moves:
                    board.push(move)
                    eval_score = minimax(board, depth - 1, alpha, beta, False)
                    board.pop()
                    max_eval = max(max_eval, eval_score)
                    alpha = max(alpha, eval_score)
                    if beta <= alpha:
                        break
                return max_eval
            else:
                min_eval = float('inf')
                for move in board.legal_moves:
                    board.push(move)
                    eval_score = minimax(board, depth - 1, alpha, beta, True)
                    board.pop()
                    min_eval = min(min_eval, eval_score)
                    beta = min(beta, eval_score)
                    if beta <= alpha:
                        break
                return min_eval
        
        best_move = None
        best_score = float('-inf') if self.board.turn == chess.WHITE else float('inf')
        
        for move in self.board.legal_moves:
            self.board.push(move)
            score = minimax(self.board, depth - 1, float('-inf'), float('inf'), 
                          self.board.turn == chess.WHITE)
            self.board.pop()
            
            if self.board.turn == chess.WHITE:
                if score > best_score:
                    best_score = score
                    best_move = move
            else:
                if score < best_score:
                    best_score = score
                    best_move = move
        
        return best_move

    def get_gemini_move(self):
        try:
            model = genai.GenerativeModel('gemini-pro')
            prompt = f"You are a chess grandmaster. The current FEN is {self.board.fen()}. The legal moves are {', '.join([move.uci() for move in self.board.legal_moves])}. What is the best move for the current player? Respond with only the move in UCI format."
            response = model.generate_content(prompt)
            move_uci = response.text.strip()
            return chess.Move.from_uci(move_uci)
        except Exception as e:
            print(f"Error getting Gemini move: {e}")
            # Fallback to a random move
            return random.choice(list(self.board.legal_moves))
    
    def get_hint(self):
        if self.hints_used >= 3:  # Limit hints per game
            return None
            
        self.hints_used += 1
        
        # Get best move for current position
        if self.difficulty == 'easy':
            legal_moves = list(self.board.legal_moves)
            captures = [move for move in legal_moves if self.board.is_capture(move)]
            if captures:
                return random.choice(captures).uci()
            return random.choice(legal_moves).uci() if legal_moves else None
        else:
            best_move = self.get_ai_move()
            return best_move.uci() if best_move else None
    
    def to_dict(self):
        return {
            'game_id': self.game_id,
            'fen': self.board.fen(),
            'turn': 'white' if self.board.turn == chess.WHITE else 'black',
            'legal_moves': [move.uci() for move in self.board.legal_moves],
            'is_check': self.board.is_check(),
            'is_checkmate': self.board.is_checkmate(),
            'is_stalemate': self.board.is_stalemate(),
            'game_over': self.game_over,
            'result': self.result,
            'move_count': len(self.move_history),
            'hints_used': self.hints_used,
            'mode': self.mode,
            'difficulty': self.difficulty
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/new_game', methods=['POST'])
def new_game():
    data = request.get_json()
    mode = data.get('mode', 'ai')
    difficulty = data.get('difficulty', 'medium')
    
    game_id = f"game_{int(time.time())}_{random.randint(1000, 9999)}"
    game = ChessGame(game_id, mode, difficulty)
    games[game_id] = game
    
    return jsonify({
        'success': True,
        'game_id': game_id,
        'game_state': game.to_dict()
    })

@app.route('/api/move', methods=['POST'])
def make_move():
    data = request.get_json()
    game_id = data.get('game_id')
    move_uci = data.get('move')
    
    if game_id not in games:
        return jsonify({'success': False, 'error': 'Game not found'})
    
    game = games[game_id]
    
    if game.make_move(move_uci):
        response_data = {
            'success': True,
            'game_state': game.to_dict()
        }
        
        # If playing against AI and it's AI's turn, get AI move
        if game.mode == 'ai' and not game.game_over and game.current_player == 'black':
            ai_move = game.get_ai_move()
            if ai_move:
                game.make_move(ai_move.uci())
                response_data['ai_move'] = ai_move.uci()
                response_data['game_state'] = game.to_dict()
        
        return jsonify(response_data)
    else:
        return jsonify({'success': False, 'error': 'Invalid move'})

@app.route('/api/hint', methods=['POST'])
def get_hint():
    data = request.get_json()
    game_id = data.get('game_id')
    
    if game_id not in games:
        return jsonify({'success': False, 'error': 'Game not found'})
    
    game = games[game_id]
    hint_move = game.get_hint()
    
    if hint_move:
        return jsonify({
            'success': True,
            'hint': hint_move,
            'hints_remaining': 3 - game.hints_used
        })
    else:
        return jsonify({
            'success': False,
            'error': 'No more hints available'
        })

@app.route('/api/game/<game_id>')
def get_game(game_id):
    if game_id not in games:
        return jsonify({'success': False, 'error': 'Game not found'})
    
    game = games[game_id]
    return jsonify({
        'success': True,
        'game_state': game.to_dict(),
        'move_history': game.move_history
    })

@app.route('/api/analysis/<game_id>')
def get_analysis(game_id):
    if game_id not in games:
        return jsonify({'success': False, 'error': 'Game not found'})
    
    game = games[game_id]
    
    # Simple position analysis
    analysis = {
        'material_balance': 0,
        'piece_activity': 0,
        'king_safety': 0,
        'center_control': 0,
        'suggestions': []
    }
    
    # Calculate material balance
    piece_values = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
    for square in chess.SQUARES:
        piece = game.board.piece_at(square)
        if piece and piece.piece_type != chess.KING:
            value = piece_values[piece.piece_type]
            if piece.color == chess.WHITE:
                analysis['material_balance'] += value
            else:
                analysis['material_balance'] -= value
    
    # Center control analysis
    center_squares = [chess.D4, chess.D5, chess.E4, chess.E5]
    white_center = sum(1 for sq in center_squares if game.board.piece_at(sq) and game.board.piece_at(sq).color == chess.WHITE)
    black_center = sum(1 for sq in center_squares if game.board.piece_at(sq) and game.board.piece_at(sq).color == chess.BLACK)
    analysis['center_control'] = white_center - black_center
    
    # Generate suggestions
    if game.board.is_check():
        analysis['suggestions'].append("You are in check! You must move your king or block the attack.")
    
    legal_moves = list(game.board.legal_moves)
    captures = [move for move in legal_moves if game.board.is_capture(move)]
    if captures:
        analysis['suggestions'].append(f"Consider capturing moves: {len(captures)} available")
    
    if analysis['center_control'] < 0:
        analysis['suggestions'].append("Try to control the center squares (d4, d5, e4, e5)")
    
    return jsonify({
        'success': True,
        'analysis': analysis
    })

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
