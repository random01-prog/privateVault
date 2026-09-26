from flask import Flask, render_template, request, redirect, url_for, session
import os

app = Flask(__name__)

# Secret key for Flask sessions
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret-key")

# Single-user login
USERNAME = "lavanya"
PASSWORD = "1234"


@app.route("/")
def home():
    if "user" not in session:
        return redirect(url_for("login"))

    return render_template("dashboard.html")


@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        if username == USERNAME and password == PASSWORD:
            session["user"] = username
            return redirect(url_for("home"))

        return render_template(
            "login.html",
            error="Incorrect username or password"
        )

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(debug=True)