from flask import Flask, render_template, jsonify
import os, json

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/states")
def get_states():
    with open("static/data/us-states.json", encoding="utf-8") as f:
        return jsonify(json.load(f))

@app.route("/api/counties/<state_code>")
def get_counties(state_code):
    path = f"static/data/counties/{state_code.upper()}.json"
    if not os.path.exists(path):
        return jsonify({"error": "Not found"}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
