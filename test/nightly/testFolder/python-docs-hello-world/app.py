import sys

from flask import Flask

app = Flask(__name__)

@app.route("/")
def hello():
    return f"Version: {sys.version_info[0]}.{sys.version_info[1]}"
