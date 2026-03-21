import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)

from app import create_app

app = create_app()


if __name__ == "__main__":
    flask_debug = os.getenv("FLASK_DEBUG", "").lower()
    if flask_debug:
        debug = flask_debug in {"1", "true", "yes", "on"}
    else:
        debug = os.getenv("FLASK_ENV", "").lower() == "development"
    app.run(host="0.0.0.0", port=8000, debug=debug)
