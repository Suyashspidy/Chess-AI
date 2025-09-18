# Chess AI

This is a web-based chess application that allows you to play against an AI with varying difficulty levels, analyze your games, and practice your skills. The application is built with Flask for the backend and vanilla JavaScript for the frontend.

## Features

*   **Play against AI:** Challenge an AI opponent with four difficulty levels:
    *   **Easy:** A beginner-friendly AI that makes random moves.
    *   **Medium:** An intermediate AI that uses a simple evaluation function.
    *   **Hard:** An advanced AI that uses the minimax algorithm with alpha-beta pruning.
    *   **Gemini:** A powerful AI that uses Google's Gemini Pro model to determine the best move.
*   **Game Analysis:** Get real-time analysis of your games, including:
    *   Material balance
    *   Center control
    *   Move suggestions
*   **Practice Tools:**
    *   **Hints:** Get hints for the best move.
    *   **Undo:** Undo your last move.
*   **Game History:** Review your move history.
*   **Clean UI:** A user-friendly interface for a seamless chess experience.

## Technologies Used

*   **Backend:**
    *   Flask
    *   python-chess
    *   Google Generative AI
*   **Frontend:**
    *   HTML
    *   CSS
    *   JavaScript

## How to Run

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Suyashspidy/Chess-AI.git
    ```
2.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run the application:**
    ```bash
    python app.py
    ```
4.  Open your browser and go to `http://127.0.0.1:5000`.

License
This project is licensed under the MIT License.
