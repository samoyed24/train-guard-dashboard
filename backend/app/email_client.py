import smtplib
from email.mime.text import MIMEText

from flask import current_app


def send_email(to_email: str, subject: str, body: str):
    host = current_app.config["SMTP_HOST"]
    port = current_app.config["SMTP_PORT"]
    username = current_app.config["SMTP_USERNAME"]
    password = current_app.config["SMTP_PASSWORD"]
    use_tls = current_app.config["SMTP_USE_TLS"]
    from_email = current_app.config["SMTP_FROM_EMAIL"]

    if not host or not from_email:
        raise ValueError("SMTP is not configured")

    message = MIMEText(body, _charset="utf-8")
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email

    smtp_cls = smtplib.SMTP if use_tls else smtplib.SMTP_SSL
    with smtp_cls(host=host, port=port, timeout=10) as smtp:
        if use_tls:
            smtp.starttls()
        if username:
            smtp.login(username, password)
        smtp.sendmail(from_email, [to_email], message.as_string())
